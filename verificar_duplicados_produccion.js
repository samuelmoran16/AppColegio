const { Pool } = require('pg');

// Configuración para producción (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verificarDuplicadosProduccion() {
  try {
    console.log('🔍 Verificando datos duplicados en producción...\n');
    
    // 1. Verificar representantes duplicados
    console.log('1. Verificando representantes duplicados...');
    const representantesDuplicados = await pool.query(`
      SELECT cedula, email, COUNT(*) as cantidad
      FROM representantes 
      GROUP BY cedula, email 
      HAVING COUNT(*) > 1
    `);
    
    if (representantesDuplicados.rows.length > 0) {
      console.log('❌ Se encontraron representantes duplicados:');
      representantesDuplicados.rows.forEach(row => {
        console.log(`   Cédula: ${row.cedula}, Email: ${row.email}, Cantidad: ${row.cantidad}`);
      });
    } else {
      console.log('✅ No hay representantes duplicados');
    }
    
    // 2. Verificar maestros duplicados
    console.log('\n2. Verificando maestros duplicados...');
    const maestrosDuplicados = await pool.query(`
      SELECT cedula, email, COUNT(*) as cantidad
      FROM maestros 
      GROUP BY cedula, email 
      HAVING COUNT(*) > 1
    `);
    
    if (maestrosDuplicados.rows.length > 0) {
      console.log('❌ Se encontraron maestros duplicados:');
      maestrosDuplicados.rows.forEach(row => {
        console.log(`   Cédula: ${row.cedula}, Email: ${row.email}, Cantidad: ${row.cantidad}`);
      });
    } else {
      console.log('✅ No hay maestros duplicados');
    }
    
    // 3. Verificar estudiantes duplicados
    console.log('\n3. Verificando estudiantes duplicados...');
    const estudiantesDuplicados = await pool.query(`
      SELECT cedula, COUNT(*) as cantidad
      FROM estudiantes 
      WHERE cedula IS NOT NULL
      GROUP BY cedula 
      HAVING COUNT(*) > 1
    `);
    
    if (estudiantesDuplicados.rows.length > 0) {
      console.log('❌ Se encontraron estudiantes duplicados:');
      estudiantesDuplicados.rows.forEach(row => {
        console.log(`   Cédula: ${row.cedula}, Cantidad: ${row.cantidad}`);
      });
    } else {
      console.log('✅ No hay estudiantes duplicados');
    }
    
    // 4. Mostrar resumen final
    console.log('\n📊 Resumen final:');
    const totalRepresentantes = await pool.query('SELECT COUNT(*) FROM representantes');
    const totalMaestros = await pool.query('SELECT COUNT(*) FROM maestros');
    const totalEstudiantes = await pool.query('SELECT COUNT(*) FROM estudiantes');
    
    console.log(`   👥 Representantes: ${totalRepresentantes.rows[0].count}`);
    console.log(`   👨‍🏫 Maestros: ${totalMaestros.rows[0].count}`);
    console.log(`   👦 Estudiantes: ${totalEstudiantes.rows[0].count}`);
    
    // 5. Mostrar algunos ejemplos de datos existentes
    console.log('\n📋 Ejemplos de datos existentes:');
    
    const ejemplosRepresentantes = await pool.query('SELECT cedula, email, nombre FROM representantes LIMIT 5');
    console.log('   Representantes:');
    ejemplosRepresentantes.rows.forEach(row => {
      console.log(`     - ${row.nombre} (${row.cedula}) - ${row.email}`);
    });
    
    const ejemplosMaestros = await pool.query('SELECT cedula, email, nombre, apellido FROM maestros LIMIT 5');
    console.log('   Maestros:');
    ejemplosMaestros.rows.forEach(row => {
      console.log(`     - ${row.nombre} ${row.apellido} (${row.cedula}) - ${row.email}`);
    });
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar solo si estamos en producción
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  verificarDuplicadosProduccion();
} else {
  console.log('❌ Este script solo debe ejecutarse en producción');
  console.log('Para ejecutar en producción, usa:');
  console.log('NODE_ENV=production node verificar_duplicados_produccion.js');
} 