const { db, initDB } = require('./src/db');
const bcrypt = require('bcrypt');

async function verificarYCrearAdmin() {
    try {
        console.log('🔍 Verificando administrador...');
        
        // Inicializar DB
        await initDB();
        
        // Verificar si existe el administrador
        const adminResult = await db.query('SELECT * FROM administradores WHERE email = ?', ['admin@colegio.com']);
        
        if (adminResult.rows.length === 0) {
            console.log('❌ Administrador no encontrado, creando...');
            
            const hash = await bcrypt.hash('admin123', 10);
            
            await db.query(`
                INSERT INTO administradores (nombre, email, password) 
                VALUES (?, ?, ?)
            `, ['Administrador', 'admin@colegio.com', hash]);
            
            console.log('✅ Administrador creado exitosamente');
            console.log('   Email: admin@colegio.com');
            console.log('   Contraseña: admin123');
        } else {
            console.log('✅ Administrador ya existe');
            console.log('   Email: admin@colegio.com');
            console.log('   Contraseña: admin123');
        }
        
        // Verificar que se puede consultar
        const testResult = await db.query('SELECT COUNT(*) as total FROM administradores');
        console.log(`📊 Total de administradores: ${testResult.rows[0].total}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

verificarYCrearAdmin(); 