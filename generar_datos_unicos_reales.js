const { db, initDB } = require('./src/db');

async function generarDatosUnicosReales() {
    try {
        console.log('🔍 Generando datos completamente únicos...\n');
        
        await initDB();
        
        // Generar cédula única
        let cedulaUnica;
        let cedulaExiste = true;
        let contadorCedula = 1;
        
        while (cedulaExiste) {
            cedulaUnica = Math.floor(Math.random() * 90000000) + 10000000; // 7-8 dígitos
            const cedulaResult = await db.query('SELECT id FROM representantes WHERE cedula = ?', [cedulaUnica.toString()]);
            cedulaExiste = cedulaResult.rows.length > 0;
            contadorCedula++;
            
            if (contadorCedula > 100) {
                console.log('❌ No se pudo generar cédula única después de 100 intentos');
                return;
            }
        }
        
        // Generar email único
        let emailUnico;
        let emailExiste = true;
        let contadorEmail = 1;
        
        while (emailExiste) {
            emailUnico = `nuevo.representante.${Date.now()}.${contadorEmail}@test.com`;
            const emailResult = await db.query('SELECT id FROM representantes WHERE email = ?', [emailUnico]);
            emailExiste = emailResult.rows.length > 0;
            contadorEmail++;
            
            if (contadorEmail > 100) {
                console.log('❌ No se pudo generar email único después de 100 intentos');
                return;
            }
        }
        
        console.log('✅ Datos únicos generados:');
        console.log(`   Cédula: ${cedulaUnica}`);
        console.log(`   Email: ${emailUnico}`);
        console.log(`   Nombre: Nuevo Representante Único`);
        console.log(`   Contraseña: test123456`);
        
        console.log('\n📋 Puedes usar estos datos en el formulario de registro del panel de administrador.');
        console.log('🔒 Estos datos son completamente únicos y no existen en la base de datos.');
        
    } catch (err) {
        console.error('Error generando datos únicos:', err);
    } finally {
        process.exit(0);
    }
}

generarDatosUnicosReales(); 