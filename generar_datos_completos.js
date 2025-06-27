const { db } = require('./src/db');
const bcrypt = require('bcrypt');

// Configuración de datos
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

const MATERIAS = [
    'Lengua',
    'Matematicas', 
    'Ciencias y Tecnología',
    'Ciencias Sociales',
    'Ingles',
    'Frances',
    'Computación',
    'Artes plasticas',
    'Educación Fisica',
    'Musica'
];

const PERIODOS = ['1er Lapso', '2do Lapso', '3er Lapso'];

// Nombres y apellidos para generar datos realistas
const NOMBRES = [
    'María', 'José', 'Ana', 'Carlos', 'Sofía', 'Luis', 'Carmen', 'Miguel', 'Isabella', 'Diego',
    'Valentina', 'Andrés', 'Camila', 'Fernando', 'Gabriela', 'Roberto', 'Daniela', 'Alejandro', 'Natalia', 'Ricardo',
    'Paula', 'Javier', 'Laura', 'Manuel', 'Carolina', 'Pedro', 'Andrea', 'David', 'Monica', 'Juan',
    'Patricia', 'Francisco', 'Elena', 'Antonio', 'Claudia', 'Rafael', 'Silvia', 'Eduardo', 'Rosa', 'Alberto'
];

const APELLIDOS = [
    'González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez',
    'Romero', 'Sosa', 'Torres', 'Álvarez', 'Ruiz', 'Jiménez', 'Moreno', 'Muñoz', 'Alonso', 'Gutiérrez',
    'Navarro', 'Morales', 'Molina', 'Blanco', 'Suárez', 'Castro', 'Ortega', 'Delgado', 'Ramírez', 'Cruz',
    'Flores', 'Reyes', 'Herrera', 'Vargas', 'Ramos', 'Medina', 'Cortés', 'Guerrero', 'Castillo', 'Rojas'
];

// Función para generar cédula única
function generarCedula() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Función para generar carnet único
function generarCarnet(grado, index) {
    const año = '2025';
    let gradoCode;
    
    // Mapear grados a códigos únicos
    switch(grado) {
        case '1er Nivel Pre-Escolar': gradoCode = '1ER'; break;
        case '2do Nivel Pre-Escolar': gradoCode = '2DO'; break;
        case '3er Nivel Pre-Escolar': gradoCode = '3ER'; break;
        case '1er Grado': gradoCode = '1GR'; break;
        case '2do Grado': gradoCode = '2GR'; break;
        case '3er Grado': gradoCode = '3GR'; break;
        case '4to Grado': gradoCode = '4TO'; break;
        case '5to Grado': gradoCode = '5TO'; break;
        case '6to Grado': gradoCode = '6TO'; break;
        default: gradoCode = 'EST';
    }
    
    const numero = String(index + 1).padStart(3, '0');
    return `${gradoCode}${año}${numero}`;
}

// Función para generar calificación según el tipo
function generarCalificacion(esPreescolar) {
    if (esPreescolar) {
        const letras = ['A', 'B', 'C'];
        return letras[Math.floor(Math.random() * letras.length)];
    } else {
        return Math.floor(10 + Math.random() * 11).toString(); // 10-20
    }
}

// Función para generar fecha de nacimiento realista según grado
function generarFechaNacimiento(grado) {
    const esPreescolar = grado.includes('Pre-Escolar');
    const añoBase = esPreescolar ? 2020 : 2018;
    const añoVariacion = esPreescolar ? 2 : 1;
    const año = añoBase - Math.floor(Math.random() * añoVariacion);
    const mes = Math.floor(Math.random() * 12) + 1;
    const dia = Math.floor(Math.random() * 28) + 1;
    return `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

async function generarDatosCompletos() {
    try {
        console.log('🚀 Iniciando generación de datos completos...');
        
        let totalRepresentantes = 0;
        let totalEstudiantes = 0;
        let totalNotas = 0;
        
        // Generar datos por cada grado/nivel
        for (let gradoIndex = 0; gradoIndex < GRADOS_Y_NIVELES.length; gradoIndex++) {
            const grado = GRADOS_Y_NIVELES[gradoIndex];
            const esPreescolar = grado.includes('Pre-Escolar');
            
            console.log(`\n📚 Generando datos para: ${grado}`);
            
            // Generar 10 estudiantes por grado
            for (let i = 0; i < 10; i++) {
                try {
                    // 1. Crear representante
                    const nombreRep = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
                    const apellidoRep = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
                    const cedulaRep = generarCedula();
                    const emailRep = `${nombreRep.toLowerCase()}.${apellidoRep.toLowerCase()}${i + 1}@email.com`;
                    const passwordRep = 'representante123';
                    
                    const hashRep = await bcrypt.hash(passwordRep, 10);
                    
                    const repResult = await db.query(`
                        INSERT INTO representantes (cedula, nombre, email, password) 
                        VALUES (?, ?, ?, ?) 
                        RETURNING id, cedula, nombre, email
                    `, [cedulaRep, `${nombreRep} ${apellidoRep}`, emailRep, hashRep]);
                    
                    totalRepresentantes++;
                    
                    // 2. Crear estudiante
                    const nombreEst = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
                    const apellidoEst = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
                    const carnet = generarCarnet(grado, i);
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
        
        // Generar maestro de prueba si no existe
        try {
            const hashMaestro = await bcrypt.hash('maestro123', 10);
            await db.query(`
                INSERT INTO maestros (cedula, nombre, apellido, email, password, grado_asignado) 
                VALUES (?, ?, ?, ?, ?, ?) 
                RETURNING id, cedula, nombre, apellido, email, grado_asignado
            `, ['12345678', 'María', 'González', 'maria.gonzalez@colegio.com', hashMaestro, '1er Grado']);
            console.log('\n👨‍🏫 Maestro de prueba creado/verificado');
        } catch (error) {
            if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
                console.error('Error con maestro:', error.message);
            }
        }
        
        // Resumen final
        console.log('\n🎉 Generación de datos completada!');
        console.log('📊 Resumen:');
        console.log(`   👥 Representantes: ${totalRepresentantes}`);
        console.log(`   👦 Estudiantes: ${totalEstudiantes}`);
        console.log(`   📝 Notas: ${totalNotas}`);
        console.log(`   📚 Grados/Niveles: ${GRADOS_Y_NIVELES.length}`);
        
        console.log('\n🔑 Credenciales para probar:');
        console.log('   Admin: admin@colegio.com / admin123');
        console.log('   Maestro: maria.gonzalez@colegio.com / maestro123');
        console.log('   Representantes: [nombre].[apellido][numero]@email.com / representante123');
        
        console.log('\n📋 Ejemplo de carnets generados:');
        const carnetsEjemplo = await db.query(`
            SELECT carnet, nombre, grado FROM estudiantes 
            ORDER BY grado, nombre 
            LIMIT 5
        `);
        carnetsEjemplo.rows.forEach(est => {
            console.log(`   ${est.carnet} - ${est.nombre} (${est.grado})`);
        });
        
    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        process.exit(0);
    }
}

// Ejecutar generación
generarDatosCompletos(); 