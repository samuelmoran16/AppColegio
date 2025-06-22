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
      carnet VARCHAR(20) UNIQUE NOT NULL,
      nombre VARCHAR(255) NOT NULL,
      cedula VARCHAR(20) UNIQUE,
      fecha_nacimiento DATE,
      grado VARCHAR(50),
      id_representante INTEGER REFERENCES representantes(id)
    )`);

    // Tabla Notas
    await pool.query(`CREATE TABLE IF NOT EXISTS notas (
      id SERIAL PRIMARY KEY,
      id_estudiante INTEGER REFERENCES estudiantes(id),
      materia VARCHAR(255) NOT NULL,
      calificacion DECIMAL(4, 2) NOT NULL,
      periodo VARCHAR(100) NOT NULL
    )`);

    // Migración de la tabla Pagos
    await migrarTablaPagos();

    // Migración de la tabla Estudiantes
    await migrarTablaEstudiantes();

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

// Función para migrar la tabla de pagos
const migrarTablaPagos = async () => {
  try {
    // Verificar si la tabla pagos existe
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
          const carnet = generarCarnetUnico();
          await pool.query('UPDATE estudiantes SET carnet = $1 WHERE id = $2', [carnet, estudiantes.rows[i].id]);
        }
        
        // Hacer la columna NOT NULL
        await pool.query('ALTER TABLE estudiantes ALTER COLUMN carnet SET NOT NULL');
        
        console.log('Tabla de estudiantes migrada correctamente con carnets únicos.');
      } else {
        console.log('Tabla de estudiantes ya tiene la columna carnet.');
      }
    } else {
      console.log('Tabla de estudiantes no existe, se creará con la nueva estructura.');
    }
  } catch (err) {
    console.error('Error migrando tabla de estudiantes:', err);
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
    
    const result = await pool.query('SELECT id FROM estudiantes WHERE carnet = $1', [carnet]);
    existe = result.rows.length > 0;
  }
  
  return carnet;
};

module.exports = { db: pool, initDB, generarCarnetUnico }; 