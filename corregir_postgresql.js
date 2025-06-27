const { Pool } = require('pg');

async function corregirPostgreSQL() {
    try {
        console.log('🔧 Corrigiendo estructura de PostgreSQL...\n');
        
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
        
        // 1. Verificar estructura actual
        console.log('\n📋 Verificando estructura actual...');
        const structure = await client.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'representantes' AND column_name = 'cedula'
        `);
        
        if (structure.rows.length > 0) {
            const cedulaColumn = structure.rows[0];
            console.log(`   Cédula actual: ${cedulaColumn.data_type}(${cedulaColumn.character_maximum_length}) ${cedulaColumn.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            
            // 2. Si la columna es VARCHAR(8), cambiarla a VARCHAR(10) para aceptar 7-8 dígitos
            if (cedulaColumn.character_maximum_length === 8) {
                console.log('\n🔧 Cambiando longitud de cédula de 8 a 10 caracteres...');
                
                try {
                    await client.query('ALTER TABLE representantes ALTER COLUMN cedula TYPE VARCHAR(10)');
                    console.log('✅ Longitud de cédula actualizada a VARCHAR(10)');
                } catch (alterError) {
                    console.log('❌ Error al cambiar longitud:', alterError.message);
                    
                    // Si hay datos que no caben, intentar una solución alternativa
                    console.log('🔄 Intentando solución alternativa...');
                    
                    // Verificar si hay cédulas que no caben
                    const longCedulas = await client.query(`
                        SELECT cedula, LENGTH(cedula) as longitud 
                        FROM representantes 
                        WHERE LENGTH(cedula) > 8
                    `);
                    
                    if (longCedulas.rows.length > 0) {
                        console.log('⚠️ Se encontraron cédulas con más de 8 caracteres:');
                        longCedulas.rows.forEach(row => {
                            console.log(`   ${row.cedula} (${row.longitud} caracteres)`);
                        });
                    } else {
                        console.log('✅ Todas las cédulas existentes tienen 8 caracteres o menos');
                    }
                }
            } else {
                console.log('✅ La columna cédula ya tiene la longitud correcta');
            }
        }
        
        // 3. Verificar restricciones únicas
        console.log('\n🔒 Verificando restricciones únicas...');
        const constraints = await client.query(`
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'representantes' 
            AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
            ORDER BY tc.constraint_name;
        `);
        
        if (constraints.rows.length > 0) {
            console.log('Restricciones encontradas:');
            constraints.rows.forEach(constraint => {
                console.log(`   ${constraint.constraint_name}: ${constraint.constraint_type} en ${constraint.column_name}`);
            });
        } else {
            console.log('   No se encontraron restricciones únicas');
        }
        
        // 4. Probar inserción con cédula de 7 dígitos
        console.log('\n🧪 Probando inserción con cédula de 7 dígitos...');
        const cedula7 = '1234567';
        const emailTest = `test.7digitos.${Date.now()}@postgresql.com`;
        
        try {
            const insertResult = await client.query(`
                INSERT INTO representantes (cedula, nombre, email, password) 
                VALUES ($1, $2, $3, $4) 
                RETURNING id, cedula, nombre, email
            `, [cedula7, 'Test 7 Dígitos', emailTest, 'test123']);
            
            console.log('✅ Inserción exitosa con 7 dígitos:', insertResult.rows[0]);
            
            // Limpiar el registro de prueba
            await client.query('DELETE FROM representantes WHERE cedula = $1', [cedula7]);
            console.log('🧹 Registro de prueba eliminado');
            
        } catch (insertError) {
            console.log('❌ Error en inserción con 7 dígitos:', insertError.message);
            console.log('   Código de error:', insertError.code);
        }
        
        // 5. Probar inserción con cédula de 8 dígitos
        console.log('\n🧪 Probando inserción con cédula de 8 dígitos...');
        const cedula8 = '12345678';
        const emailTest2 = `test.8digitos.${Date.now()}@postgresql.com`;
        
        try {
            const insertResult2 = await client.query(`
                INSERT INTO representantes (cedula, nombre, email, password) 
                VALUES ($1, $2, $3, $4) 
                RETURNING id, cedula, nombre, email
            `, [cedula8, 'Test 8 Dígitos', emailTest2, 'test123']);
            
            console.log('✅ Inserción exitosa con 8 dígitos:', insertResult2.rows[0]);
            
            // Limpiar el registro de prueba
            await client.query('DELETE FROM representantes WHERE cedula = $1', [cedula8]);
            console.log('🧹 Registro de prueba eliminado');
            
        } catch (insertError2) {
            console.log('❌ Error en inserción con 8 dígitos:', insertError2.message);
            console.log('   Código de error:', insertError2.code);
        }
        
        // 6. Verificar estructura final
        console.log('\n📋 Estructura final de la tabla representantes:');
        const finalStructure = await client.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'representantes'
            ORDER BY ordinal_position;
        `);
        
        finalStructure.rows.forEach(col => {
            const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
            console.log(`   ${col.column_name}: ${col.data_type}${length} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Verificación completada');
        
    } catch (err) {
        console.error('❌ Error corrigiendo PostgreSQL:', err.message);
        console.error('   Detalles completos:', err);
    }
}

corregirPostgreSQL(); 