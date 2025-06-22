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
    // Determinar si estamos en producción (PostgreSQL) o desarrollo (SQLite)
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    
    if (isProduction) {
      // PostgreSQL - Producción
      await pool.query(`CREATE TABLE IF NOT EXISTS administradores (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS representantes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS estudiantes (
        id SERIAL PRIMARY KEY,
        carnet VARCHAR(20) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        cedula VARCHAR(20),
        fecha_nacimiento DATE,
        grado VARCHAR(50),
        id_representante INTEGER REFERENCES representantes(id)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS notas (
        id SERIAL PRIMARY KEY,
        id_estudiante INTEGER REFERENCES estudiantes(id),
        materia VARCHAR(255) NOT NULL,
        calificacion DECIMAL(4, 2) NOT NULL,
        periodo VARCHAR(100) NOT NULL
      )`);
    } else {
      // SQLite - Desarrollo
      await pool.query(`CREATE TABLE IF NOT EXISTS administradores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS representantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS estudiantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        carnet TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        cedula TEXT,
        fecha_nacimiento TEXT,
        grado TEXT,
        id_representante INTEGER REFERENCES representantes(id)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS notas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_estudiante INTEGER REFERENCES estudiantes(id),
        materia TEXT NOT NULL,
        calificacion REAL NOT NULL,
        periodo TEXT NOT NULL
      )`);
    }

    // Migración de la tabla Pagos
    await migrarTablaPagos();

    // Migración de la tabla Estudiantes
    await migrarTablaEstudiantes();

    // Insertar admin por defecto si no existe
    const adminEmail = 'admin@colegio.com';
    const adminQuery = isProduction ? 
        'SELECT * FROM administradores WHERE email = $1' : 
        'SELECT * FROM administradores WHERE email = ?';
    
    const res = await pool.query(adminQuery, [adminEmail]);
    if (res.rowCount === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      const insertQuery = isProduction ? 
          'INSERT INTO administradores (nombre, email, password) VALUES ($1, $2, $3)' :
          'INSERT INTO administradores (nombre, email, password) VALUES (?, ?, ?)';
      
      await pool.query(insertQuery, ['Administrador', adminEmail, hash]);
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
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    
    if (isProduction) {
      // PostgreSQL - Producción
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'pagos'
        );
      `);

      if (tableExists.rows[0].exists) {
        // La tabla existe, verificar si tiene las columnas nuevas
        const columns = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'pagos' 
          AND table_schema = 'public'
        `);
        
        const columnNames = columns.rows.map(row => row.column_name);
        
        // Si no tiene las columnas nuevas, eliminar la tabla y recrearla
        if (!columnNames.includes('mes') || !columnNames.includes('año')) {
          console.log('Migrando tabla de pagos...');
          await pool.query('DROP TABLE IF EXISTS pagos CASCADE');
          
          // Crear la nueva tabla con la estructura correcta
          await pool.query(`CREATE TABLE pagos (
            id SERIAL PRIMARY KEY,
            id_estudiante INTEGER REFERENCES estudiantes(id),
            monto DECIMAL(10, 2) NOT NULL DEFAULT 12480.00,
            mes INTEGER NOT NULL CHECK (mes >= 9 OR mes <= 8),
            año INTEGER NOT NULL CHECK (año = 2025),
            fecha_pago DATE,
            estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
            fecha_vencimiento DATE NOT NULL,
            concepto TEXT DEFAULT 'Mensualidad escolar'
          )`);
          
          console.log('Tabla de pagos migrada correctamente.');
        } else {
          console.log('Tabla de pagos ya tiene la estructura correcta.');
        }
      } else {
        // La tabla no existe, crearla con la estructura correcta
        await pool.query(`CREATE TABLE pagos (
          id SERIAL PRIMARY KEY,
          id_estudiante INTEGER REFERENCES estudiantes(id),
          monto DECIMAL(10, 2) NOT NULL DEFAULT 12480.00,
          mes INTEGER NOT NULL CHECK (mes >= 9 OR mes <= 8),
          año INTEGER NOT NULL CHECK (año = 2025),
          fecha_pago DATE,
          estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
          fecha_vencimiento DATE NOT NULL,
          concepto TEXT DEFAULT 'Mensualidad escolar'
        )`);
        
        console.log('Tabla de pagos creada correctamente.');
      }
    } else {
      // SQLite - Desarrollo
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
    }
  } catch (err) {
    console.error('Error migrando tabla de pagos:', err);
    throw err;
  }
};

