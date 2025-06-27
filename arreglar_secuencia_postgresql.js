const { Pool } = require('pg');

// Configuración para producción (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function arreglarSecuenciaPostgreSQL() {
  try {
    console.log('🔧 Arreglando secuencias de auto-incremento en PostgreSQL...\n');
    
    // 1. Arreglar secuencia de representantes
    console.log('1. Arreglando secuencia de representantes...');
    await pool.query(`
      SELECT setval('representantes_id_seq', (SELECT MAX(id) FROM representantes));
    `);
    console.log('✅ Secuencia de representantes arreglada');
    
    // 2. Arreglar secuencia de maestros
    console.log('\n2. Arreglando secuencia de maestros...');
    await pool.query(`
      SELECT setval('maestros_id_seq', (SELECT MAX(id) FROM maestros));
    `);
    console.log('✅ Secuencia de maestros arreglada');
    
    // 3. Arreglar secuencia de estudiantes
    console.log('\n3. Arreglando secuencia de estudiantes...');
    await pool.query(`
      SELECT setval('estudiantes_id_seq', (SELECT MAX(id) FROM estudiantes));
    `);
    console.log('✅ Secuencia de estudiantes arreglada');
    
    // 4. Verificar valores actuales
    console.log('\n📊 Verificando valores actuales de las secuencias:');
    
    const representantesSeq = await pool.query("SELECT currval('representantes_id_seq') as current_value");
    const maestrosSeq = await pool.query("SELECT currval('maestros_id_seq') as current_value");
    const estudiantesSeq = await pool.query("SELECT currval('estudiantes_id_seq') as current_value");
    
    console.log(`   Representantes: ${representantesSeq.rows[0].current_value}`);
    console.log(`   Maestros: ${maestrosSeq.rows[0].current_value}`);
    console.log(`   Estudiantes: ${estudiantesSeq.rows[0].current_value}`);
    
    // 5. Verificar máximos valores en las tablas
    console.log('\n📋 Verificando máximos valores en las tablas:');
    
    const maxRepresentantes = await pool.query("SELECT MAX(id) as max_id FROM representantes");
    const maxMaestros = await pool.query("SELECT MAX(id) as max_id FROM maestros");
    const maxEstudiantes = await pool.query("SELECT MAX(id) as max_id FROM estudiantes");
    
    console.log(`   Máximo ID en representantes: ${maxRepresentantes.rows[0].max_id}`);
    console.log(`   Máximo ID en maestros: ${maxMaestros.rows[0].max_id}`);
    console.log(`   Máximo ID en estudiantes: ${maxEstudiantes.rows[0].max_id}`);
    
    console.log('\n✅ Secuencias arregladas correctamente. Ahora deberías poder registrar nuevos usuarios sin problemas.');
    
  } catch (error) {
    console.error('❌ Error arreglando secuencias:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar solo si estamos en producción
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  arreglarSecuenciaPostgreSQL();
} else {
  console.log('❌ Este script solo debe ejecutarse en producción');
  console.log('Para ejecutar en producción, usa:');
  console.log('NODE_ENV=production node arreglar_secuencia_postgresql.js');
} 