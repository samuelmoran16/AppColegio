const { Pool } = require('pg');

// Configuración para PostgreSQL en Render
// Necesitas establecer la variable de entorno DATABASE_URL con la URL de tu base de datos en Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function corregirPostgreSQL() {
    try {
        console.log('🔧 Corrigiendo base de datos PostgreSQL en Render...\n');
        
        // 1. Verificar si la columna cedula tiene la longitud correcta
        console.log('1️⃣ Verificando estructura de la columna cedula...');
        const columns = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'representantes' 
            AND column_name = 'cedula'
            AND table_schema = 'public';
        `);
        
        if (columns.rows.length > 0) {
            const cedulaColumn = columns.rows[0];
            console.log(`   Columna cedula: ${cedulaColumn.data_type}(${cedulaColumn.character_maximum_length})`);
            
            // Si la columna es VARCHAR(8), necesitamos cambiarla a VARCHAR(10) para aceptar 7 u 8 dígitos
            if (cedulaColumn.character_maximum_length === 8) {
                console.log('   ⚠️  La columna cedula es VARCHAR(8), cambiando a VARCHAR(10)...');
                
                // Eliminar restricciones UNIQUE primero
                const constraints = await pool.query(`
                    SELECT constraint_name 
                    FROM information_schema.table_constraints 
                    WHERE table_name = 'representantes' 
                    AND constraint_type = 'UNIQUE'
                    AND constraint_name LIKE '%cedula%';
                `);
                
                for (let constraint of constraints.rows) {
                    console.log(`   🗑️  Eliminando restricción: ${constraint.constraint_name}`);
                    await pool.query(`ALTER TABLE representantes DROP CONSTRAINT ${constraint.constraint_name}`);
                }
                
                // Cambiar el tipo de columna
                await pool.query('ALTER TABLE representantes ALTER COLUMN cedula TYPE VARCHAR(10)');
                console.log('   ✅ Columna cedula cambiada a VARCHAR(10)');
                
                // Recrear la restricción UNIQUE
                await pool.query('ALTER TABLE representantes ADD CONSTRAINT representantes_cedula_unique UNIQUE (cedula)');
                console.log('   ✅ Restricción UNIQUE recreada');
            } else {
                console.log('   ✅ La columna cedula ya tiene la longitud correcta');
            }
        }
        
        // 2. Verificar que Vanessa Quiñones esté en la base de datos
        console.log('\n2️⃣ Verificando datos de Vanessa Quiñones...');
        const vanessa = await pool.query(`
            SELECT id, cedula, nombre, email 
            FROM representantes 
            WHERE nombre ILIKE '%vanessa%' OR nombre ILIKE '%quiñones%'
        `);
        
        if (vanessa.rows.length > 0) {
            console.log('   ✅ Vanessa Quiñones encontrada:');
            vanessa.rows.forEach(rep => {
                console.log(`      ${rep.nombre} (${rep.cedula}) - ${rep.email}`);
            });
        } else {
            console.log('   ❌ Vanessa Quiñones no encontrada, insertando...');
            
            // Insertar Vanessa Quiñones si no existe
            const bcrypt = require('bcrypt');
            const hash = await bcrypt.hash('test123', 10);
            
            await pool.query(`
                INSERT INTO representantes (cedula, nombre, email, password) 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (cedula) DO NOTHING
            `, ['14922458', 'Vanessa Quiñones', 'vanequinones@gmail.com', hash]);
            
            console.log('   ✅ Vanessa Quiñones insertada');
        }
        
        // 3. Verificar total de representantes
        console.log('\n3️⃣ Verificando total de representantes...');
        const count = await pool.query('SELECT COUNT(*) as total FROM representantes');
        console.log(`   📊 Total de representantes: ${count.rows[0].total}`);
        
        // 4. Mostrar algunos representantes para verificar
        console.log('\n4️⃣ Mostrando algunos representantes...');
        const representantes = await pool.query('SELECT id, cedula, nombre, email FROM representantes ORDER BY id LIMIT 5');
        console.log('   📋 Primeros 5 representantes:');
        representantes.rows.forEach(rep => {
            console.log(`      ${rep.id}. ${rep.nombre} (${rep.cedula})`);
        });
        
        console.log('\n🎉 Corrección completada exitosamente!');
        
    } catch (error) {
        console.error('💥 Error corrigiendo PostgreSQL:', error);
    } finally {
        await pool.end();
    }
}

// Verificar que DATABASE_URL esté configurada
if (!process.env.DATABASE_URL) {
    console.error('❌ Error: La variable de entorno DATABASE_URL no está configurada');
    console.log('💡 Para ejecutar este script, configura la variable de entorno:');
    console.log('   export DATABASE_URL="tu_url_de_postgresql_en_render"');
    process.exit(1);
}

corregirPostgreSQL(); 