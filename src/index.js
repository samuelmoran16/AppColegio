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
        next();
    } else {
        res.status(403).redirect('/login.html');
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
    const { nombre, fecha_nacimiento, id_representante } = req.body;
     if (!nombre || !id_representante) {
        return res.status(400).send('El nombre y el representante son obligatorios.');
    }
    try {
        const result = await db.query(
            'INSERT INTO estudiantes (nombre, fecha_nacimiento, id_representante) VALUES ($1, $2, $3) RETURNING *',
            [nombre, fecha_nacimiento || null, id_representante]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al registrar el estudiante');
    }
});

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
}); 