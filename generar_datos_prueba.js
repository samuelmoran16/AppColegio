const { db, initDB, generarCarnetUnico, generarCedulaRepresentante } = require('./src/db');
const bcrypt = require('bcrypt');

// Datos de prueba
const GRADOS_Y_NIVELES = [
    '1er Nivel Pre-Escolar',
    '2do Nivel Pre-Escolar', 
    '3er Nivel Pre-Escolar',
    '1er Grado',
    '2do Grado',
    '3er Grado',
    '4to Grado',
    '5to Grado',
    '6to Grado'
];

const NOMBRES = [
    'Ana', 'Carlos', 'María', 'Juan', 'Sofía', 'Luis', 'Carmen', 'Pedro', 'Isabella', 'Diego',
    'Valentina', 'Andrés', 'Camila', 'Miguel', 'Gabriela', 'José', 'Lucía', 'Fernando', 'Valeria', 'Roberto',
    'Daniela', 'Alejandro', 'Natalia', 'Ricardo', 'Paula', 'Francisco', 'Andrea', 'Manuel', 'Carolina', 'David',
    'Laura', 'Javier', 'Monica', 'Alberto', 'Patricia', 'Eduardo', 'Claudia', 'Rafael', 'Sandra', 'Héctor',
    'Mónica', 'Guillermo', 'Elena', 'Oscar', 'Beatriz', 'Arturo', 'Rosa', 'Felipe', 'Teresa', 'Gustavo'
];

const APELLIDOS = [
    'González', 'Rodríguez', 'López', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Fernández', 'Ramírez', 'Torres',
    'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Navarro', 'Domínguez',
    'Gil', 'Vázquez', 'Serrano', 'Molina', 'Castro', 'Ortega', 'Delgado', 'Morales', 'Suárez', 'Flores',
    'Cruz', 'Reyes', 'Gutiérrez', 'Cortés', 'Ramos', 'Medina', 'Vargas', 'Castillo', 'Silva', 'Núñez',
    'Aguilar', 'Rojas', 'Herrera', 'Mendoza', 'Salazar', 'Vega', 'Cárdenas', 'Guerrero', 'Montoya', 'Paredes'
];

const MATERIAS = [
    'Lengua', 'Inglés', 'Francés', 'Ciencias y Tecnología', 'Matemáticas', 
    'Ciencias Sociales', 'Computación', 'Artes Plásticas', 'Educación Física', 'Música'
];

const PERIODOS = ['1er Lapso', '2do Lapso', '3er Lapso'];

