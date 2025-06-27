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
        cedula VARCHAR(8) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS maestros (
        id SERIAL PRIMARY KEY,
        cedula VARCHAR(8) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        apellido VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        grado_asignado VARCHAR(50) NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS estudiantes (
        id SERIAL PRIMARY KEY,
        carnet VARCHAR(20) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        cedula VARCHAR(20),
        fecha_nacimiento DATE,
        grado VARCHAR(50),
        cedula_representante VARCHAR(8) REFERENCES representantes(cedula)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS notas (
        id SERIAL PRIMARY KEY,
        id_estudiante INTEGER REFERENCES estudiantes(id),
        materia VARCHAR(255) NOT NULL,
        calificacion VARCHAR(10) NOT NULL,
        periodo VARCHAR(100) NOT NULL,
        tipo_calificacion VARCHAR(10) DEFAULT 'numerica' CHECK (tipo_calificacion IN ('numerica', 'letra'))
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS pagos (
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
        cedula TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS maestros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cedula TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        apellido TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        grado_asignado TEXT NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS estudiantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        carnet TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        cedula TEXT,
        fecha_nacimiento TEXT,
        grado TEXT,
        cedula_representante TEXT REFERENCES representantes(cedula)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS notas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_estudiante INTEGER REFERENCES estudiantes(id),
        materia TEXT NOT NULL,
        calificacion TEXT NOT NULL,
        periodo TEXT NOT NULL,
        tipo_calificacion TEXT DEFAULT 'numerica' CHECK (tipo_calificacion IN ('numerica', 'letra'))
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS pagos (
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
    }

    // Migración de la tabla Pagos
    await migrarTablaPagos();

    // Migración de la tabla Representantes
    await migrarTablaRepresentantes();

    // Migración de la tabla Estudiantes
    await migrarTablaEstudiantes();

    // Migración de la tabla Notas
    await migrarTablaNotas();

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
        
        // Migrar la columna id_representante a cedula_representante
        await migrarRepresentanteEstudiante();
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
        
        // Migrar la columna id_representante a cedula_representante
        await migrarRepresentanteEstudiante();
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

// Función para generar cédula única de representante
const generarCedulaRepresentante = async () => {
  let cedula;
  let existe = true;
  const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
  
  // Generar cédula hasta que sea única
  while (existe) {
    cedula = Math.floor(Math.random() * 90000000) + 10000000; // Número de 7 u 8 dígitos
    cedula = cedula.toString();
    
    if (isProduction) {
      const result = await pool.query('SELECT id FROM representantes WHERE cedula = $1', [cedula]);
      existe = result.rows.length > 0;
    } else {
      const result = await pool.query('SELECT id FROM representantes WHERE cedula = ?', [cedula]);
      existe = result.rows.length > 0;
    }
  }
  
  return cedula;
};

// Función para generar carnet único
const generarCarnetUnico = async () => {
  let carnet;
  let existe = true;
  const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
  
  // Generar carnet de 6 dígitos hasta que sea único
  while (existe) {
    carnet = Math.floor(100000 + Math.random() * 900000).toString(); // Número de 6 dígitos (100000-999999)
    
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

// Función para migrar la tabla de representantes y añadir cédulas únicas
const migrarTablaRepresentantes = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    
    if (isProduction) {
      // PostgreSQL - Producción
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'representantes'
        );
      `);

      if (tableExists.rows[0].exists) {
        // La tabla existe, verificar si tiene la columna cedula
        const columns = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'representantes' 
          AND table_schema = 'public'
        `);
        
        const columnNames = columns.rows.map(row => row.column_name);
        
        // Si no tiene la columna cedula, añadirla
        if (!columnNames.includes('cedula')) {
          console.log('Migrando tabla de representantes para añadir cédulas...');
          
          // Añadir la columna cedula
          await pool.query('ALTER TABLE representantes ADD COLUMN cedula VARCHAR(8) UNIQUE');
          
          // Generar cédulas para representantes existentes
          const representantes = await pool.query('SELECT id FROM representantes ORDER BY id');
          for (let i = 0; i < representantes.rows.length; i++) {
            const cedula = await generarCedulaRepresentante();
            await pool.query('UPDATE representantes SET cedula = $1 WHERE id = $2', [cedula, representantes.rows[i].id]);
          }
          
          // Hacer la columna NOT NULL
          await pool.query('ALTER TABLE representantes ALTER COLUMN cedula SET NOT NULL');
          
          console.log('Tabla de representantes migrada correctamente con cédulas únicas.');
        } else {
          console.log('Tabla de representantes ya tiene la columna cedula.');
        }
      } else {
        console.log('Tabla de representantes no existe, se creará con la nueva estructura.');
      }
    } else {
      // SQLite - Desarrollo
      const tableExists = await pool.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='representantes'
      `);

      if (tableExists.rows.length > 0) {
        // La tabla existe, verificar si tiene la columna cedula
        const columns = await pool.query(`
          PRAGMA table_info(representantes)
        `);
        
        const columnNames = columns.rows.map(row => row.name);
        
        // Si no tiene la columna cedula, recrear la tabla correctamente
        if (!columnNames.includes('cedula')) {
          console.log('Migrando tabla de representantes para añadir cédulas (recreando tabla en SQLite)...');
          // 1. Renombrar la tabla original
          await pool.query('ALTER TABLE representantes RENAME TO representantes_old');
          // 2. Crear la nueva tabla con la columna cedula UNIQUE
          await pool.query(`CREATE TABLE representantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cedula TEXT UNIQUE,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
          )`);
          // 3. Copiar los datos de la tabla vieja a la nueva (sin cédula)
          const reps = await pool.query('SELECT id, nombre, email, password FROM representantes_old ORDER BY id');
          for (let i = 0; i < reps.rows.length; i++) {
            const cedula = await generarCedulaRepresentante();
            await pool.query('INSERT INTO representantes (id, cedula, nombre, email, password) VALUES (?, ?, ?, ?, ?)', [
              reps.rows[i].id, cedula, reps.rows[i].nombre, reps.rows[i].email, reps.rows[i].password
            ]);
          }
          // 4. Eliminar la tabla vieja
          await pool.query('DROP TABLE representantes_old');
          console.log('Tabla de representantes migrada correctamente con cédulas únicas.');
        } else {
          console.log('Tabla de representantes ya tiene la columna cedula.');
        }
      } else {
        console.log('Tabla de representantes no existe, se creará con la nueva estructura.');
      }
    }
  } catch (err) {
    console.error('Error migrando tabla de representantes:', err);
    throw err;
  }
};

// Función para migrar la columna id_representante a cedula_representante
const migrarRepresentanteEstudiante = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    
    if (isProduction) {
      // PostgreSQL - Verificar si la columna cedula_representante existe
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'estudiantes' 
        AND table_schema = 'public'
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      
      if (!columnNames.includes('cedula_representante')) {
        console.log('Migrando tabla de estudiantes para usar cedula_representante...');
        
        // Añadir la columna cedula_representante
        await pool.query('ALTER TABLE estudiantes ADD COLUMN cedula_representante VARCHAR(8) REFERENCES representantes(cedula)');
        
        // Migrar datos existentes
        const estudiantes = await pool.query('SELECT id, id_representante FROM estudiantes WHERE id_representante IS NOT NULL');
        for (let i = 0; i < estudiantes.rows.length; i++) {
          const repResult = await pool.query('SELECT cedula FROM representantes WHERE id = $1', [estudiantes.rows[i].id_representante]);
          if (repResult.rows.length > 0) {
            await pool.query('UPDATE estudiantes SET cedula_representante = $1 WHERE id = $2', 
              [repResult.rows[0].cedula, estudiantes.rows[i].id]);
          }
        }
        
        // Eliminar la columna id_representante
        await pool.query('ALTER TABLE estudiantes DROP COLUMN id_representante');
        
        console.log('Tabla de estudiantes migrada correctamente para usar cedula_representante.');
      } else {
        console.log('Tabla de estudiantes ya tiene la columna cedula_representante.');
      }
    } else {
      // SQLite - Recrear la tabla
      const columns = await pool.query(`
        PRAGMA table_info(estudiantes)
      `);
      
      const columnNames = columns.rows.map(row => row.name);
      
      if (!columnNames.includes('cedula_representante')) {
        console.log('Migrando tabla de estudiantes para usar cedula_representante (recreando tabla en SQLite)...');
        
        // 1. Renombrar la tabla original
        await pool.query('ALTER TABLE estudiantes RENAME TO estudiantes_old');
        
        // 2. Crear la nueva tabla con cedula_representante
        await pool.query(`CREATE TABLE estudiantes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          carnet TEXT UNIQUE NOT NULL,
          nombre TEXT NOT NULL,
          cedula TEXT,
          fecha_nacimiento TEXT,
          grado TEXT,
          cedula_representante TEXT REFERENCES representantes(cedula)
        )`);
        
        // 3. Copiar los datos de la tabla vieja a la nueva
        const estudiantes = await pool.query('SELECT id, carnet, nombre, cedula, fecha_nacimiento, grado, id_representante FROM estudiantes_old ORDER BY id');
        for (let i = 0; i < estudiantes.rows.length; i++) {
          const est = estudiantes.rows[i];
          let cedulaRep = null;
          
          if (est.id_representante) {
            const repResult = await pool.query('SELECT cedula FROM representantes WHERE id = ?', [est.id_representante]);
            if (repResult.rows.length > 0) {
              cedulaRep = repResult.rows[0].cedula;
            }
          }
          
          await pool.query(
            'INSERT INTO estudiantes (id, carnet, nombre, cedula, fecha_nacimiento, grado, cedula_representante) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [est.id, est.carnet, est.nombre, est.cedula, est.fecha_nacimiento, est.grado, cedulaRep]
          );
        }
        
        // 4. Eliminar la tabla vieja
        await pool.query('DROP TABLE estudiantes_old');
        
        console.log('Tabla de estudiantes migrada correctamente para usar cedula_representante.');
      } else {
        console.log('Tabla de estudiantes ya tiene la columna cedula_representante.');
      }
    }
  } catch (err) {
    console.error('Error migrando tabla de estudiantes para cedula_representante:', err);
    throw err;
  }
};

// Función para migrar la tabla de notas para soportar calificaciones con letras
const migrarTablaNotas = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
    
    if (isProduction) {
      // PostgreSQL - Verificar si la columna tipo_calificacion existe
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notas' 
        AND table_schema = 'public'
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      
      if (!columnNames.includes('tipo_calificacion')) {
        console.log('Migrando tabla de notas para soportar calificaciones con letras...');
        
        // Añadir la columna tipo_calificacion
        await pool.query('ALTER TABLE notas ADD COLUMN tipo_calificacion VARCHAR(10) DEFAULT \'numerica\'');
        
        // Cambiar el tipo de calificacion de DECIMAL a VARCHAR
        await pool.query('ALTER TABLE notas ALTER COLUMN calificacion TYPE VARCHAR(10)');
        
        console.log('Tabla de notas migrada correctamente para soportar calificaciones con letras.');
      } else {
        console.log('Tabla de notas ya tiene soporte para calificaciones con letras.');
      }
    } else {
      // SQLite - Recrear la tabla
      const tableExists = await pool.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='notas'
      `);

      if (tableExists.rows.length > 0) {
        const columns = await pool.query(`
          PRAGMA table_info(notas)
        `);
        
        const columnNames = columns.rows.map(row => row.name);
        
        if (!columnNames.includes('tipo_calificacion')) {
          console.log('Migrando tabla de notas para soportar calificaciones con letras (recreando tabla en SQLite)...');
          
          // 1. Renombrar la tabla original
          await pool.query('ALTER TABLE notas RENAME TO notas_old');
          
          // 2. Crear la nueva tabla con soporte para letras
          await pool.query(`CREATE TABLE notas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_estudiante INTEGER REFERENCES estudiantes(id),
            materia TEXT NOT NULL,
            calificacion TEXT NOT NULL,
            periodo TEXT NOT NULL,
            tipo_calificacion TEXT DEFAULT 'numerica' CHECK (tipo_calificacion IN ('numerica', 'letra'))
          )`);
          
          // 3. Copiar los datos de la tabla vieja a la nueva
          const notas = await pool.query('SELECT id, id_estudiante, materia, calificacion, periodo FROM notas_old ORDER BY id');
          for (let i = 0; i < notas.rows.length; i++) {
            const nota = notas.rows[i];
            await pool.query(
              'INSERT INTO notas (id, id_estudiante, materia, calificacion, periodo, tipo_calificacion) VALUES (?, ?, ?, ?, ?, ?)',
              [nota.id, nota.id_estudiante, nota.materia, nota.calificacion, nota.periodo, 'numerica']
            );
          }
          
          // 4. Eliminar la tabla vieja
          await pool.query('DROP TABLE notas_old');
          
          console.log('Tabla de notas migrada correctamente para soportar calificaciones con letras.');
        } else {
          console.log('Tabla de notas ya tiene soporte para calificaciones con letras.');
        }
      } else {
        console.log('Tabla de notas no existe, se creará con la nueva estructura.');
      }
    }
  } catch (err) {
    console.error('Error migrando tabla de notas:', err);
    throw err;
  }
};

module.exports = { db: pool, initDB, generarCarnetUnico, generarCedulaRepresentante }; 