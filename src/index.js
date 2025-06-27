const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { db, initDB, generarCarnetUnico, generarCedulaRepresentante } = require('./db');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Función helper para manejar parámetros de consulta según la base de datos
const getQueryParams = (params) => {
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    if (isProduction) {
        // PostgreSQL usa $1, $2, etc.
        return params.map((_, index) => `$${index + 1}`).join(', ');
    } else {
        // SQLite usa ?, ?, etc.
        return params.map(() => '?').join(', ');
    }
};

// Función helper para manejar códigos de error según la base de datos
const getUniqueConstraintError = () => {
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    return isProduction ? '23505' : 'SQLITE_CONSTRAINT_UNIQUE';
};

// Función helper para detectar el entorno de base de datos
const isProduction = () => process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;

// Inicializar DB
initDB();

// Middlewares optimizados
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'tu_super_secreto_aqui',
  resave: true,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    httpOnly: true,
    sameSite: 'lax'
  },
  name: 'colegio_session'
}));

// Middleware para logging de requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rutas de Login optimizadas
app.post('/login', async (req, res) => {
    const { email, cedula, password, role } = req.body;
    
    console.log('🔐 Intento de login:', { email, cedula, role });
    
    if (!password || !role) {
        return res.status(400).json({ message: 'Contraseña y rol son obligatorios' });
    }
    
    // Validar que se proporcione email para admin o cédula para representantes/maestros
    if (role === 'admin' && !email) {
        return res.status(400).json({ message: 'Email es obligatorio para administradores' });
    }
    
    if ((role === 'representante' || role === 'maestro') && !cedula) {
        return res.status(400).json({ message: 'Cédula es obligatoria para representantes y maestros' });
    }
    
    let tableName = '';
    let query = '';
    let params = [];
    
    if (role === 'admin') {
        tableName = 'administradores';
        query = isProduction() ? 
            `SELECT * FROM ${tableName} WHERE email = $1` : 
            `SELECT * FROM ${tableName} WHERE email = ?`;
        params = [email];
    } else if (role === 'representante') {
        tableName = 'representantes';
        query = isProduction() ? 
            `SELECT * FROM ${tableName} WHERE cedula = $1` : 
            `SELECT * FROM ${tableName} WHERE cedula = ?`;
        params = [cedula];
    } else if (role === 'maestro') {
        tableName = 'maestros';
        query = isProduction() ? 
            `SELECT * FROM ${tableName} WHERE cedula = $1` : 
            `SELECT * FROM ${tableName} WHERE cedula = ?`;
        params = [cedula];
    }

    if (!tableName) {
        return res.status(400).json({ message: 'Rol no válido' });
    }
    
    try {
        const result = await db.query(query, params);
        const user = result.rows[0];

        if (!user) {
            console.log('❌ Usuario no encontrado:', role === 'admin' ? email : cedula);
            return res.status(401).json({ message: 'Credenciales incorrectas' });
        }
        
        const match = await bcrypt.compare(password, user.password);
        
        if (match) {
            // Crear objeto de sesión
            const sessionUser = { 
                id: user.id, 
                email: user.email, 
                cedula: user.cedula,
                role: role,
                nombre: user.nombre || `${user.nombre} ${user.apellido || ''}`.trim()
            };
            
            // Guardar en sesión
            req.session.user = sessionUser;
            
            // Forzar guardado de sesión
            req.session.save((err) => {
                if (err) {
                    console.error('Error guardando sesión:', err);
                    return res.status(500).json({ message: 'Error al crear sesión' });
                }
                
                console.log('✅ Login exitoso:', sessionUser);
                
                const redirectUrl = role === 'admin' ? '/admin/dashboard' : 
                                   role === 'maestro' ? '/maestro/dashboard' : 
                                   '/representante/dashboard';
                
                res.json({ success: true, redirect: redirectUrl });
            });
        } else {
            console.log('❌ Contraseña incorrecta para:', role === 'admin' ? email : cedula);
            res.status(401).json({ message: 'Credenciales incorrectas' });
        }
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Ruta de Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error en logout:', err);
            return res.status(500).json({ message: 'No se pudo cerrar sesión' });
        }
        // Redirigir directamente al login en lugar de devolver JSON
        res.redirect('/login.html');
    });
});

// Ruta para verificar estado de sesión
app.get('/api/session', (req, res) => {
    if (req.session.user) {
        res.json({ 
            authenticated: true, 
            user: req.session.user 
        });
    } else {
        res.status(401).json({ 
            authenticated: false, 
            message: 'No hay sesión activa' 
        });
    }
});

// Middleware para proteger rutas optimizado
const auth = (role) => (req, res, next) => {
    console.log('🔐 Verificando autenticación para rol:', role);
    console.log('👤 Usuario en sesión:', req.session.user);
    
    if (req.session.user && req.session.user.role === role) {
        console.log('✅ Autenticación exitosa para rol:', role);
        return next();
    }
    
    console.log('❌ Autenticación fallida para rol:', role);
    
    if (req.accepts('json')) {
        res.status(403).json({ message: 'Acceso no autorizado. Por favor, inicie sesión de nuevo.' });
    } else {
        res.redirect('/login.html');
    }
};

// Rutas protegidas
app.get('/admin/dashboard', auth('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin_dashboard.html'));
});

app.get('/representante/dashboard', auth('representante'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'representante_dashboard.html'));
});

