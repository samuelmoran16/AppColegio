// Script de prueba para verificar el sistema de cédulas
const { db, generarCedulaRepresentante, initDB } = require('./src/db');

async function testCedulas() {
    console.log('🧪 Probando sistema de cédulas de representantes...\n');
    
    try {
        // Inicializar la base de datos primero
        console.log('Inicializando base de datos...');
        await initDB();
        console.log('✅ Base de datos inicializada\n');
        
        // Generar algunas cédulas de prueba
        console.log('Generando cédulas únicas...');
        const cedula1 = await generarCedulaRepresentante();
        const cedula2 = await generarCedulaRepresentante();
        const cedula3 = await generarCedulaRepresentante();
        
        console.log(`✅ Cédula 1: ${cedula1}`);
        console.log(`✅ Cédula 2: ${cedula2}`);
        console.log(`✅ Cédula 3: ${cedula3}`);
        
        // Verificar que son únicas
        if (cedula1 !== cedula2 && cedula2 !== cedula3 && cedula1 !== cedula3) {
            console.log('\n✅ Todas las cédulas son únicas');
        } else {
            console.log('\n❌ Error: Se generaron cédulas duplicadas');
        }
        
        // Verificar formato (7 u 8 dígitos)
        const formatoCorrecto = [cedula1, cedula2, cedula3].every(cedula => 
            /^\d{7,8}$/.test(cedula)
        );
        
        if (formatoCorrecto) {
            console.log('✅ Todas las cédulas tienen el formato correcto (7 u 8 dígitos)');
        } else {
            console.log('❌ Error: Algunas cédulas no tienen el formato correcto');
        }
        
        console.log('\n🎉 Pruebas completadas exitosamente!');
        
    } catch (error) {
        console.error('❌ Error durante las pruebas:', error);
    } finally {
        process.exit(0);
    }
}

testCedulas(); 