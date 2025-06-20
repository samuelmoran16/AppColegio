const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Conexión a la base de datos PostgreSQL usando la URL de Render.
// process.env.DATABASE_URL será configurado en el panel de Render.
let pool;

// Verificar si estamos en producción (Render) o desarrollo local
if (process.env.DATABASE_URL) {
  // En producción (Render)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  // En desarrollo local - crear un pool mock
  console.log('⚠️  Modo desarrollo local: No hay conexión a base de datos.');
  console.log('   La aplicación funcionará con datos simulados.');
  
  // Crear un pool mock que simule las operaciones de base de datos
  pool = {
    query: async (text, params) => {
      console.log(`📝 Query ejecutada: ${text}`);
      
      // Simular respuestas para desarrollo local
      if (text.includes('CREATE TABLE')) {
        return { rows: [], rowCount: 0 };
      }
      
      if (text.includes('SELECT * FROM administradores WHERE email = $1')) {
        // Crear un hash válido para el admin
        const hash = await bcrypt.hash('admin123', 10);
        return { 
          rows: [{ id: 1, nombre: 'Administrador', email: 'admin@colegio.com', password: hash }], 
          rowCount: 1 
        };
      }
      
      if (text.includes('SELECT * FROM representantes WHERE email = $1')) {
        return { rows: [], rowCount: 0 };
      }
      
      if (text.includes('SELECT * FROM representantes')) {
        return { rows: [], rowCount: 0 };
      }
      
      if (text.includes('SELECT * FROM estudiantes')) {
        return { rows: [], rowCount: 0 };
      }
      
      if (text.includes('INSERT INTO representantes')) {
        const hash = await bcrypt.hash(params[2], 10);
        return { rows: [{ id: Math.floor(Math.random() * 1000), nombre: params[0], email: params[1] }], rowCount: 1 };
      }
      
      if (text.includes('INSERT INTO estudiantes')) {
        return { rows: [{ id: Math.floor(Math.random() * 1000) }], rowCount: 1 };
      }
      
      if (text.includes('INSERT INTO')) {
        return { rows: [{ id: Math.floor(Math.random() * 1000) }], rowCount: 1 };
      }
      
      return { rows: [], rowCount: 0 };
    }
  };
}

// Crear tablas si no existen
const initDB = async () => {
  try {
    // Solo intentar crear tablas si estamos en producción
    if (!process.env.DATABASE_URL) {
      console.log('✅ Base de datos simulada inicializada para desarrollo local.');
      return;
    }

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
      cedula VARCHAR(20) UNIQUE,
      fecha_nacimiento DATE,
      grado VARCHAR(50),
      id_representante INTEGER REFERENCES representantes(id)
    )`);

    // Tabla Pagos (Mejorada)
    await pool.query(`CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      id_estudiante INTEGER REFERENCES estudiantes(id) ON DELETE CASCADE,
      monto DECIMAL(10, 2) NOT NULL,
      concepto VARCHAR(255) NOT NULL,
      fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
      metodo_pago VARCHAR(100),
      referencia VARCHAR(255),
      estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente' -- Ej: Pendiente, Verificado, Rechazado
    )`);

    // Tabla Notas
    await pool.query(`CREATE TABLE IF NOT EXISTS notas (
      id SERIAL PRIMARY KEY,
      id_estudiante INTEGER REFERENCES estudiantes(id) ON DELETE CASCADE,
      materia VARCHAR(255) NOT NULL,
      calificacion DECIMAL(4, 2) NOT NULL,
      periodo VARCHAR(100) NOT NULL,
      UNIQUE(id_estudiante, materia, periodo)
    )`);

    // Añadir ON DELETE CASCADE a la tabla de notas si aún no existe
    // Esto es para manejar una posible actualización desde una versión anterior de la DB
    try {
        await pool.query('ALTER TABLE notas DROP CONSTRAINT notas_id_estudiante_fkey, ADD CONSTRAINT notas_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id) ON DELETE CASCADE');
    } catch (e) {
        // Ignorar el error si la constraint ya existe o no se puede modificar,
        // ya que la definición de la tabla ya la incluye.
    }

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