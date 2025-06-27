const { db, initDB } = require('./src/db');
const bcrypt = require('bcrypt');

async function probarRegistroEspecifico() {
    try {
        console.log('🧪 Probando registro específico...\n');
        
        await initDB();
        
        const cedula = '11863492';
        const email = 'magio@gmail.com';
        const nombre = 'Magio Test';
        const password = 'test123456';
        
        console.log(`📋 Datos a probar:`);
        console.log(`   Cédula: ${cedula}`);
        console.log(`   Email: ${email}`);
        console.log(`   Nombre: ${nombre}`);
        console.log(`   Contraseña: ${password}\n`);
        
        // 1. Verificar si ya existe
        console.log('1. Verificando si ya existe...');
        const existeCedula = await db.query('SELECT id, cedula, nombre, email FROM representantes WHERE cedula = ?', [cedula]);
        const existeEmail = await db.query('SELECT id, cedula, nombre, email FROM representantes WHERE email = ?', [email]);
        
        if (existeCedula.rows.length > 0) {
            console.log('❌ CÉDULA YA EXISTE:');
            existeCedula.rows.forEach(rep => {
                console.log(`   - ID: ${rep.id} | Nombre: ${rep.nombre} | Email: ${rep.email}`);
            });
        } else {
            console.log('✅ Cédula disponible');
        }
        
        if (existeEmail.rows.length > 0) {
            console.log('❌ EMAIL YA EXISTE:');
            existeEmail.rows.forEach(rep => {
                console.log(`   - ID: ${rep.id} | Nombre: ${rep.nombre} | Cédula: ${rep.cedula}`);
            });
        } else {
            console.log('✅ Email disponible');
        }
        
        // 2. Intentar insertar directamente
        console.log('\n2. Intentando inserción directa...');
        try {
            const hash = await bcrypt.hash(password, 10);
            
            const result = await db.query(
                'INSERT INTO representantes (cedula, nombre, email, password) VALUES (?, ?, ?, ?) RETURNING *',
                [cedula, nombre, email, hash]
            );
            
            console.log('✅ Inserción exitosa!');
            console.log(`   ID: ${result.rows[0].id}`);
            console.log(`   Cédula: ${result.rows[0].cedula}`);
            console.log(`   Nombre: ${result.rows[0].nombre}`);
            console.log(`   Email: ${result.rows[0].email}`);
            
            // Limpiar el registro de prueba
            console.log('\n3. Limpiando registro de prueba...');
            await db.query('DELETE FROM representantes WHERE cedula = ?', [cedula]);
            console.log('✅ Registro de prueba eliminado');
            
        } catch (error) {
            console.log('❌ Error en inserción:');
            console.log(`   Código: ${error.code}`);
            console.log(`   Mensaje: ${error.message}`);
            console.log(`   SQL: ${error.sql}`);
            
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                console.log('\n🔍 Este es un error de restricción UNIQUE');
                console.log('   - Verifica que no haya espacios en blanco');
                console.log('   - Verifica que no haya caracteres especiales');
                console.log('   - Verifica que la cédula/email realmente no exista');
            }
        }
        
        // 3. Verificar estructura de la tabla
        console.log('\n4. Verificando estructura de la tabla...');
        const estructura = await db.query('PRAGMA table_info(representantes)');
        console.log('📋 Estructura de la tabla representantes:');
        estructura.rows.forEach(col => {
            console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        // 4. Verificar restricciones UNIQUE
        console.log('\n5. Verificando restricciones UNIQUE...');
        const indices = await db.query('PRAGMA index_list(representantes)');
        console.log('📋 Índices de la tabla:');
        indices.rows.forEach(idx => {
            console.log(`   - ${idx.name}: ${idx.unique ? 'UNIQUE' : 'NO UNIQUE'}`);
        });
        
    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        process.exit(0);
    }
}

probarRegistroEspecifico(); 