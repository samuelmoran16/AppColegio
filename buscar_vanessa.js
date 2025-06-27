const { db, initDB } = require('./src/db');

async function buscarVanessa() {
    try {
        console.log('🔍 Buscando a Vanessa Quiñones...\n');
        
        // Inicializar DB
        await initDB();
        
        // Buscar por nombre
        const result = await db.query(`
            SELECT * FROM representantes 
            WHERE nombre LIKE '%Vanessa%' OR nombre LIKE '%Quiñones%' OR nombre LIKE '%Quinones%'
            ORDER BY id DESC
        `);
        
        console.log(`📊 Resultados encontrados: ${result.rows.length}`);
        
        if (result.rows.length === 0) {
            console.log('❌ No se encontró a Vanessa Quiñones en la base de datos.');
            
            // Mostrar los últimos 5 representantes registrados
            const ultimos = await db.query('SELECT * FROM representantes ORDER BY id DESC LIMIT 5');
            console.log('\n📋 Últimos 5 representantes registrados:');
            ultimos.rows.forEach(rep => {
                console.log(`   - ID: ${rep.id} | ${rep.nombre} | Cédula: ${rep.cedula} | Email: ${rep.email}`);
            });
        } else {
            console.log('✅ Representantes encontrados:');
            result.rows.forEach(rep => {
                console.log(`   - ID: ${rep.id} | ${rep.nombre} | Cédula: ${rep.cedula} | Email: ${rep.email}`);
            });
        }
        
        // Contar total de representantes
        const total = await db.query('SELECT COUNT(*) as total FROM representantes');
        console.log(`\n📈 Total de representantes en la base de datos: ${total.rows[0].total}`);
        
    } catch (error) {
        console.error('❌ Error al buscar:', error.message);
    } finally {
        process.exit(0);
    }
}

buscarVanessa(); 