const { db } = require('./src/db');
const bcrypt = require('bcrypt');

async function crearMaestroPrueba() {
    try {
        console.log('Creando maestro de prueba...');
        
        const hash = await bcrypt.hash('maestro123', 10);
        
        const result = await db.query(`
            INSERT INTO maestros (cedula, nombre, apellido, email, password, grado_asignado) 
            VALUES (?, ?, ?, ?, ?, ?) 
            RETURNING id, cedula, nombre, apellido, email, grado_asignado
        `, ['12345678', 'María', 'González', 'maria.gonzalez@colegio.com', hash, '1er Grado']);
        
        console.log('✅ Maestro de prueba creado exitosamente:');
        console.log('   Email: maria.gonzalez@colegio.com');
        console.log('   Contraseña: maestro123');
        console.log('   Grado asignado: 1er Grado');
        console.log('   Cédula: 12345678');
        
        process.exit(0);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            console.log('⚠️ El maestro de prueba ya existe en la base de datos.');
            console.log('   Email: maria.gonzalez@colegio.com');
            console.log('   Contraseña: maestro123');
        } else {
            console.error('❌ Error creando maestro de prueba:', error);
        }
        process.exit(1);
    }
}

crearMaestroPrueba(); 