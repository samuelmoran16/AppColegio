const { db } = require('./src/db');

async function limpiarBaseDatos() {
    try {
        console.log('🧹 Limpiando base de datos...');
        
        // Eliminar datos en orden correcto (por las foreign keys)
        await db.query('DELETE FROM notas');
        console.log('✅ Notas eliminadas');
        
        await db.query('DELETE FROM pagos');
        console.log('✅ Pagos eliminados');
        
        await db.query('DELETE FROM estudiantes');
        console.log('✅ Estudiantes eliminados');
        
        await db.query('DELETE FROM representantes');
        console.log('✅ Representantes eliminados');
        
        await db.query('DELETE FROM maestros');
        console.log('✅ Maestros eliminados');
        
        // Reiniciar contadores de auto-incremento (solo para SQLite)
        await db.query('DELETE FROM sqlite_sequence');
        console.log('✅ Contadores reiniciados');
        
        console.log('\n🎉 Base de datos limpiada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error limpiando base de datos:', error);
    } finally {
        process.exit(0);
    }
}

limpiarBaseDatos(); 