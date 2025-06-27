const { db, initDB, generarCarnetUnico } = require('./src/db');

async function migrarCarnets() {
    try {
        console.log('🔄 Iniciando migración de carnets...');
        
        // Inicializar DB
        await initDB();
        
        // Obtener todos los estudiantes
        const estudiantes = await db.query('SELECT id, carnet, nombre FROM estudiantes ORDER BY id');
        
        console.log(`📊 Total de estudiantes a migrar: ${estudiantes.rows.length}`);
        
        let migrados = 0;
        let errores = 0;
        
        for (let i = 0; i < estudiantes.rows.length; i++) {
            const estudiante = estudiantes.rows[i];
            
            try {
                // Generar nuevo carnet de 6 dígitos
                const nuevoCarnet = await generarCarnetUnico();
                
                // Actualizar el carnet
                await db.query('UPDATE estudiantes SET carnet = ? WHERE id = ?', [nuevoCarnet, estudiante.id]);
                
                console.log(`✅ ${estudiante.nombre}: ${estudiante.carnet} → ${nuevoCarnet}`);
                migrados++;
                
            } catch (error) {
                console.error(`❌ Error migrando ${estudiante.nombre}:`, error.message);
                errores++;
            }
        }
        
        console.log('\n🎉 Migración completada!');
        console.log(`📊 Resumen:`);
        console.log(`   ✅ Migrados: ${migrados}`);
        console.log(`   ❌ Errores: ${errores}`);
        console.log(`   📝 Total: ${estudiantes.rows.length}`);
        
        // Verificar que todos tienen carnets únicos
        const verificar = await db.query('SELECT carnet, COUNT(*) as total FROM estudiantes GROUP BY carnet HAVING COUNT(*) > 1');
        if (verificar.rows.length > 0) {
            console.log('\n⚠️ ADVERTENCIA: Se encontraron carnets duplicados!');
            verificar.rows.forEach(row => {
                console.log(`   Carnet ${row.carnet}: ${row.total} estudiantes`);
            });
        } else {
            console.log('\n✅ Todos los carnets son únicos');
        }
        
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
    } finally {
        process.exit(0);
    }
}

migrarCarnets(); 