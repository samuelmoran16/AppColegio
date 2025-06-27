const { db, initDB, generarCedulaRepresentante } = require('./src/db');

async function generarRepresentanteUnico() {
    try {
        console.log('🔍 Generando representante con datos únicos...\n');
        
        await initDB();
        
        // 1. Generar cédula única
        console.log('1. Generando cédula única...');
        const cedula = await generarCedulaRepresentante();
        console.log(`✅ Cédula generada: ${cedula}`);
        
        // 2. Generar email único
        console.log('\n2. Generando email único...');
        let email;
        let emailExiste = true;
        let contador = 1;
        
        while (emailExiste) {
            email = `nuevo.representante${contador}@test.com`;
            
            const emailResult = await db.query('SELECT id FROM representantes WHERE email = ?', [email]);
            emailExiste = emailResult.rows.length > 0;
            
            if (emailExiste) {
                contador++;
            }
        }
        
        console.log(`✅ Email generado: ${email}`);
        
        // 3. Generar nombre único
        console.log('\n3. Generando nombre único...');
        let nombre;
        let nombreExiste = true;
        let contadorNombre = 1;
        
        while (nombreExiste) {
            nombre = `Nuevo Representante ${contadorNombre}`;
            
            const nombreResult = await db.query('SELECT id FROM representantes WHERE nombre = ?', [nombre]);
            nombreExiste = nombreResult.rows.length > 0;
            
            if (nombreExiste) {
                contadorNombre++;
            }
        }
        
        console.log(`✅ Nombre generado: ${nombre}`);
        
        // 4. Mostrar datos para registro
        console.log('\n📋 DATOS PARA REGISTRAR NUEVO REPRESENTANTE:');
        console.log('=' .repeat(50));
        console.log(`Cédula: ${cedula}`);
        console.log(`Nombre: ${nombre}`);
        console.log(`Email: ${email}`);
        console.log(`Contraseña: test123456`);
        console.log('=' .repeat(50));
        
        // 5. Preguntar si quiere registrarlo automáticamente
        console.log('\n❓ ¿Deseas registrar este representante automáticamente? (s/n)');
        
        // Simular entrada del usuario (en un entorno real usarías readline)
        const registrarAutomaticamente = false; // Cambiar a true si quieres registro automático
        
        if (registrarAutomaticamente) {
            console.log('\n🔄 Registrando representante automáticamente...');
            
            const password = 'test123456';
            const bcrypt = require('bcrypt');
            const hash = await bcrypt.hash(password, 10);
            
            const result = await db.query(
                'INSERT INTO representantes (cedula, nombre, email, password) VALUES (?, ?, ?, ?) RETURNING *',
                [cedula, nombre, email, hash]
            );
            
            console.log('✅ Representante registrado exitosamente!');
            console.log(`   ID: ${result.rows[0].id}`);
        } else {
            console.log('\n💡 Usa estos datos en el formulario de registro del panel de administrador.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

generarRepresentanteUnico(); 