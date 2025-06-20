const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');

// Render usa /data para el almacenamiento persistente. Localmente, usa la raíz del proyecto.
const dbPath = process.env.RENDER ? '/data/colegio.db' : path.join(__dirname, '..', 'colegio.db');

// Asegurarse de que el directorio de la base de datos exista en Render
if (process.env.RENDER) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al abrir la base de datos", err.message);
  } else {
    console.log("Conectado a la base de datos SQLite en:", dbPath);
  }
});

// Crear tablas si no existen
const initDB = () => {
  db.serialize(() => {
    // Tabla Administradores
    db.run(`CREATE TABLE IF NOT EXISTS administradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);

    // Insertar admin por defecto si no existe
    const adminEmail = 'admin@colegio.com';
    db.get('SELECT * FROM administradores WHERE email = ?', [adminEmail], (err, row) => {
      if (err) {
        console.error("Error al buscar administrador:", err.message);
        return;
      }
      if (!row) {
        bcrypt.hash('admin123', 10, (err, hash) => {
          if (err) {
            console.error("Error al encriptar contraseña:", err);
            return;
          }
          db.run('INSERT INTO administradores (nombre, email, password) VALUES (?, ?, ?)', ['Administrador', adminEmail, hash]);
          console.log('Usuario administrador por defecto creado.');
        });
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS representantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS estudiantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      fecha_nacimiento TEXT,
      id_representante INTEGER,
      FOREIGN KEY(id_representante) REFERENCES representantes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_estudiante INTEGER,
      monto REAL NOT NULL,
      fecha TEXT NOT NULL,
      concepto TEXT,
      FOREIGN KEY(id_estudiante) REFERENCES estudiantes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_estudiante INTEGER,
      materia TEXT NOT NULL,
      calificacion REAL NOT NULL,
      periodo TEXT NOT NULL,
      FOREIGN KEY(id_estudiante) REFERENCES estudiantes(id)
    )`);
  });
};

module.exports = { db, initDB }; 