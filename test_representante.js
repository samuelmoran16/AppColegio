// Script de prueba para verificar el registro de representantes
const { db, initDB, generarCedulaRepresentante } = require('./src/db');

async function testRegistroRepresentante() {
    console.log('🧪 Probando registro de representantes...\n');
    
    try {
        // Inicializar la base de datos
        console.log('Inicializando base de datos...');
        await initDB();
        console.log('✅ Base de datos inicializada\n');
        
        // 1. Generar cédula única
        console.log('1. Generando cédula única...');
        const cedula = await generarCedulaRepresentante();
        console.log(`✅ Cédula generada: ${cedula}\n`);
        
        // 2. Crear representante de prueba
        console.log('2. Creando representante de prueba...');
        const nombre = 'Ana García';
        const email = 'ana.garcia@test.com';
        const password = 'test123';
        
        const result = await db.query(
            'INSERT INTO representantes (cedula, nombre, email, password) VALUES (?, ?, ?, ?) RETURNING *',
            [cedula, nombre, email, password]
        );
        
        const representante = result.rows[0];
        console.log(`✅ Representante creado:`);
        console.log(`   - ID: ${representante.id}`);
        console.log(`   - Nombre: ${representante.nombre}`);
        console.log(`   - Email: ${representante.email}`);
        console.log(`   - Cédula: ${representante.cedula}\n`);
        
        // 3. Verificar que se puede consultar
        console.log('3. Verificando consulta...');
        const consulta = await db.query('SELECT * FROM representantes WHERE cedula = ?', [cedula]);
        if (consulta.rows.length > 0) {
            console.log('✅ Consulta exitosa - Representante encontrado');
        } else {
            console.log('❌ Error - Representante no encontrado');
        }
        
        // 4. Limpiar datos de prueba
        console.log('\n4. Limpiando datos de prueba...');
        await db.query('DELETE FROM representantes WHERE cedula = ?', [cedula]);
        console.log('✅ Datos de prueba eliminados');
        
        console.log('\n🎉 Pruebas completadas exitosamente!');
        
    } catch (error) {
        console.error('❌ Error durante las pruebas:', error);
    } finally {
        process.exit(0);
    }
}

testRegistroRepresentante(); 