const { db, initDB } = require('./src/db');
const bcrypt = require('bcrypt');

async function debugRegistroRepresentante() {
    try {
        console.log('🔍 Debuggeando registro de representante...\n');
        
        await initDB();
        
        const cedula = '11863492';
        const email = 'magio@gmail.com';
        const nombre = 'Magio Test';
        const password = 'test123456';
        
        console.log('📋 Datos a probar:');
        console.log(`   Cédula: ${cedula}`);
        console.log(`   Email: ${email}`);
        console.log(`   Nombre: ${nombre}`);
        console.log(`   Contraseña: ${password}\n`);
        
        // 1. Verificar si ya existe
        console.log('1. Verificando si ya existe...');
        const existeCedula = await db.query('SELECT id, cedula, nombre, email FROM representantes WHERE cedula = ?', [cedula]);
        const existeEmail = await db.query('SELECT id, cedula, nombre, email FROM representantes WHERE email = ?', [email]);
        
        if (existeCedula.rows.length > 0) {
            console.log('❌ Cédula ya existe:', existeCedula.rows[0]);
        } else {
            console.log('✅ Cédula no existe');
        }
        
        if (existeEmail.rows.length > 0) {
            console.log('❌ Email ya existe:', existeEmail.rows[0]);
        } else {
            console.log('✅ Email no existe');
        }
        
        // 2. Verificar estructura de la tabla
        console.log('\n2. Verificando estructura de la tabla...');
        const estructura = await db.query("PRAGMA table_info(representantes)");
        console.log('Estructura de la tabla representantes:');
        estructura.rows.forEach(col => {
            console.log(`   ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        // 3. Verificar restricciones únicas
        console.log('\n3. Verificando restricciones únicas...');
        const indices = await db.query("PRAGMA index_list(representantes)");
        console.log('Índices en la tabla representantes:');
        indices.rows.forEach(idx => {
            console.log(`   Índice: ${idx.name} (único: ${idx.unique})`);
        });
        
        // 4. Intentar insertar directamente
        console.log('\n4. Intentando inserción directa...');
        try {
            const hash = await bcrypt.hash(password, 10);
            const result = await db.query(
                'INSERT INTO representantes (cedula, nombre, email, password) VALUES (?, ?, ?, ?) RETURNING id, cedula, nombre, email',
                [cedula, nombre, email, hash]
            );
            console.log('✅ Inserción exitosa:', result.rows[0]);
            
            // Limpiar el registro de prueba
            await db.query('DELETE FROM representantes WHERE cedula = ?', [cedula]);
            console.log('🧹 Registro de prueba eliminado');
            
        } catch (err) {
            console.log('❌ Error en inserción:', err.message);
            console.log('   Código de error:', err.code);
            console.log('   Error completo:', err);
        }
        
        // 5. Verificar si hay algún trigger o constraint especial
        console.log('\n5. Verificando triggers...');
        const triggers = await db.query("SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='representantes'");
        if (triggers.rows.length > 0) {
            console.log('Triggers encontrados:');
            triggers.rows.forEach(trigger => {
                console.log(`   ${trigger.name}: ${trigger.sql}`);
            });
        } else {
            console.log('No hay triggers en la tabla representantes');
        }
        
    } catch (err) {
        console.error('Error en debug:', err);
    } finally {
        process.exit(0);
    }
}

debugRegistroRepresentante(); 