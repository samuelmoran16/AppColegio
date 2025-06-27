const { db, initDB } = require('./src/db');

async function mostrarCredenciales() {
    try {
        console.log('🔍 Obteniendo credenciales de prueba...\n');
        
        // Inicializar DB
        await initDB();
        
        // Obtener algunos representantes
        const representantes = await db.query('SELECT cedula, nombre, email FROM representantes LIMIT 5');
        
        console.log('👥 REPRESENTANTES (usar cédula + representante123):');
        representantes.rows.forEach((rep, index) => {
            console.log(`   ${index + 1}. ${rep.nombre}`);
            console.log(`      Cédula: ${rep.cedula}`);
            console.log(`      Email: ${rep.email}`);
            console.log(`      Contraseña: representante123\n`);
        });
        
        // Obtener algunos maestros
        const maestros = await db.query('SELECT cedula, nombre, apellido, email, grado_asignado FROM maestros LIMIT 5');
        
        console.log('👨‍🏫 MAESTROS (usar cédula + maestro123):');
        maestros.rows.forEach((maestro, index) => {
            console.log(`   ${index + 1}. ${maestro.nombre} ${maestro.apellido}`);
            console.log(`      Cédula: ${maestro.cedula}`);
            console.log(`      Email: ${maestro.email}`);
            console.log(`      Grado: ${maestro.grado_asignado}`);
            console.log(`      Contraseña: maestro123\n`);
        });
        
        // Obtener algunos estudiantes con sus carnets
        const estudiantes = await db.query('SELECT carnet, nombre, grado, cedula_representante FROM estudiantes LIMIT 10');
        
        console.log('👦 ESTUDIANTES (carnets para generar mensualidades):');
        estudiantes.rows.forEach((est, index) => {
            console.log(`   ${index + 1}. ${est.nombre}`);
            console.log(`      Carnet: ${est.carnet}`);
            console.log(`      Grado: ${est.grado}`);
            console.log(`      Rep. Cédula: ${est.cedula_representante}\n`);
        });
        
        console.log('🔑 ADMINISTRADOR:');
        console.log('   Email: admin@colegio.com');
        console.log('   Contraseña: admin123\n');
        
        console.log('🌐 URL de la aplicación: http://localhost:3000\n');
        
        console.log('📋 INSTRUCCIONES DE PRUEBA:');
        console.log('1. Ve a http://localhost:3000');
        console.log('2. Para probar representantes:');
        console.log('   - Selecciona "Representante"');
        console.log('   - Usa una cédula de arriba');
        console.log('   - Contraseña: representante123');
        console.log('3. Para probar maestros:');
        console.log('   - Selecciona "Maestro"');
        console.log('   - Usa una cédula de arriba');
        console.log('   - Contraseña: maestro123');
        console.log('4. Para generar mensualidades:');
        console.log('   - Inicia sesión como admin');
        console.log('   - Ve a "Generar Mensualidades"');
        console.log('   - Usa cualquier carnet de arriba');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

mostrarCredenciales(); 