// Función para migrar la tabla de estudiantes y añadir carnets únicos
const migrarTablaEstudiantes = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    
    if (isProduction) {
      // PostgreSQL - Producción
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'estudiantes'
        );
      `);

      if (tableExists.rows[0].exists) {
        // La tabla existe, verificar si tiene la columna carnet
        const columns = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'estudiantes' 
          AND table_schema = 'public'
        `);
        
        const columnNames = columns.rows.map(row => row.column_name);
        
        // Si no tiene la columna carnet, añadirla
        if (!columnNames.includes('carnet')) {
          console.log('Migrando tabla de estudiantes para añadir carnets...');
          
          // Añadir la columna carnet
          await pool.query('ALTER TABLE estudiantes ADD COLUMN carnet VARCHAR(20) UNIQUE');
          
          // Generar carnets para estudiantes existentes
          const estudiantes = await pool.query('SELECT id FROM estudiantes ORDER BY id');
          for (let i = 0; i < estudiantes.rows.length; i++) {
            const carnet = await generarCarnetUnico();
            await pool.query('UPDATE estudiantes SET carnet = $1 WHERE id = $2', [carnet, estudiantes.rows[i].id]);
          }
          
          // Hacer la columna NOT NULL
          await pool.query('ALTER TABLE estudiantes ALTER COLUMN carnet SET NOT NULL');
          
          console.log('Tabla de estudiantes migrada correctamente con carnets únicos.');
        } else {
          console.log('Tabla de estudiantes ya tiene la columna carnet.');
        }
        
        // Migrar la columna cedula para hacerla opcional
        await migrarCedulaOpcional();
      } else {
        console.log('Tabla de estudiantes no existe, se creará con la nueva estructura.');
      }
    } else {
      // SQLite - Desarrollo
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
    }
  } catch (err) {
    console.error('Error migrando tabla de estudiantes:', err);
    throw err;
  }
};

// Función para migrar la cédula a opcional
const migrarCedulaOpcional = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    
    if (isProduction) {
      // PostgreSQL - Verificar si la columna cedula tiene restricción UNIQUE
      const constraints = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'estudiantes' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%cedula%'
      `);
      
      if (constraints.rows.length > 0) {
        console.log('Migrando columna cedula para hacerla opcional...');
        
        // Eliminar la restricción UNIQUE de cedula
        for (let constraint of constraints.rows) {
          await pool.query(`ALTER TABLE estudiantes DROP CONSTRAINT ${constraint.constraint_name}`);
        }
        
        console.log('Columna cedula migrada correctamente a opcional.');
      } else {
        console.log('Columna cedula ya es opcional.');
      }
    } else {
      // SQLite - Las columnas son opcionales por defecto
      console.log('Columna cedula ya es opcional en SQLite.');
    }
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
  const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
  
  // Generar carnet hasta que sea único
  while (existe) {
    const numero = Math.floor(Math.random() * 9000) + 1000; // Número de 4 dígitos
    carnet = `COLEGIO-${año}-${numero}`;
    
    if (isProduction) {
      const result = await pool.query('SELECT id FROM estudiantes WHERE carnet = $1', [carnet]);
      existe = result.rows.length > 0;
    } else {
      const result = await pool.query('SELECT id FROM estudiantes WHERE carnet = ?', [carnet]);
      existe = result.rows.length > 0;
    }
  }
  
  return carnet;
};

module.exports = { db: pool, initDB, generarCarnetUnico }; 