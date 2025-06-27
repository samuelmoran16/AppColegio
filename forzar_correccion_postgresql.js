const { Pool } = require('pg');

async function forzarCorreccionPostgreSQL() {
    try {
        console.log('🚀 Forzando corrección de estructura PostgreSQL...\n');
        
        // Verificar si tenemos la URL de la base de datos
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            console.log('❌ No se encontró DATABASE_URL en las variables de entorno');
            console.log('💡 Este script debe ejecutarse en el servidor de Render');
            return;
        }
        
        console.log('✅ DATABASE_URL encontrada');
        
        // Crear conexión a PostgreSQL
        const pool = new Pool({
            connectionString: databaseUrl,
            ssl: {
                rejectUnauthorized: false
            }
        });
        
        console.log('🔌 Conectando a PostgreSQL...');
        
        const client = await pool.connect();
        console.log('✅ Conexión exitosa a PostgreSQL');
        
        // 1. Forzar corrección de tabla representantes
        console.log('\n🔧 Corrigiendo tabla representantes...');
        try {
            await client.query('ALTER TABLE representantes ALTER COLUMN cedula TYPE VARCHAR(10)');
            console.log('✅ Cédula en representantes cambiada a VARCHAR(10)');
        } catch (err) {
            console.log('⚠️ Error al cambiar representantes:', err.message);
        }
        
        // 2. Forzar corrección de tabla maestros
        console.log('\n🔧 Corrigiendo tabla maestros...');
        try {
            await client.query('ALTER TABLE maestros ALTER COLUMN cedula TYPE VARCHAR(10)');
            console.log('✅ Cédula en maestros cambiada a VARCHAR(10)');
        } catch (err) {
            console.log('⚠️ Error al cambiar maestros:', err.message);
        }
        
        // 3. Forzar corrección de tabla estudiantes
        console.log('\n🔧 Corrigiendo tabla estudiantes...');
        try {
            await client.query('ALTER TABLE estudiantes ALTER COLUMN cedula_representante TYPE VARCHAR(10)');
            console.log('✅ cedula_representante en estudiantes cambiada a VARCHAR(10)');
        } catch (err) {
            console.log('⚠️ Error al cambiar estudiantes:', err.message);
        }
        
        // 4. Verificar estructura final
        console.log('\n📋 Verificando estructura final...');
        const tables = ['representantes', 'maestros', 'estudiantes'];
        
        for (const table of tables) {
            console.log(`\n${table.toUpperCase()}:`);
            const structure = await client.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns 
                WHERE table_name = '${table}' 
                AND (column_name = 'cedula' OR column_name = 'cedula_representante')
                ORDER BY column_name;
            `);
            
            structure.rows.forEach(col => {
                const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
                console.log(`   ${col.column_name}: ${col.data_type}${length}`);
            });
        }
        
        // 5. Probar inserción con cédula de 7 dígitos
        console.log('\n🧪 Probando inserción con cédula de 7 dígitos...');
        const cedula7 = Math.floor(Math.random() * 9000000) + 1000000; // 7 dígitos únicos
        const emailTest = `test.7digitos.${Date.now()}@postgresql.com`;
        
        try {
            const insertResult = await client.query(`
                INSERT INTO representantes (cedula, nombre, email, password) 
                VALUES ($1, $2, $3, $4) 
                RETURNING id, cedula, nombre, email
            `, [cedula7.toString(), 'Test 7 Dígitos', emailTest, 'test123']);
            
            console.log('✅ Inserción exitosa con 7 dígitos:', insertResult.rows[0]);
            
            // Limpiar el registro de prueba
            await client.query('DELETE FROM representantes WHERE cedula = $1', [cedula7.toString()]);
            console.log('🧹 Registro de prueba eliminado');
            
        } catch (insertError) {
            console.log('❌ Error en inserción con 7 dígitos:', insertError.message);
            console.log('   Código de error:', insertError.code);
            console.log('   Detalles:', insertError.detail);
        }
        
        // 6. Probar inserción con cédula de 8 dígitos
        console.log('\n🧪 Probando inserción con cédula de 8 dígitos...');
        const cedula8 = Math.floor(Math.random() * 90000000) + 10000000; // 8 dígitos únicos
        const emailTest2 = `test.8digitos.${Date.now()}@postgresql.com`;
        
        try {
            const insertResult2 = await client.query(`
                INSERT INTO representantes (cedula, nombre, email, password) 
                VALUES ($1, $2, $3, $4) 
                RETURNING id, cedula, nombre, email
            `, [cedula8.toString(), 'Test 8 Dígitos', emailTest2, 'test123']);
            
            console.log('✅ Inserción exitosa con 8 dígitos:', insertResult2.rows[0]);
            
            // Limpiar el registro de prueba
            await client.query('DELETE FROM representantes WHERE cedula = $1', [cedula8.toString()]);
            console.log('🧹 Registro de prueba eliminado');
            
        } catch (insertError2) {
            console.log('❌ Error en inserción con 8 dígitos:', insertError2.message);
            console.log('   Código de error:', insertError2.code);
            console.log('   Detalles:', insertError2.detail);
        }
        
        client.release();
        await pool.end();
        
        console.log('\n🎉 ¡Corrección forzada completada!');
        console.log('💡 Ahora puedes registrar representantes con cédulas de 7 u 8 dígitos');
        
    } catch (err) {
        console.error('❌ Error forzando corrección PostgreSQL:', err.message);
        console.error('   Detalles completos:', err);
    }
}

forzarCorreccionPostgreSQL(); 