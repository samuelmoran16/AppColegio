// Script de prueba para verificar el registro de estudiantes
const { db, initDB, generarCedulaRepresentante, generarCarnetUnico } = require('./src/db');

async function testRegistroEstudiante() {
    console.log('🧪 Probando registro de estudiantes con cédulas...\n');
    
    try {
        // Inicializar la base de datos
        console.log('Inicializando base de datos...');
        await initDB();
        console.log('✅ Base de datos inicializada\n');
        
        // 1. Crear un representante de prueba
        console.log('1. Creando representante de prueba...');
        const cedulaRep = await generarCedulaRepresentante();
        const nombreRep = 'Juan Pérez';
        const emailRep = 'juan.perez@test.com';
        const passwordRep = 'test123';
        
        await db.query(
            'INSERT INTO representantes (cedula, nombre, email, password) VALUES (?, ?, ?, ?)',
            [cedulaRep, nombreRep, emailRep, passwordRep]
        );
        console.log(`✅ Representante creado: ${nombreRep} - Cédula: ${cedulaRep}\n`);
        
        // 2. Registrar un estudiante usando la cédula del representante
        console.log('2. Registrando estudiante...');
        const carnet = await generarCarnetUnico();
        const nombreEst = 'María Pérez';
        const grado = '3er Grado';
        
        await db.query(
            'INSERT INTO estudiantes (carnet, nombre, cedula, fecha_nacimiento, grado, cedula_representante) VALUES (?, ?, ?, ?, ?, ?)',
            [carnet, nombreEst, null, null, grado, cedulaRep]
        );
        console.log(`✅ Estudiante registrado: ${nombreEst} - Carnet: ${carnet}\n`);
        
        // 3. Verificar que se puede consultar correctamente
        console.log('3. Verificando consulta de estudiantes...');
        const estudiantes = await db.query(`
            SELECT e.id, e.carnet, e.nombre, e.cedula, e.grado, r.cedula as cedula_representante, r.nombre as nombre_representante 
            FROM estudiantes e 
            JOIN representantes r ON e.cedula_representante = r.cedula 
            ORDER BY e.nombre
        `);
        
        if (estudiantes.rows.length > 0) {
            const est = estudiantes.rows[0];
            console.log(`✅ Consulta exitosa:`);
            console.log(`   - Estudiante: ${est.nombre}`);
            console.log(`   - Carnet: ${est.carnet}`);
            console.log(`   - Representante: ${est.nombre_representante}`);
            console.log(`   - Cédula Rep: ${est.cedula_representante}`);
        } else {
            console.log('❌ No se encontraron estudiantes');
        }
        
        // 4. Limpiar datos de prueba
        console.log('\n4. Limpiando datos de prueba...');
        await db.query('DELETE FROM estudiantes WHERE carnet = ?', [carnet]);
        await db.query('DELETE FROM representantes WHERE cedula = ?', [cedulaRep]);
        console.log('✅ Datos de prueba eliminados');
        
        console.log('\n🎉 Pruebas completadas exitosamente!');
        
    } catch (error) {
        console.error('❌ Error durante las pruebas:', error);
    } finally {
        process.exit(0);
    }
}

testRegistroEstudiante(); 