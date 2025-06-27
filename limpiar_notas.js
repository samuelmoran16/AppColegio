const { db, initDB } = require('./src/db');

async function limpiarNotas() {
    try {
        console.log('🧹 Iniciando limpieza de notas...');
        
        // Inicializar DB
        await initDB();
        
        // Contar notas existentes
        const countResult = await db.query('SELECT COUNT(*) as total FROM notas');
        const totalNotas = countResult.rows[0].total;
        
        console.log(`📊 Total de notas a eliminar: ${totalNotas}`);
        
        if (totalNotas === 0) {
            console.log('✅ No hay notas para eliminar. La base de datos ya está limpia.');
            return;
        }
        
        // Eliminar todas las notas
        await db.query('DELETE FROM notas');
        
        console.log('✅ Todas las notas han sido eliminadas exitosamente.');
        console.log(`🗑️ Se eliminaron ${totalNotas} notas de la base de datos.`);
        
        // Verificar que se eliminaron
        const verifyResult = await db.query('SELECT COUNT(*) as total FROM notas');
        const notasRestantes = verifyResult.rows[0].total;
        
        if (notasRestantes === 0) {
            console.log('✅ Verificación exitosa: No quedan notas en la base de datos.');
        } else {
            console.log(`⚠️ Advertencia: Aún quedan ${notasRestantes} notas en la base de datos.`);
        }
        
    } catch (error) {
        console.error('❌ Error al limpiar las notas:', error.message);
    } finally {
        process.exit(0);
    }
}

limpiarNotas(); 