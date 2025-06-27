const { db, initDB } = require('./src/db');

async function buscarRepresentante() {
    try {
        console.log('🔍 Buscando representante de Andrés Torres de 1er grado...\n');
        
        // Inicializar DB
        await initDB();
        
        // Buscar al estudiante Andrés Torres de 1er grado
        const estudianteResult = await db.query(`
            SELECT e.id, e.nombre, e.carnet, e.grado, e.cedula_representante, r.nombre as nombre_representante, r.cedula, r.email
            FROM estudiantes e
            LEFT JOIN representantes r ON e.cedula_representante = r.cedula
            WHERE e.nombre LIKE '%Andrés%' AND e.nombre LIKE '%Torres%' AND e.grado = '1er Grado'
        `);
        
        if (estudianteResult.rows.length === 0) {
            console.log('❌ No se encontró ningún estudiante llamado Andrés Torres en 1er Grado.');
            
            // Buscar estudiantes similares
            const similaresResult = await db.query(`
                SELECT nombre, carnet, grado, cedula_representante
                FROM estudiantes 
                WHERE (nombre LIKE '%Andrés%' OR nombre LIKE '%Torres%') AND grado = '1er Grado'
                ORDER BY nombre
            `);
            
            if (similaresResult.rows.length > 0) {
                console.log('📋 Estudiantes similares encontrados en 1er Grado:');
                similaresResult.rows.forEach(est => {
                    console.log(`   - ${est.nombre} (Carnet: ${est.carnet})`);
                });
            }
            return;
        }
        
        const estudiante = estudianteResult.rows[0];
        
        console.log('✅ Estudiante encontrado:');
        console.log(`   Nombre: ${estudiante.nombre}`);
        console.log(`   Carnet: ${estudiante.carnet}`);
        console.log(`   Grado: ${estudiante.grado}`);
        console.log(`   Cédula del Representante: ${estudiante.cedula_representante || 'No asignado'}`);
        
        if (estudiante.nombre_representante) {
            console.log('\n👥 Información del Representante:');
            console.log(`   Nombre: ${estudiante.nombre_representante}`);
            console.log(`   Cédula: ${estudiante.cedula}`);
            console.log(`   Email: ${estudiante.email}`);
        } else {
            console.log('\n❌ No se encontró información del representante.');
            
            // Buscar si existe un representante con esa cédula
            if (estudiante.cedula_representante) {
                const repResult = await db.query('SELECT * FROM representantes WHERE cedula = ?', [estudiante.cedula_representante]);
                if (repResult.rows.length > 0) {
                    const rep = repResult.rows[0];
                    console.log('\n🔍 Representante encontrado en la tabla de representantes:');
                    console.log(`   Nombre: ${rep.nombre}`);
                    console.log(`   Cédula: ${rep.cedula}`);
                    console.log(`   Email: ${rep.email}`);
                } else {
                    console.log('\n⚠️ La cédula del representante no existe en la tabla de representantes.');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error al buscar:', error.message);
    } finally {
        process.exit(0);
    }
}

buscarRepresentante(); 