const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Conexión a la base de datos PostgreSQL usando la URL de Render.
// process.env.DATABASE_URL será configurado en el panel de Render.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Crear tablas si no existen
const initDB = async () => {
  try {
    // Tabla Administradores
    await pool.query(`CREATE TABLE IF NOT EXISTS administradores (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )`);

    // Tabla Representantes
    await pool.query(`CREATE TABLE IF NOT EXISTS representantes (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )`);

    // Tabla Estudiantes
    await pool.query(`CREATE TABLE IF NOT EXISTS estudiantes (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      fecha_nacimiento DATE,
      grado VARCHAR(50),
      id_representante INTEGER REFERENCES representantes(id)
    )`);

    // Tabla Pagos
    await pool.query(`CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      id_estudiante INTEGER REFERENCES estudiantes(id),
      monto DECIMAL(10, 2) NOT NULL,
      fecha DATE NOT NULL,
      concepto TEXT
    )`);

    // Tabla Notas
    await pool.query(`CREATE TABLE IF NOT EXISTS notas (
      id SERIAL PRIMARY KEY,
      id_estudiante INTEGER REFERENCES estudiantes(id),
      materia VARCHAR(255) NOT NULL,
      calificacion DECIMAL(4, 2) NOT NULL,
      periodo VARCHAR(100) NOT NULL
    )`);

    // Insertar admin por defecto si no existe
    const adminEmail = 'admin@colegio.com';
    const res = await pool.query('SELECT * FROM administradores WHERE email = $1', [adminEmail]);
    if (res.rowCount === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO administradores (nombre, email, password) VALUES ($1, $2, $3)',
        ['Administrador', adminEmail, hash]
      );
      console.log('Usuario administrador por defecto creado.');
    }
    
    console.log('Base de datos inicializada correctamente.');

  } catch (err) {
    console.error('Error inicializando la base de datos:', err.stack);
  }
};

module.exports = { db: pool, initDB }; 