app.get('/maestro/dashboard', auth('maestro'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'maestro_dashboard.html'));
});

// --- API para Administrador optimizada ---

// Obtener todos los representantes
app.get('/api/representantes', auth('admin'), async (req, res) => {
    try {
        const query = isProduction() ? 
            'SELECT id, cedula, nombre, email FROM representantes ORDER BY nombre' :
            'SELECT id, cedula, nombre, email FROM representantes ORDER BY nombre';
        
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error obteniendo representantes:', err);
        res.status(500).json({ message: 'Error al obtener los representantes' });
    }
});

// Obtener todos los maestros
app.get('/api/maestros', auth('admin'), async (req, res) => {
    try {
        const query = isProduction() ? 
            'SELECT id, cedula, nombre, apellido, email, grado_asignado FROM maestros ORDER BY nombre' :
            'SELECT id, cedula, nombre, apellido, email, grado_asignado FROM maestros ORDER BY nombre';
        
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error obteniendo maestros:', err);
        res.status(500).json({ message: 'Error al obtener los maestros' });
    }
});

// Registrar un nuevo representante optimizado
app.post('/api/representantes', auth('admin'), async (req, res) => {
    const { cedula, nombre, email, password } = req.body;
    
    // Validaciones mejoradas
    if (!cedula || !nombre || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    
    // Validar cédula: 7 u 8 dígitos
    if (!/^\d{7,8}$/.test(cedula)) {
        return res.status(400).json({ message: 'La cédula debe tener 7 u 8 dígitos.' });
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'El formato del email no es válido.' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    
    try {
        // Verificar si la cédula ya existe
        const cedulaQuery = isProduction() ? 
            'SELECT id FROM representantes WHERE cedula = $1' : 
            'SELECT id FROM representantes WHERE cedula = ?';
        const cedulaResult = await db.query(cedulaQuery, [cedula]);
        
        if (cedulaResult.rows.length > 0) {
            return res.status(409).json({ message: 'La cédula ya está registrada por otro representante.' });
        }
        
        // Verificar si el email ya existe
        const emailQuery = isProduction() ? 
            'SELECT id FROM representantes WHERE email = $1' : 
            'SELECT id FROM representantes WHERE email = ?';
        const emailResult = await db.query(emailQuery, [email]);
        
        if (emailResult.rows.length > 0) {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado por otro representante.' });
        }
        
        const hash = await bcrypt.hash(password, 10);
        
        const query = isProduction() ? 
            'INSERT INTO representantes (cedula, nombre, email, password) VALUES ($1, $2, $3, $4) RETURNING id, cedula, nombre, email' :
            'INSERT INTO representantes (cedula, nombre, email, password) VALUES (?, ?, ?, ?) RETURNING id, cedula, nombre, email';
        
        const result = await db.query(query, [cedula, nombre, email, hash]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error registrando representante:', err);
        res.status(500).json({ message: 'Error al registrar el representante' });
    }
});

// Registrar un nuevo estudiante optimizado
app.post('/api/estudiantes', auth('admin'), async (req, res) => {
    const { nombre, cedula, fecha_nacimiento, grado, cedula_representante } = req.body;
    
    if (!nombre || !cedula_representante || !grado) {
        return res.status(400).json({ message: 'Nombre, Grado y Cédula del Representante son obligatorios.' });
    }
    
    // Validar que el grado sea válido
    const gradosValidos = [
        '1er Nivel Pre-Escolar', '2do Nivel Pre-Escolar', '3er Nivel Pre-Escolar',
        '1er Grado', '2do Grado', '3er Grado', '4to Grado', '5to Grado', '6to Grado'
    ];
    
    if (!gradosValidos.includes(grado)) {
        return res.status(400).json({ message: 'El grado especificado no es válido.' });
    }
    
    try {
        // Verificar que el representante existe
        const representanteQuery = isProduction() ? 
            'SELECT id FROM representantes WHERE cedula = $1' : 
            'SELECT id FROM representantes WHERE cedula = ?';
        const representanteResult = await db.query(representanteQuery, [cedula_representante]);
        
        if (representanteResult.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontró ningún representante con esa cédula.' });
        }
        
        // Si se proporciona cédula, verificar que no esté duplicada
        if (cedula) {
            const cedulaQuery = isProduction() ? 
                'SELECT id FROM estudiantes WHERE cedula = $1' : 
                'SELECT id FROM estudiantes WHERE cedula = ?';
            const cedulaResult = await db.query(cedulaQuery, [cedula]);
            
            if (cedulaResult.rows.length > 0) {
                return res.status(409).json({ message: 'La cédula ya está registrada por otro estudiante.' });
            }
        }
        
        // Generar carnet único
        const carnet = await generarCarnetUnico();
        
        const query = isProduction() ? 
            'INSERT INTO estudiantes (carnet, nombre, cedula, fecha_nacimiento, grado, cedula_representante) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *' :
            'INSERT INTO estudiantes (carnet, nombre, cedula, fecha_nacimiento, grado, cedula_representante) VALUES (?, ?, ?, ?, ?, ?) RETURNING *';
        
        const result = await db.query(query, [carnet, nombre, cedula || null, fecha_nacimiento || null, grado, cedula_representante]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error registrando estudiante:', err);
        res.status(500).json({ message: 'Error al registrar el estudiante' });
    }
});

// Eliminar un estudiante
app.delete('/api/estudiantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        
        // Primero, eliminar los pagos asociados
        const deletePagosQuery = isProduction ? 
            'DELETE FROM pagos WHERE id_estudiante = $1' : 
            'DELETE FROM pagos WHERE id_estudiante = ?';
        await db.query(deletePagosQuery, [id]);
        
        // Luego, eliminar las notas asociadas
        const deleteNotasQuery = isProduction ? 
            'DELETE FROM notas WHERE id_estudiante = $1' : 
            'DELETE FROM notas WHERE id_estudiante = ?';
        await db.query(deleteNotasQuery, [id]);
        
        // Finalmente, eliminar al estudiante
        const deleteEstudianteQuery = isProduction ? 
            'DELETE FROM estudiantes WHERE id = $1' : 
            'DELETE FROM estudiantes WHERE id = ?';
        const result = await db.query(deleteEstudianteQuery, [id]);
        
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
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        
        // Verificar si el representante tiene estudiantes a su cargo
        const estudiantesQuery = isProduction ? 
            'SELECT id FROM estudiantes WHERE cedula_representante = (SELECT cedula FROM representantes WHERE id = $1)' : 
            'SELECT id FROM estudiantes WHERE cedula_representante = (SELECT cedula FROM representantes WHERE id = ?)';
        const estudiantes = await db.query(estudiantesQuery, [id]);
        
        if (estudiantes.rows.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar. El representante tiene estudiantes asignados.' });
        }
        
        const deleteQuery = isProduction ? 
            'DELETE FROM representantes WHERE id = $1' : 
            'DELETE FROM representantes WHERE id = ?';
        const result = await db.query(deleteQuery, [id]);
        
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
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        const query = isProduction ? 
            'UPDATE representantes SET nombre = $1, email = $2 WHERE id = $3 RETURNING *' :
            'UPDATE representantes SET nombre = ?, email = ? WHERE id = ? RETURNING *';
        
        const result = await db.query(query, [nombre, email, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === getUniqueConstraintError()) {
            return res.status(409).json({ message: 'El correo electrónico ya está en uso por otro representante.' });
        }
        res.status(500).json({ message: 'Error al actualizar el representante.' });
    }
});

// Editar un estudiante
app.put('/api/estudiantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    const { nombre, cedula, grado } = req.body; // Solo se pueden editar estos campos
    if (!nombre || !grado) {
        return res.status(400).json({ message: 'Nombre y grado son obligatorios.' });
    }
    try {
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        const query = isProduction ? 
            'UPDATE estudiantes SET nombre = $1, cedula = $2, grado = $3 WHERE id = $4 RETURNING *' :
            'UPDATE estudiantes SET nombre = ?, cedula = ?, grado = ? WHERE id = ? RETURNING *';
        
        const result = await db.query(query, [nombre, cedula || null, grado, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === getUniqueConstraintError()) {
            return res.status(409).json({ message: 'La cédula ya está en uso por otro estudiante.' });
        }
        res.status(500).json({ message: 'Error al actualizar el estudiante.' });
    }
});

// Obtener todos los estudiantes sin paginación ni límite
app.get('/api/estudiantes', auth('admin'), async (req, res) => {
    try {
        const grado = req.query.grado;
        const search = req.query.search;
        
        let whereClause = '';
        let params = [];
        
        if (grado) {
            whereClause = 'WHERE e.grado = ?';
            params.push(grado);
        }
        
        if (search) {
            whereClause = whereClause ? `${whereClause} AND (e.nombre LIKE ? OR e.carnet LIKE ?)` : 'WHERE e.nombre LIKE ? OR e.carnet LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        const query = `
            SELECT e.id, e.carnet, e.nombre, e.cedula, e.grado, r.cedula as cedula_representante, r.nombre as nombre_representante 
            FROM estudiantes e 
            JOIN representantes r ON e.cedula_representante = r.cedula 
            ${whereClause}
            ORDER BY e.nombre
        `;
        
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error obteniendo estudiantes:', err);
        res.status(500).json({ message: 'Error al obtener los estudiantes' });
    }
});

// Registrar una nueva nota
app.post('/api/notas', auth('admin'), async (req, res) => {
    const { carnet_estudiante, materia, calificacion, periodo } = req.body;
    if (!carnet_estudiante || !materia || !calificacion || !periodo) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    try {
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        
        const estudianteQuery = isProduction ? 
            'SELECT id FROM estudiantes WHERE carnet = $1' : 
            'SELECT id FROM estudiantes WHERE carnet = ?';
        const estudianteResult = await db.query(estudianteQuery, [carnet_estudiante]);
        
        if (estudianteResult.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontró ningún estudiante con ese carnet.' });
        }
        const id_estudiante = estudianteResult.rows[0].id;

        const insertQuery = isProduction ? 
            'INSERT INTO notas (id_estudiante, materia, calificacion, periodo) VALUES ($1, $2, $3, $4) RETURNING *' :
            'INSERT INTO notas (id_estudiante, materia, calificacion, periodo) VALUES (?, ?, ?, ?) RETURNING *';
        
        const result = await db.query(insertQuery, [id_estudiante, materia, calificacion, periodo]);
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
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        
        // Obtener datos del representante
        const repQuery = isProduction ? 
            'SELECT cedula, nombre, email FROM representantes WHERE id = $1' : 
            'SELECT cedula, nombre, email FROM representantes WHERE id = ?';
        const repResult = await db.query(repQuery, [id_representante]);
        
        // Obtener la lista de hijos
        const hijosQuery = isProduction ? 
            'SELECT id, carnet, nombre, cedula, fecha_nacimiento, grado FROM estudiantes WHERE cedula_representante = $1 ORDER BY nombre' : 
            'SELECT id, carnet, nombre, cedula, fecha_nacimiento, grado FROM estudiantes WHERE cedula_representante = ? ORDER BY nombre';
        const hijosResult = await db.query(hijosQuery, [repResult.rows[0].cedula]);

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
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;

        // Obtener la cédula del representante
        const cedulaQuery = isProduction ? 
            'SELECT cedula FROM representantes WHERE id = $1' : 
            'SELECT cedula FROM representantes WHERE id = ?';
        const cedulaResult = await db.query(cedulaQuery, [id_representante]);
        
        if (cedulaResult.rows.length === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }
        
        const cedula_representante = cedulaResult.rows[0].cedula;

        // Verificar que el representante solo pueda ver las notas de sus propios hijos
        const verificacionQuery = isProduction ? 
            'SELECT id FROM estudiantes WHERE id = $1 AND cedula_representante = $2' : 
            'SELECT id FROM estudiantes WHERE id = ? AND cedula_representante = ?';
        const verificacion = await db.query(verificacionQuery, [id, cedula_representante]);
        
        if (verificacion.rows.length === 0) {
            return res.status(403).json({ message: 'No tiene permiso para ver las notas de este estudiante.' });
        }

        const notasQuery = isProduction ? 
            'SELECT materia, calificacion, periodo, tipo_calificacion FROM notas WHERE id_estudiante = $1 ORDER BY periodo, materia' : 
            'SELECT materia, calificacion, periodo, tipo_calificacion FROM notas WHERE id_estudiante = ? ORDER BY periodo, materia';
        const notasResult = await db.query(notasQuery, [id]);
        
        // Calcular promedios
        const notas = notasResult.rows;
        const promedios = calcularPromedios(notas);
        
        res.json({
            notas: notas,
            promedios: promedios
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener las notas.' });
    }
});

// Función para calcular promedios
function calcularPromedios(notas) {
    const promediosPorMateria = {};
    let totalNumerico = 0;
    let totalLetras = 0;
    let contadorNumerico = 0;
    let contadorLetras = 0;
    
    notas.forEach(nota => {
        if (!promediosPorMateria[nota.materia]) {
            promediosPorMateria[nota.materia] = {
                calificaciones: [],
                promedio: 0,
                tipo: nota.tipo_calificacion
            };
        }
        
        promediosPorMateria[nota.materia].calificaciones.push(nota.calificacion);
        
        if (nota.tipo_calificacion === 'numerica') {
            const calificacionNum = parseFloat(nota.calificacion);
            if (!isNaN(calificacionNum)) {
                totalNumerico += calificacionNum;
                contadorNumerico++;
            }
        } else if (nota.tipo_calificacion === 'letra') {
            totalLetras++;
            contadorLetras++;
        }
    });
    
    // Calcular promedio por materia
    Object.keys(promediosPorMateria).forEach(materia => {
        const materiaData = promediosPorMateria[materia];
        if (materiaData.tipo === 'numerica') {
            const calificacionesNum = materiaData.calificaciones.map(c => parseFloat(c)).filter(c => !isNaN(c));
            materiaData.promedio = calificacionesNum.length > 0 ? 
                (calificacionesNum.reduce((a, b) => a + b, 0) / calificacionesNum.length).toFixed(2) : 0;
        } else {
            // Para letras, contar A=3, B=2, C=1
            const valores = materiaData.calificaciones.map(c => {
                switch(c.toUpperCase()) {
                    case 'A': return 3;
                    case 'B': return 2;
                    case 'C': return 1;
                    default: return 0;
                }
            });
            const promedioLetras = valores.reduce((a, b) => a + b, 0) / valores.length;
            materiaData.promedio = promedioLetras > 0 ? promedioLetras.toFixed(2) : 0;
        }
    });
    
    // Calcular promedio total
    const promedioTotal = contadorNumerico > 0 ? (totalNumerico / contadorNumerico).toFixed(2) : 0;
    
    return {
        porMateria: promediosPorMateria,
        total: promedioTotal,
        tipo: contadorNumerico > 0 ? 'numerica' : 'letra'
    };
}

// --- API para Pagos de Mensualidad ---

// Obtener pagos de mensualidad de los hijos del representante
app.get('/api/representante/pagos', auth('representante'), async (req, res) => {
    try {
        const id_representante = req.session.user.id;
        
        // Determinar si estamos en producción (PostgreSQL) o desarrollo (SQLite)
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        
        // Primero obtener la cédula del representante
        const cedulaQuery = isProduction ? 
            'SELECT cedula FROM representantes WHERE id = $1' : 
            'SELECT cedula FROM representantes WHERE id = ?';
        const cedulaResult = await db.query(cedulaQuery, [id_representante]);
        
        if (cedulaResult.rows.length === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }
        
        const cedula_representante = cedulaResult.rows[0].cedula;
        
        // Obtener todos los hijos del representante con sus pagos
        const pagosQuery = isProduction ? 
            `SELECT 
                e.id as estudiante_id,
                e.carnet as estudiante_carnet,
                e.nombre as estudiante_nombre,
                e.cedula as estudiante_cedula,
                e.grado,
                p.id as pago_id,
                p.mes,
                p.año,
                p.monto,
                p.estado,
                p.fecha_pago,
                p.fecha_vencimiento,
                p.concepto
            FROM estudiantes e
            LEFT JOIN pagos p ON e.id = p.id_estudiante
            WHERE e.cedula_representante = $1
            ORDER BY e.nombre, p.año DESC, p.mes DESC` :
            `SELECT 
                e.id as estudiante_id,
                e.carnet as estudiante_carnet,
                e.nombre as estudiante_nombre,
                e.cedula as estudiante_cedula,
                e.grado,
                p.id as pago_id,
                p.mes,
                p.año,
                p.monto,
                p.estado,
                p.fecha_pago,
                p.fecha_vencimiento,
                p.concepto
            FROM estudiantes e
            LEFT JOIN pagos p ON e.id = p.id_estudiante
            WHERE e.cedula_representante = ?
            ORDER BY e.nombre, p.año DESC, p.mes DESC`;
        
        const result = await db.query(pagosQuery, [cedula_representante]);

        // Organizar los datos por estudiante
        const estudiantes = {};
        result.rows.forEach(row => {
            if (!estudiantes[row.estudiante_id]) {
                estudiantes[row.estudiante_id] = {
                    id: row.estudiante_id,
                    carnet: row.estudiante_carnet,
                    nombre: row.estudiante_nombre,
                    cedula: row.estudiante_cedula,
                    grado: row.grado,
                    pagos: []
                };
            }
            
            if (row.pago_id) {
                estudiantes[row.estudiante_id].pagos.push({
                    id: row.pago_id,
                    mes: row.mes,
                    año: row.año,
                    monto: row.monto,
                    estado: row.estado,
                    fecha_pago: row.fecha_pago,
                    fecha_vencimiento: row.fecha_vencimiento,
                    concepto: row.concepto
                });
            }
        });

        res.json(Object.values(estudiantes));
    } catch (err) {
        console.error('Error al obtener pagos:', err);
        res.status(500).json({ message: 'Error al obtener los pagos.' });
    }
});

// Generar mensualidades pendientes para un estudiante (función auxiliar)
app.post('/api/admin/generar-mensualidades', auth('admin'), async (req, res) => {
    try {
        const { carnet, año } = req.body;
        
        // Validaciones
        if (!carnet || !año) {
            return res.status(400).json({ message: 'Carnet y año son obligatorios.' });
        }

        if (año !== 2025) {
            return res.status(400).json({ message: 'Solo se permiten mensualidades para el año 2025.' });
        }

        // Determinar si estamos en producción (PostgreSQL) o desarrollo (SQLite)
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;

        // Verificar que el estudiante existe por carnet
        const estudianteQuery = isProduction ? 
            'SELECT id, nombre FROM estudiantes WHERE carnet = $1' : 
            'SELECT id, nombre FROM estudiantes WHERE carnet = ?';
        
        const estudianteExiste = await db.query(estudianteQuery, [carnet]);
        if (estudianteExiste.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontró ningún estudiante con ese carnet.' });
        }

        const estudiante = estudianteExiste.rows[0];
        let mensualidadesGeneradas = 0;
        let mensualidadesExistentes = 0;
        
        // Generar mensualidades para el año escolar (septiembre a agosto)
        const mesesEscolares = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]; // Septiembre a Agosto
        
        for (let mes of mesesEscolares) {
            try {
                // Verificar si ya existe
                const existeQuery = isProduction ? 
                    'SELECT id FROM pagos WHERE id_estudiante = $1 AND mes = $2 AND año = $3' : 
                    'SELECT id FROM pagos WHERE id_estudiante = ? AND mes = ? AND año = ?';
                
                const existe = await db.query(existeQuery, [estudiante.id, mes, año]);
                if (existe.rows.length === 0) {
                    // Calcular fecha de vencimiento (último día del mes)
                    const fechaVencimiento = new Date(año, mes, 0);
                    
                    // Construir la consulta INSERT según la base de datos
                    const insertQuery = isProduction ? 
                        `INSERT INTO pagos (id_estudiante, mes, año, monto, estado, fecha_vencimiento)
                         VALUES ($1, $2, $3, $4, 'pendiente', $5)` : 
                        `INSERT INTO pagos (id_estudiante, mes, año, monto, estado, fecha_vencimiento)
                         VALUES (?, ?, ?, ?, 'pendiente', ?)`;
                    
                    await db.query(insertQuery, [estudiante.id, mes, año, 12480.00, fechaVencimiento]);
                    
                    mensualidadesGeneradas++;
                } else {
                    mensualidadesExistentes++;
                }
            } catch (error) {
                console.error(`Error generando mensualidad para mes ${mes}:`, error);
                return res.status(500).json({ 
                    message: `Error al generar mensualidad para ${mes}/${año}. Detalles: ${error.message}` 
                });
            }
        }
        
        let mensaje = `Mensualidades procesadas para ${estudiante.nombre} (Carnet: ${carnet}) - Año Escolar 2025 (Septiembre-Agosto). `;
        if (mensualidadesGeneradas > 0) {
            mensaje += `${mensualidadesGeneradas} mensualidades generadas. `;
        }
        if (mensualidadesExistentes > 0) {
            mensaje += `${mensualidadesExistentes} mensualidades ya existían.`;
        }
        
        res.json({ 
            message: mensaje,
            generadas: mensualidadesGeneradas,
            existentes: mensualidadesExistentes
        });
    } catch (err) {
        console.error('Error general al generar mensualidades:', err);
        res.status(500).json({ 
            message: 'Error al generar mensualidades. Detalles: ' + err.message 
        });
    }
});

// Función para generar factura PDF
async function generarFacturaPDF(pago, estudiante, representante) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const filename = `factura_${estudiante.carnet}_${pago.mes}_${pago.año}.pdf`;
            const filepath = path.join(__dirname, '..', 'public', 'facturas', filename);
            
            // Crear directorio si no existe
            const facturasDir = path.dirname(filepath);
            if (!fs.existsSync(facturasDir)) {
                fs.mkdirSync(facturasDir, { recursive: true });
            }
            
            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);
            
            // Encabezado
            doc.fontSize(20).font('Helvetica-Bold').text('COLEGIO', { align: 'center' });
            doc.fontSize(16).font('Helvetica').text('FACTURA DE MENSUALIDAD', { align: 'center' });
            doc.moveDown();
            
            // Información del colegio
            doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL COLEGIO:');
            doc.fontSize(10).font('Helvetica').text('Dirección: Av. Principal, Ciudad');
            doc.text('Teléfono: (123) 456-7890');
            doc.text('Email: info@colegio.edu');
            doc.moveDown();
            
            // Información del representante
            doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL REPRESENTANTE:');
            doc.fontSize(10).font('Helvetica').text(`Nombre: ${representante.nombre}`);
            doc.text(`Email: ${representante.email}`);
            doc.moveDown();
            
            // Información del estudiante
            doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL ESTUDIANTE:');
            doc.fontSize(10).font('Helvetica').text(`Nombre: ${estudiante.nombre}`);
            doc.text(`Carnet: ${estudiante.carnet}`);
            doc.text(`Cédula: ${estudiante.cedula}`);
            doc.text(`Grado: ${estudiante.grado}`);
            doc.moveDown();
            
            // Información del pago
            doc.fontSize(12).font('Helvetica-Bold').text('DETALLES DEL PAGO:');
            doc.fontSize(10).font('Helvetica').text(`Mes: ${getNombreMes(pago.mes)} ${pago.año}`);
            doc.text(`Fecha de Pago: ${new Date(pago.fecha_pago).toLocaleDateString('es-ES')}`);
            doc.text(`Concepto: ${pago.concepto}`);
            doc.moveDown();
            
            // Tabla de montos
            doc.fontSize(12).font('Helvetica-Bold').text('RESUMEN DE PAGO:');
            doc.fontSize(10).font('Helvetica').text(`Monto: Bs. ${pago.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
            doc.moveDown();
            
            // Pie de página
            doc.fontSize(8).font('Helvetica').text('Esta factura es un comprobante oficial de pago.', { align: 'center' });
            doc.text(`Generada el: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
            
            doc.end();
            
            stream.on('finish', () => {
                resolve(filename);
            });
            
            stream.on('error', (error) => {
                reject(error);
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

// Función auxiliar para obtener nombre del mes
function getNombreMes(mes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1];
}

// Registrar un pago de mensualidad con generación de factura
app.post('/api/representante/pagos', auth('representante'), async (req, res) => {
    try {
        const { estudiante_id, mes, año } = req.body;
        const id_representante = req.session.user.id;

        // Determinar si estamos en producción (PostgreSQL) o desarrollo (SQLite)
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;

        // Validaciones
        if (año !== 2025) {
            return res.status(400).json({ message: 'Solo se permiten pagos para el año 2025.' });
        }

        // Verificar que el estudiante pertenece al representante
        const verificacionQuery = isProduction ? 
            'SELECT id FROM estudiantes WHERE id = $1 AND cedula_representante = (SELECT cedula FROM representantes WHERE id = $2)' : 
            'SELECT id FROM estudiantes WHERE id = ? AND cedula_representante = (SELECT cedula FROM representantes WHERE id = ?)';
        const verificacion = await db.query(verificacionQuery, [estudiante_id, id_representante]);
        if (verificacion.rows.length === 0) {
            return res.status(403).json({ message: 'No tiene permiso para realizar pagos para este estudiante.' });
        }

        // Verificar si ya existe un pago para ese mes/año y su estado
        const pagoExistenteQuery = isProduction ? 
            'SELECT id, estado FROM pagos WHERE id_estudiante = $1 AND mes = $2 AND año = $3' : 
            'SELECT id, estado FROM pagos WHERE id_estudiante = ? AND mes = ? AND año = ?';
        const pagoExistente = await db.query(pagoExistenteQuery, [estudiante_id, mes, año]);
        
        if (pagoExistente.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontró una mensualidad pendiente para este mes. El administrador debe generar las mensualidades primero.' });
        }

        const pago = pagoExistente.rows[0];
        
        if (pago.estado === 'pagado') {
            return res.status(409).json({ message: 'Esta mensualidad ya fue pagada anteriormente.' });
        }

        // Actualizar el pago existente como pagado
        const updateQuery = isProduction ? 
            `UPDATE pagos 
             SET estado = 'pagado', fecha_pago = CURRENT_DATE
             WHERE id = $1
             RETURNING *` : 
            `UPDATE pagos 
             SET estado = 'pagado', fecha_pago = CURRENT_DATE
             WHERE id = ?
             RETURNING *`;
        const result = await db.query(updateQuery, [pago.id]);

        const pagoActualizado = result.rows[0];

        // Obtener datos del estudiante y representante para la factura
        const estudianteQuery = isProduction ? 
            'SELECT * FROM estudiantes WHERE id = $1' : 
            'SELECT * FROM estudiantes WHERE id = ?';
        const representanteQuery = isProduction ? 
            'SELECT * FROM representantes WHERE id = $1' : 
            'SELECT * FROM representantes WHERE id = ?';
        
        const estudianteResult = await db.query(estudianteQuery, [estudiante_id]);
        const representanteResult = await db.query(representanteQuery, [id_representante]);

        const estudiante = estudianteResult.rows[0];
        const representante = representanteResult.rows[0];

        // Generar factura PDF
        const facturaFilename = await generarFacturaPDF(pagoActualizado, estudiante, representante);

        res.status(200).json({
            ...pagoActualizado,
            factura_url: `/facturas/${facturaFilename}`
        });
    } catch (err) {
        console.error('Error al registrar pago:', err);
        res.status(500).json({ message: 'Error al registrar el pago.' });
    }
});

// --- Rutas para la gestión de Notas por parte del Admin ---

// Obtener todas las notas de un estudiante (versión admin)
app.get('/api/admin/estudiantes/:id/notas', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        const query = isProduction ? 
            'SELECT id, materia, calificacion, periodo, tipo_calificacion FROM notas WHERE id_estudiante = $1 ORDER BY periodo, materia' : 
            'SELECT id, materia, calificacion, periodo, tipo_calificacion FROM notas WHERE id_estudiante = ? ORDER BY periodo, materia';
        
        const notasResult = await db.query(query, [id]);
        res.json(notasResult.rows);
    } catch (err) {
        console.error('Error al obtener notas:', err);
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
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        const query = isProduction ? 
            'UPDATE notas SET materia = $1, calificacion = $2, periodo = $3 WHERE id = $4 RETURNING *' :
            'UPDATE notas SET materia = ?, calificacion = ?, periodo = ? WHERE id = ? RETURNING *';
        const result = await db.query(query, [materia, calificacion, periodo, id]);
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
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        const query = isProduction ? 
            'DELETE FROM notas WHERE id = $1' : 
            'DELETE FROM notas WHERE id = ?';
        const result = await db.query(query, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Nota no encontrada.' });
        }
        res.status(200).json({ message: 'Nota eliminada con éxito.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar la nota.' });
    }
});

// Registrar un nuevo maestro
app.post('/api/maestros', auth('admin'), async (req, res) => {
    const { cedula, nombre, apellido, email, password, grado_asignado } = req.body;
    if (!cedula || !nombre || !apellido || !email || !password || !grado_asignado) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    
    // Validar formato de cédula: 7 u 8 dígitos
    if (!/^\d{7,8}$/.test(cedula)) {
        return res.status(400).json({ message: 'La cédula debe tener 7 u 8 dígitos.' });
    }
    
    try {
        // Verificar si la cédula ya existe
        const cedulaQuery = isProduction() ? 
            'SELECT id FROM maestros WHERE cedula = $1' : 
            'SELECT id FROM maestros WHERE cedula = ?';
        const cedulaResult = await db.query(cedulaQuery, [cedula]);
        
        if (cedulaResult.rows.length > 0) {
            return res.status(409).json({ message: 'La cédula ya está registrada por otro maestro.' });
        }
        
        // Verificar si el email ya existe
        const emailQuery = isProduction() ? 
            'SELECT id FROM maestros WHERE email = $1' : 
            'SELECT id FROM maestros WHERE email = ?';
        const emailResult = await db.query(emailQuery, [email]);
        
        if (emailResult.rows.length > 0) {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado por otro maestro.' });
        }
        
        const hash = await bcrypt.hash(password, 10);
        
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        const query = isProduction ? 
            'INSERT INTO maestros (cedula, nombre, apellido, email, password, grado_asignado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, cedula, nombre, apellido, email, grado_asignado' :
            'INSERT INTO maestros (cedula, nombre, apellido, email, password, grado_asignado) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, cedula, nombre, apellido, email, grado_asignado';
        
        const result = await db.query(query, [cedula, nombre, apellido, email, hash, grado_asignado]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al registrar el maestro' });
    }
});

// --- API para Maestros ---

// Obtener datos del maestro logueado y sus estudiantes
app.get('/api/maestro/dashboard', auth('maestro'), async (req, res) => {
    try {
        const id_maestro = req.session.user.id;
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        
        // Obtener datos del maestro
        const maestroQuery = isProduction ? 
            'SELECT cedula, nombre, apellido, email, grado_asignado FROM maestros WHERE id = $1' : 
            'SELECT cedula, nombre, apellido, email, grado_asignado FROM maestros WHERE id = ?';
        const maestroResult = await db.query(maestroQuery, [id_maestro]);
        
        // Obtener la lista de estudiantes del grado asignado
        const estudiantesQuery = isProduction ? 
            'SELECT id, carnet, nombre, cedula, fecha_nacimiento, grado FROM estudiantes WHERE grado = $1 ORDER BY nombre' : 
            'SELECT id, carnet, nombre, cedula, fecha_nacimiento, grado FROM estudiantes WHERE grado = ? ORDER BY nombre';
        const estudiantesResult = await db.query(estudiantesQuery, [maestroResult.rows[0].grado_asignado]);

        if (maestroResult.rows.length === 0) {
            return res.status(404).json({ message: 'Maestro no encontrado.' });
        }

        res.json({
            maestro: maestroResult.rows[0],
            estudiantes: estudiantesResult.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los datos del dashboard.' });
    }
});

// Obtener notas de un estudiante específico (versión maestro)
app.get('/api/maestro/estudiantes/:id/notas', auth('maestro'), async (req, res) => {
    try {
        const { id } = req.params;
        const id_maestro = req.session.user.id;
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;

        // Obtener el grado asignado del maestro
        const maestroQuery = isProduction ? 
            'SELECT grado_asignado FROM maestros WHERE id = $1' : 
            'SELECT grado_asignado FROM maestros WHERE id = ?';
        const maestroResult = await db.query(maestroQuery, [id_maestro]);
        
        if (maestroResult.rows.length === 0) {
            return res.status(404).json({ message: 'Maestro no encontrado.' });
        }
        
        const gradoAsignado = maestroResult.rows[0].grado_asignado;

        // Verificar que el estudiante pertenece al grado del maestro
        const verificacionQuery = isProduction ? 
            'SELECT id FROM estudiantes WHERE id = $1 AND grado = $2' : 
            'SELECT id FROM estudiantes WHERE id = ? AND grado = ?';
        const verificacion = await db.query(verificacionQuery, [id, gradoAsignado]);
        
        if (verificacion.rows.length === 0) {
            return res.status(403).json({ message: 'No tiene permiso para ver las notas de este estudiante.' });
        }

        const notasQuery = isProduction ? 
            'SELECT id, materia, calificacion, periodo, tipo_calificacion FROM notas WHERE id_estudiante = $1 ORDER BY periodo, materia' : 
            'SELECT id, materia, calificacion, periodo, tipo_calificacion FROM notas WHERE id_estudiante = ? ORDER BY periodo, materia';
        const notasResult = await db.query(notasQuery, [id]);
        res.json(notasResult.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener las notas.' });
    }
});

// Registrar nota desde maestro
app.post('/api/maestro/notas', auth('maestro'), async (req, res) => {
    const { carnet_estudiante, materia, calificacion, periodo } = req.body;
    if (!carnet_estudiante || !materia || !calificacion || !periodo) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    
    try {
        const id_maestro = req.session.user.id;
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        
        // Obtener el grado asignado del maestro
        const maestroQuery = isProduction ? 
            'SELECT grado_asignado FROM maestros WHERE id = $1' : 
            'SELECT grado_asignado FROM maestros WHERE id = ?';
        const maestroResult = await db.query(maestroQuery, [id_maestro]);
        
        if (maestroResult.rows.length === 0) {
            return res.status(404).json({ message: 'Maestro no encontrado.' });
        }
        
        const gradoAsignado = maestroResult.rows[0].grado_asignado;
        
        // Verificar que el estudiante existe y pertenece al grado del maestro
        const estudianteQuery = isProduction ? 
            'SELECT id FROM estudiantes WHERE carnet = $1 AND grado = $2' : 
            'SELECT id FROM estudiantes WHERE carnet = ? AND grado = ?';
        const estudianteResult = await db.query(estudianteQuery, [carnet_estudiante, gradoAsignado]);
        
        if (estudianteResult.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontró ningún estudiante con ese carnet en su grado asignado.' });
        }
        
        const id_estudiante = estudianteResult.rows[0].id;
        
        // Determinar el tipo de calificación basado en el grado
        const esPreescolar = ['1er Nivel Pre-Escolar', '2do Nivel Pre-Escolar', '3er Nivel Pre-Escolar'].includes(gradoAsignado);
        const tipoCalificacion = esPreescolar ? 'letra' : 'numerica';
        
        // Validar calificación según el tipo
        if (esPreescolar) {
            if (!['A', 'B', 'C'].includes(calificacion.toUpperCase())) {
                return res.status(400).json({ message: 'Para preescolar, las calificaciones deben ser A, B o C.' });
            }
        } else {
            const calificacionNum = parseFloat(calificacion);
            if (isNaN(calificacionNum) || calificacionNum < 0 || calificacionNum > 20) {
                return res.status(400).json({ message: 'La calificación debe ser un número entre 0 y 20.' });
            }
        }

        const insertQuery = isProduction ? 
            'INSERT INTO notas (id_estudiante, materia, calificacion, periodo, tipo_calificacion) VALUES ($1, $2, $3, $4, $5) RETURNING *' :
            'INSERT INTO notas (id_estudiante, materia, calificacion, periodo, tipo_calificacion) VALUES (?, ?, ?, ?, ?) RETURNING *';
        
        const result = await db.query(insertQuery, [id_estudiante, materia, calificacion, periodo, tipoCalificacion]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al registrar la nota' });
    }
});

// Eliminar un maestro
app.delete('/api/maestros/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
        
        const deleteQuery = isProduction ? 
            'DELETE FROM maestros WHERE id = $1' : 
            'DELETE FROM maestros WHERE id = ?';
        const result = await db.query(deleteQuery, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Maestro no encontrado.' });
        }
        res.status(200).json({ message: 'Maestro eliminado con éxito.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar el maestro.' });
    }
});

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});