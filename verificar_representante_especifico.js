const { db, initDB } = require('./src/db');

async function verificarRepresentanteEspecifico() {
    try {
        console.log('🔍 Verificador de representante específico\n');
        
        await initDB();
        
        // Datos a verificar (cambia estos por los que quieres verificar)
        const cedulaAVerificar = '12345678'; // Cambia por la cédula que quieres verificar
        const emailAVerificar = 'ejemplo@email.com'; // Cambia por el email que quieres verificar
        
        console.log(`Verificando cédula: ${cedulaAVerificar}`);
        console.log(`Verificando email: ${emailAVerificar}\n`);
        
        // Verificar cédula
        const cedulaResult = await db.query('SELECT id, cedula, nombre, email FROM representantes WHERE cedula = ?', [cedulaAVerificar]);
        
        if (cedulaResult.rows.length > 0) {
            console.log('❌ CÉDULA YA EXISTE:');
            cedulaResult.rows.forEach(rep => {
                console.log(`   - ID: ${rep.id} | Nombre: ${rep.nombre} | Email: ${rep.email}`);
            });
        } else {
            console.log('✅ Cédula disponible');
        }
        
        // Verificar email
        const emailResult = await db.query('SELECT id, cedula, nombre, email FROM representantes WHERE email = ?', [emailAVerificar]);
        
        if (emailResult.rows.length > 0) {
            console.log('\n❌ EMAIL YA EXISTE:');
            emailResult.rows.forEach(rep => {
                console.log(`   - ID: ${rep.id} | Nombre: ${rep.nombre} | Cédula: ${rep.cedula}`);
            });
        } else {
            console.log('\n✅ Email disponible');
        }
        
        // Resumen
        console.log('\n📊 RESUMEN:');
        if (cedulaResult.rows.length === 0 && emailResult.rows.length === 0) {
            console.log('✅ Puedes registrar este representante sin problemas');
        } else {
            console.log('❌ No puedes registrar este representante - usa datos únicos');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

verificarRepresentanteEspecifico(); 