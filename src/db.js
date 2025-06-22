const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configuración de base de datos
let pool;

if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  // Usar PostgreSQL en producción (Render)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  // Usar SQLite local para desarrollo
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  
  // Crear una conexión SQLite local
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  const db = new sqlite3.Database(dbPath);
  
  // Simular la interfaz de Pool de PostgreSQL
  pool = {
    query: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({ rows, rowCount: rows.length });
          }
        });
      });
    }
  };
  
  console.log('Usando base de datos SQLite local para desarrollo');
}

// Crear tablas si no existen
const initDB = async () => {
  try {
    // Tabla Administradores
    await pool.query(`CREATE TABLE IF NOT EXISTS administradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);

    // Tabla Representantes
    await pool.query(`CREATE TABLE IF NOT EXISTS representantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);

    // Tabla Estudiantes
    await pool.query(`CREATE TABLE IF NOT EXISTS estudiantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carnet TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      cedula TEXT,
      fecha_nacimiento TEXT,
      grado TEXT,
      id_representante INTEGER REFERENCES representantes(id)
    )`);

    // Tabla Notas
    await pool.query(`CREATE TABLE IF NOT EXISTS notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_estudiante INTEGER REFERENCES estudiantes(id),
      materia TEXT NOT NULL,
      calificacion REAL NOT NULL,
      periodo TEXT NOT NULL
    )`);

    // Migración de la tabla Pagos
    await migrarTablaPagos();

    // Migración de la tabla Estudiantes
    await migrarTablaEstudiantes();

    // Insertar admin por defecto si no existe
    const adminEmail = 'admin@colegio.com';
    const res = await pool.query('SELECT * FROM administradores WHERE email = ?', [adminEmail]);
    if (res.rowCount === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO administradores (nombre, email, password) VALUES (?, ?, ?)',
        ['Administrador', adminEmail, hash]
      );
      console.log('Usuario administrador por defecto creado.');
    }
    
    console.log('Base de datos inicializada correctamente.');

  } catch (err) {
    console.error('Error inicializando la base de datos:', err.stack);
  }
};

// Función para migrar la tabla de pagos
const migrarTablaPagos = async () => {
  try {
    // Verificar si la tabla pagos existe
    const tableExists = await pool.query(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='pagos'
    `);

    if (tableExists.rows.length > 0) {
      // La tabla existe, verificar si tiene las columnas nuevas
      const columns = await pool.query(`
        PRAGMA table_info(pagos)
      `);
      
      const columnNames = columns.rows.map(row => row.name);
      
      // Si no tiene las columnas nuevas, eliminar la tabla y recrearla
      if (!columnNames.includes('mes') || !columnNames.includes('año')) {
        console.log('Migrando tabla de pagos...');
        await pool.query('DROP TABLE IF EXISTS pagos');
        
        // Crear la nueva tabla con la estructura correcta
        await pool.query(`CREATE TABLE pagos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_estudiante INTEGER REFERENCES estudiantes(id),
          monto REAL NOT NULL DEFAULT 12480.00,
          mes INTEGER NOT NULL CHECK (mes >= 9 OR mes <= 8),
          año INTEGER NOT NULL CHECK (año = 2025),
          fecha_pago TEXT,
          estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
          fecha_vencimiento TEXT NOT NULL,
          concepto TEXT DEFAULT 'Mensualidad escolar'
        )`);
        
        console.log('Tabla de pagos migrada correctamente.');
      } else {
        console.log('Tabla de pagos ya tiene la estructura correcta.');
      }
    } else {
      // La tabla no existe, crearla con la estructura correcta
      await pool.query(`CREATE TABLE pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_estudiante INTEGER REFERENCES estudiantes(id),
        monto REAL NOT NULL DEFAULT 12480.00,
        mes INTEGER NOT NULL CHECK (mes >= 9 OR mes <= 8),
        año INTEGER NOT NULL CHECK (año = 2025),
        fecha_pago TEXT,
        estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
        fecha_vencimiento TEXT NOT NULL,
        concepto TEXT DEFAULT 'Mensualidad escolar'
      )`);
      
      console.log('Tabla de pagos creada correctamente.');
    }
  } catch (err) {
    console.error('Error migrando tabla de pagos:', err);
    throw err;
  }
};

// Función para migrar la tabla de estudiantes y añadir carnets únicos
const migrarTablaEstudiantes = async () => {
  try {
    // Verificar si la tabla estudiantes existe
    const tableExists = await pool.query(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='estudiantes'
    `);

    if (tableExists.rows.length > 0) {
      // La tabla existe, verificar si tiene la columna carnet
      const columns = await pool.query(`
        PRAGMA table_info(estudiantes)
      `);
      
      const columnNames = columns.rows.map(row => row.name);
      
      // Si no tiene la columna carnet, añadirla
      if (!columnNames.includes('carnet')) {
        console.log('Migrando tabla de estudiantes para añadir carnets...');
        
        // Añadir la columna carnet
        await pool.query('ALTER TABLE estudiantes ADD COLUMN carnet TEXT UNIQUE');
        
        // Generar carnets para estudiantes existentes
        const estudiantes = await pool.query('SELECT id FROM estudiantes ORDER BY id');
        for (let i = 0; i < estudiantes.rows.length; i++) {
          const carnet = await generarCarnetUnico();
          await pool.query('UPDATE estudiantes SET carnet = ? WHERE id = ?', [carnet, estudiantes.rows[i].id]);
        }
        
        console.log('Tabla de estudiantes migrada correctamente con carnets únicos.');
      } else {
        console.log('Tabla de estudiantes ya tiene la columna carnet.');
      }
      
      // Migrar la columna cedula para hacerla opcional
      await migrarCedulaOpcional();
    } else {
      console.log('Tabla de estudiantes no existe, se creará con la nueva estructura.');
    }
  } catch (err) {
    console.error('Error migrando tabla de estudiantes:', err);
    throw err;
  }
};

// Función para migrar la cédula a opcional
const migrarCedulaOpcional = async () => {
  try {
    // En SQLite, las columnas son opcionales por defecto
    // Solo necesitamos verificar que no haya restricciones UNIQUE
    console.log('Columna cedula ya es opcional en SQLite.');
  } catch (err) {
    console.error('Error migrando columna cedula:', err);
    throw err;
  }
};

// Función para generar carnet único
const generarCarnetUnico = async () => {
  const año = new Date().getFullYear();
  let carnet;
  let existe = true;
  
  // Generar carnet hasta que sea único
  while (existe) {
    const numero = Math.floor(Math.random() * 9000) + 1000; // Número de 4 dígitos
    carnet = `COLEGIO-${año}-${numero}`;
    
    const result = await pool.query('SELECT id FROM estudiantes WHERE carnet = ?', [carnet]);
    existe = result.rows.length > 0;
  }
  
  return carnet;
};

module.exports = { db: pool, initDB, generarCarnetUnico }; 