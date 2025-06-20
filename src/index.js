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
        res.status(500).send('Error al obtener los representantes');
    }
});

// Registrar un nuevo representante
app.post('/api/representantes', auth('admin'), async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).send('Todos los campos son obligatorios.');
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
        // Error de email duplicado
        if (err.code === '23505') {
            return res.status(409).send('El correo electrónico ya está registrado.');
        }
        res.status(500).send('Error al registrar el representante');
    }
});

// Registrar un nuevo estudiante
app.post('/api/estudiantes', auth('admin'), async (req, res) => {
    const { nombre, cedula, fecha_nacimiento, grado, id_representante } = req.body;
     if (!nombre || !cedula || !id_representante || !grado) {
        return res.status(400).send('Nombre, Cédula, Grado y Representante son obligatorios.');
    }
    try {
        const result = await db.query(
            'INSERT INTO estudiantes (nombre, cedula, fecha_nacimiento, grado, id_representante) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, cedula, fecha_nacimiento || null, grado, id_representante]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
         if (err.code === '23505') { // Error de constraint único
            return res.status(409).send('La cédula ya está registrada.');
        }
        res.status(500).send('Error al registrar el estudiante');
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
        res.status(500).send('Error al obtener los estudiantes');
    }
});

// Registrar una nueva nota
app.post('/api/notas', auth('admin'), async (req, res) => {
    const { cedula_estudiante, materia, calificacion, periodo } = req.body;
    if (!cedula_estudiante || !materia || !calificacion || !periodo) {
        return res.status(400).send('Todos los campos son obligatorios.');
    }
    try {
        // 1. Encontrar el ID del estudiante usando la cédula
        const estudianteResult = await db.query('SELECT id FROM estudiantes WHERE cedula = $1', [cedula_estudiante]);
        if (estudianteResult.rows.length === 0) {
            return res.status(404).send('No se encontró ningún estudiante con esa cédula.');
        }
        const id_estudiante = estudianteResult.rows[0].id;

        // 2. Insertar la nota con el ID encontrado
        const result = await db.query(
            'INSERT INTO notas (id_estudiante, materia, calificacion, periodo) VALUES ($1, $2, $3, $4) RETURNING *',
            [id_estudiante, materia, calificacion, periodo]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al registrar la nota');
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
        res.status(500).send('Error al obtener los datos del dashboard.');
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
            return res.status(403).send('No tiene permiso para ver las notas de este estudiante.');
        }

        const notasResult = await db.query('SELECT materia, calificacion, periodo FROM notas WHERE id_estudiante = $1 ORDER BY periodo, materia', [id]);
        res.json(notasResult.rows);

    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener las notas.');
    }
});

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
}); 