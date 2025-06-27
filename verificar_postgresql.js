const { Pool } = require('pg');

async function verificarPostgreSQL() {
    try {
        console.log('🔍 Verificando base de datos PostgreSQL en Render...\n');
        
        // Verificar si tenemos la URL de la base de datos
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            console.log('❌ No se encontró DATABASE_URL en las variables de entorno');
            console.log('💡 Asegúrate de que la variable DATABASE_URL esté configurada en Render');
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
        
        // 1. Verificar conexión
        const client = await pool.connect();
        console.log('✅ Conexión exitosa a PostgreSQL');
        
        // 2. Verificar si la tabla representantes existe
        console.log('\n📋 Verificando tabla representantes...');
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'representantes'
            );
        `);
        
        if (tableExists.rows[0].exists) {
            console.log('✅ Tabla representantes existe');
            
            // 3. Verificar estructura de la tabla
            console.log('\n🏗️ Estructura de la tabla representantes:');
            const structure = await client.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'representantes'
                ORDER BY ordinal_position;
            `);
            
            structure.rows.forEach(col => {
                console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
            });
            
            // 4. Verificar restricciones únicas
            console.log('\n🔒 Restricciones únicas:');
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
                constraints.rows.forEach(constraint => {
                    console.log(`   ${constraint.constraint_name}: ${constraint.constraint_type} en ${constraint.column_name}`);
                });
            } else {
                console.log('   No se encontraron restricciones únicas');
            }
            
            // 5. Contar representantes existentes
            const count = await client.query('SELECT COUNT(*) as total FROM representantes');
            console.log(`\n📊 Total de representantes: ${count.rows[0].total}`);
            
            // 6. Verificar algunos representantes de ejemplo
            if (count.rows[0].total > 0) {
                console.log('\n👥 Algunos representantes existentes:');
                const examples = await client.query('SELECT id, cedula, nombre, email FROM representantes LIMIT 5');
                examples.rows.forEach(rep => {
                    console.log(`   ID: ${rep.id} | Cédula: ${rep.cedula} | Nombre: ${rep.nombre} | Email: ${rep.email}`);
                });
            }
            
            // 7. Probar inserción de datos únicos
            console.log('\n🧪 Probando inserción de datos únicos...');
            const cedulaUnica = Math.floor(Math.random() * 90000000) + 10000000;
            const emailUnico = `test.${Date.now()}@postgresql.com`;
            
            try {
                const insertResult = await client.query(`
                    INSERT INTO representantes (cedula, nombre, email, password) 
                    VALUES ($1, $2, $3, $4) 
                    RETURNING id, cedula, nombre, email
                `, [cedulaUnica.toString(), 'Test PostgreSQL', emailUnico, 'test123']);
                
                console.log('✅ Inserción exitosa:', insertResult.rows[0]);
                
                // Limpiar el registro de prueba
                await client.query('DELETE FROM representantes WHERE cedula = $1', [cedulaUnica.toString()]);
                console.log('🧹 Registro de prueba eliminado');
                
            } catch (insertError) {
                console.log('❌ Error en inserción:', insertError.message);
                console.log('   Código de error:', insertError.code);
                console.log('   Detalles:', insertError.detail);
            }
            
        } else {
            console.log('❌ Tabla representantes NO existe');
            console.log('💡 La tabla no se creó correctamente durante la migración');
        }
        
        client.release();
        await pool.end();
        
    } catch (err) {
        console.error('❌ Error verificando PostgreSQL:', err.message);
        console.error('   Detalles completos:', err);
    }
}

verificarPostgreSQL(); 