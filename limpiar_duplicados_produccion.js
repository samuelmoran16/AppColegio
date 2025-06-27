const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configuración para producción (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function limpiarDuplicadosProduccion() {
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
      
      // Limpiar duplicados de representantes
      console.log('\n🧹 Limpiando representantes duplicados...');
      await pool.query(`
        DELETE FROM representantes 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM representantes 
          GROUP BY cedula, email
        )
      `);
      console.log('✅ Representantes duplicados eliminados');
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
      
      // Limpiar duplicados de maestros
      console.log('\n🧹 Limpiando maestros duplicados...');
      await pool.query(`
        DELETE FROM maestros 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM maestros 
          GROUP BY cedula, email
        )
      `);
      console.log('✅ Maestros duplicados eliminados');
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
      
      // Limpiar duplicados de estudiantes
      console.log('\n🧹 Limpiando estudiantes duplicados...');
      await pool.query(`
        DELETE FROM estudiantes 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM estudiantes 
          WHERE cedula IS NOT NULL
          GROUP BY cedula
        )
        AND cedula IS NOT NULL
      `);
      console.log('✅ Estudiantes duplicados eliminados');
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
    
    console.log('\n✅ Limpieza completada. Ahora deberías poder registrar nuevos usuarios sin problemas.');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar solo si estamos en producción
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  limpiarDuplicadosProduccion();
} else {
  console.log('❌ Este script solo debe ejecutarse en producción');
  console.log('Para ejecutar en producción, usa:');
  console.log('NODE_ENV=production node limpiar_duplicados_produccion.js');
} 