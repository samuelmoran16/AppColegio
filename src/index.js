const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { db, initDB } = require('./db');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// Inicializar DB
initDB();

// Middlewares
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'tu_super_secreto_aqui', // Cambia esto por un secreto real
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Poner en true si usas HTTPS
}));

// Rutas de Login
app.post('/login', async (req, res) => {
    const { email, password, role } = req.body;
    
    let tableName = '';
    if (role === 'admin') tableName = 'administradores';
    if (role === 'representante') tableName = 'representantes';

    if (!tableName) {
        return res.status(400).send('Rol no válido');
    }
    
    try {
        const result = await db.query(`SELECT * FROM ${tableName} WHERE email = $1`, [email]);
        const user = result.rows[0];

        if (!user) return res.status(401).send('Credenciales incorrectas');
        
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.id, email: user.email, role: role };
            if (role === 'admin') {
                res.redirect('/admin/dashboard');
            } else {
                res.redirect('/representante/dashboard');
            }
        } else {
            res.status(401).send('Credenciales incorrectas');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error del servidor');
    }
});

// Ruta de Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send('No se pudo cerrar sesión');
        res.redirect('/login.html');
    });
});

// Middleware para proteger rutas
const auth = (role) => (req, res, next) => {
    if (req.session.user && req.session.user.role === role) {
        return next();
    }
    
    // Si no está autenticado, responder de forma inteligente
    // Si la petición espera JSON (una API), se envía un error JSON.
    // Si no, se redirige a la página de login.
    if (req.accepts('json')) {
        res.status(403).json({ message: 'Acceso no autorizado. Por favor, inicie sesión de nuevo.' });
    } else {
        res.redirect('/login.html');
    }
};

// Rutas protegidas (ejemplos)
app.get('/admin/dashboard', auth('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin_dashboard.html'));
});

app.get('/representante/dashboard', auth('representante'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'representante_dashboard.html'));
});

// --- API para Administrador ---

// Obtener todos los representantes
app.get('/api/representantes', auth('admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT id, nombre, email FROM representantes ORDER BY nombre');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los representantes' });
    }
});

// Registrar un nuevo representante
app.post('/api/representantes', auth('admin'), async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO representantes (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email',
            [nombre, email, hash]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
        }
        res.status(500).json({ message: 'Error al registrar el representante' });
    }
});

// Registrar un nuevo estudiante
app.post('/api/estudiantes', auth('admin'), async (req, res) => {
    const { nombre, cedula, fecha_nacimiento, grado, id_representante } = req.body;
     if (!nombre || !cedula || !id_representante || !grado) {
        return res.status(400).json({ message: 'Nombre, Cédula, Grado y Representante son obligatorios.' });
    }
    try {
        const result = await db.query(
            'INSERT INTO estudiantes (nombre, cedula, fecha_nacimiento, grado, id_representante) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, cedula, fecha_nacimiento || null, grado, id_representante]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
         if (err.code === '23505') { 
            return res.status(409).json({ message: 'La cédula ya está registrada.' });
        }
        res.status(500).json({ message: 'Error al registrar el estudiante' });
    }
});

// Eliminar un estudiante
app.delete('/api/estudiantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        // Primero, eliminar las notas asociadas para evitar errores de foreign key
        await db.query('DELETE FROM notas WHERE id_estudiante = $1', [id]);
        // Luego, eliminar al estudiante
        const result = await db.query('DELETE FROM estudiantes WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }
        res.status(200).json({ message: 'Estudiante eliminado con éxito.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar el estudiante.' });
    }
});

// Eliminar un representante
app.delete('/api/representantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        // Verificar si el representante tiene estudiantes a su cargo
        const estudiantes = await db.query('SELECT id FROM estudiantes WHERE id_representante = $1', [id]);
        if (estudiantes.rows.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar. El representante tiene estudiantes asignados.' });
        }
        
        const result = await db.query('DELETE FROM representantes WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }
        res.status(200).json({ message: 'Representante eliminado con éxito.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar el representante.' });
    }
});

// Editar un representante
app.put('/api/representantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    const { nombre, email } = req.body;
    if (!nombre || !email) {
        return res.status(400).json({ message: 'Nombre y email son obligatorios.' });
    }
    try {
        const result = await db.query(
            'UPDATE representantes SET nombre = $1, email = $2 WHERE id = $3 RETURNING *',
            [nombre, email, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'El correo electrónico ya está en uso por otro representante.' });
        }
        res.status(500).json({ message: 'Error al actualizar el representante.' });
    }
});

