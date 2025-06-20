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


app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
}); 