// Funciones auxiliares
function generarCedula() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generarFechaNacimiento(grado) {
    const esPreescolar = grado.includes('Pre-Escolar');
    const esPrimaria = !esPreescolar;
    
    let añoMin, añoMax;
    
    if (esPreescolar) {
        if (grado === '1er Nivel Pre-Escolar') {
            añoMin = 2020; añoMax = 2021; // 3-4 años
        } else if (grado === '2do Nivel Pre-Escolar') {
            añoMin = 2019; añoMax = 2020; // 4-5 años
        } else { // 3er Nivel Pre-Escolar
            añoMin = 2018; añoMax = 2019; // 5-6 años
        }
    } else {
        // Primaria: 1er grado = 6-7 años, 6to grado = 11-12 años
        const gradoNum = parseInt(grado.split(' ')[0]);
        añoMin = 2017 - gradoNum;
        añoMax = 2018 - gradoNum;
    }
    
    const año = Math.floor(añoMin + Math.random() * (añoMax - añoMin + 1));
    const mes = Math.floor(1 + Math.random() * 12);
    const dia = Math.floor(1 + Math.random() * 28);
    
    return `${año}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
}

function generarCalificacion(esPreescolar) {
    if (esPreescolar) {
        const calificaciones = ['A', 'B', 'C'];
        return calificaciones[Math.floor(Math.random() * calificaciones.length)];
    } else {
        // Calificaciones numéricas entre 10 y 20
        return (10 + Math.random() * 10).toFixed(1);
    }
}

async function generarDatosCompletos() {
    try {
        console.log('🚀 Iniciando generación de datos completos...');
        
        let totalRepresentantes = 0;
        let totalEstudiantes = 0;
        let totalMaestros = 0;
        let totalNotas = 0;
        
        // Generar datos por cada grado/nivel
        for (let gradoIndex = 0; gradoIndex < GRADOS_Y_NIVELES.length; gradoIndex++) {
            const grado = GRADOS_Y_NIVELES[gradoIndex];
            const esPreescolar = grado.includes('Pre-Escolar');
            
            console.log(`\n📚 Generando datos para: ${grado}`);
            
            // Generar maestro para este grado
            try {
                const nombreMaestro = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
                const apellidoMaestro = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
                const cedulaMaestro = generarCedula();
                const emailMaestro = `maestro.${grado.replace(/\s+/g, '').toLowerCase()}@colegio.com`;
                const passwordMaestro = 'maestro123';
                
                const hashMaestro = await bcrypt.hash(passwordMaestro, 10);
                
                await db.query(`
                    INSERT INTO maestros (cedula, nombre, apellido, email, password, grado_asignado) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [cedulaMaestro, nombreMaestro, apellidoMaestro, emailMaestro, hashMaestro, grado]);
                
                totalMaestros++;
                console.log(`  👨‍🏫 Maestro: ${nombreMaestro} ${apellidoMaestro} (${emailMaestro})`);
                
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    console.log(`  ⚠️ Maestro para ${grado} ya existe, continuando...`);
                } else {
                    console.error(`  ❌ Error creando maestro para ${grado}:`, error.message);
                }
            }
            
            // Generar 10 estudiantes por grado
            for (let i = 0; i < 10; i++) {
                try {
                    // 1. Crear representante
                    const nombreRep = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
                    const apellidoRep = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
                    const cedulaRep = generarCedula();
                    const emailRep = `${nombreRep.toLowerCase()}.${apellidoRep.toLowerCase()}${gradoIndex}${i}@email.com`;
                    const passwordRep = 'representante123';
                    
                    const hashRep = await bcrypt.hash(passwordRep, 10);
                    
                    await db.query(`
                        INSERT INTO representantes (cedula, nombre, email, password) 
                        VALUES (?, ?, ?, ?)
                    `, [cedulaRep, `${nombreRep} ${apellidoRep}`, emailRep, hashRep]);
                    
                    totalRepresentantes++;
                    
                    // 2. Crear estudiante
                    const nombreEst = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
                    const apellidoEst = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
                    const carnet = await generarCarnetUnico();
                    const cedulaEst = generarCedula();
                    const fechaNac = generarFechaNacimiento(grado);
                    
                    const estudianteResult = await db.query(`
                        INSERT INTO estudiantes (carnet, nombre, cedula, fecha_nacimiento, grado, cedula_representante) 
                        VALUES (?, ?, ?, ?, ?, ?)
                        RETURNING id, carnet, nombre, grado
                    `, [carnet, `${nombreEst} ${apellidoEst}`, cedulaEst, fechaNac, grado, cedulaRep]);
                    
                    totalEstudiantes++;
                    
                    // 3. Generar notas (solo para grados 1-6, no preescolar)
                    if (!esPreescolar) {
                        const materiasGrado = MATERIAS.slice(0, 6); // Solo 6 materias principales
                        
                        for (let materia of materiasGrado) {
                            for (let periodo of PERIODOS) {
                                const calificacion = generarCalificacion(false);
                                
                                await db.query(`
                                    INSERT INTO notas (id_estudiante, materia, calificacion, periodo, tipo_calificacion) 
                                    VALUES (?, ?, ?, ?, ?)
                                `, [estudianteResult.rows[0].id, materia, calificacion, periodo, 'numerica']);
                                
                                totalNotas++;
                            }
                        }
                    }
                    
                    console.log(`  ✅ ${estudianteResult.rows[0].nombre} (${carnet}) - ${grado}`);
                    
                } catch (error) {
                    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        console.log(`  ⚠️ Datos duplicados para ${grado}, continuando...`);
                        continue;
                    } else {
                        console.error(`  ❌ Error creando estudiante en ${grado}:`, error.message);
                    }
                }
            }
        }
        
        // Resumen final
        console.log('\n🎉 Generación de datos completada!');
        console.log('📊 Resumen:');
        console.log(`   👥 Representantes: ${totalRepresentantes}`);
        console.log(`   👦 Estudiantes: ${totalEstudiantes}`);
        console.log(`   👨‍🏫 Maestros: ${totalMaestros}`);
        console.log(`   📝 Notas: ${totalNotas}`);
        console.log(`   📚 Grados/Niveles: ${GRADOS_Y_NIVELES.length}`);
        
        console.log('\n🔑 Credenciales para probar:');
        console.log('   Admin: admin@colegio.com / admin123');
        console.log('   Maestros: maestro.[grado]@colegio.com / maestro123');
        console.log('   Representantes: [nombre].[apellido][grado][numero]@email.com / representante123');
        
        console.log('\n📋 Ejemplo de carnets generados:');
        console.log('   - Formato: [Año][Grado][Número]');
        console.log('   - Ejemplo: 2025-1G-001, 2025-2G-001, etc.');
        
        console.log('\n💡 Notas:');
        console.log('   - Preescolar: Sin notas (solo calificaciones cualitativas)');
        console.log('   - Primaria: Notas numéricas (10-20) en 6 materias principales');
        console.log('   - Cada estudiante tiene su representante único');
        console.log('   - Cada grado tiene su maestro asignado');
        
    } catch (error) {
        console.error('❌ Error durante la generación:', error);
    } finally {
        process.exit(0);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    // Inicializar DB antes de generar datos
    initDB().then(() => {
        console.log('✅ Base de datos inicializada');
        generarDatosCompletos();
    }).catch(error => {
        console.error('❌ Error inicializando base de datos:', error);
        process.exit(1);
    });
}

module.exports = { generarDatosCompletos }; 