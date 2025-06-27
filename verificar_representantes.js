const { db, initDB } = require('./src/db');

async function verificarRepresentantes() {
    try {
        console.log('🔍 Verificando representantes existentes...\n');
        
        await initDB();
        
        const result = await db.query('SELECT id, cedula, nombre, email FROM representantes ORDER BY id');
        
        console.log(`📊 Total de representantes: ${result.rows.length}\n`);
        
        if (result.rows.length === 0) {
            console.log('❌ No hay representantes registrados.');
        } else {
            console.log('📋 Lista de representantes:');
            result.rows.forEach((rep, index) => {
                console.log(`${index + 1}. ID: ${rep.id} | Cédula: ${rep.cedula} | Nombre: ${rep.nombre} | Email: ${rep.email}`);
            });
        }
        
        // Verificar también maestros para ver si hay conflictos
        console.log('\n🔍 Verificando maestros existentes...');
        const maestros = await db.query('SELECT id, cedula, nombre, apellido, email FROM maestros ORDER BY id');
        console.log(`📊 Total de maestros: ${maestros.rows.length}`);
        
        if (maestros.rows.length > 0) {
            console.log('📋 Lista de maestros:');
            maestros.rows.forEach((maestro, index) => {
                console.log(`${index + 1}. ID: ${maestro.id} | Cédula: ${maestro.cedula} | Nombre: ${maestro.nombre} ${maestro.apellido} | Email: ${maestro.email}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

verificarRepresentantes(); 