// Editar un estudiante
app.put('/api/estudiantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    const { nombre, cedula, grado } = req.body; // Solo se pueden editar estos campos
    if (!nombre || !cedula || !grado) {
        return res.status(400).json({ message: 'Nombre, cédula y grado son obligatorios.' });
    }
    try {
        const result = await db.query(
            'UPDATE estudiantes SET nombre = $1, cedula = $2, grado = $3 WHERE id = $4 RETURNING *',
            [nombre, cedula, grado, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'La cédula ya está en uso por otro estudiante.' });
        }
        res.status(500).json({ message: 'Error al actualizar el estudiante.' });
    }
});

// Obtener todos los estudiantes
app.get('/api/estudiantes', auth('admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT e.id, e.nombre, e.cedula, e.grado, r.nombre as nombre_representante 
            FROM estudiantes e 
            JOIN representantes r ON e.id_representante = r.id 
            ORDER BY e.nombre
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los estudiantes' });
    }
});

// Registrar una nueva nota
app.post('/api/notas', auth('admin'), async (req, res) => {
    const { cedula_estudiante, materia, calificacion, periodo } = req.body;
    if (!cedula_estudiante || !materia || !calificacion || !periodo) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    try {
        const estudianteResult = await db.query('SELECT id FROM estudiantes WHERE cedula = $1', [cedula_estudiante]);
        if (estudianteResult.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontró ningún estudiante con esa cédula.' });
        }
        const id_estudiante = estudianteResult.rows[0].id;

        const result = await db.query(
            'INSERT INTO notas (id_estudiante, materia, calificacion, periodo) VALUES ($1, $2, $3, $4) RETURNING *',
            [id_estudiante, materia, calificacion, periodo]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al registrar la nota' });
    }
});

// --- API para Representantes ---

// Obtener datos del representante logueado y sus hijos
app.get('/api/representante/dashboard', auth('representante'), async (req, res) => {
    try {
        const id_representante = req.session.user.id;
        
        // Obtener datos del representante
        const repResult = await db.query('SELECT nombre, email FROM representantes WHERE id = $1', [id_representante]);
        
        // Obtener la lista de hijos
        const hijosResult = await db.query('SELECT id, nombre, cedula, fecha_nacimiento, grado FROM estudiantes WHERE id_representante = $1 ORDER BY nombre', [id_representante]);

        if (repResult.rows.length === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }

        res.json({
            representante: repResult.rows[0],
            hijos: hijosResult.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los datos del dashboard.' });
    }
});

// Obtener notas de un estudiante específico
app.get('/api/estudiante/:id/notas', auth('representante'), async (req, res) => {
    try {
        const { id } = req.params;
        const id_representante = req.session.user.id;

        // Verificar que el representante solo pueda ver las notas de sus propios hijos
        const verificacion = await db.query('SELECT id FROM estudiantes WHERE id = $1 AND id_representante = $2', [id, id_representante]);
        if (verificacion.rows.length === 0) {
            return res.status(403).json({ message: 'No tiene permiso para ver las notas de este estudiante.' });
        }

        const notasResult = await db.query('SELECT materia, calificacion, periodo FROM notas WHERE id_estudiante = $1 ORDER BY periodo, materia', [id]);
        res.json(notasResult.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener las notas.' });
    }
});

// --- Rutas para la gestión de Notas por parte del Admin ---

// Obtener todas las notas de un estudiante (versión admin)
app.get('/api/admin/estudiantes/:id/notas', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const notasResult = await db.query('SELECT id, materia, calificacion, periodo FROM notas WHERE id_estudiante = $1 ORDER BY periodo, materia', [id]);
        res.json(notasResult.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener las notas del estudiante.' });
    }
});

// Actualizar una nota
app.put('/api/notas/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    const { materia, calificacion, periodo } = req.body;
    if (!materia || !calificacion || !periodo) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    try {
        const result = await db.query(
            'UPDATE notas SET materia = $1, calificacion = $2, periodo = $3 WHERE id = $4 RETURNING *',
            [materia, calificacion, periodo, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Nota no encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar la nota.' });
    }
});

// Eliminar una nota
app.delete('/api/notas/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM notas WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Nota no encontrada.' });
        }
        res.status(200).json({ message: 'Nota eliminada con éxito.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar la nota.' });
    }
});

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
}); 