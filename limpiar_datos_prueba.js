const { db, initDB } = require('./src/db');

async function limpiarDatosPrueba() {
    try {
        console.log('🧹 Limpiando datos de prueba...\n');
        
        await initDB();
        
        // Contar representantes antes de limpiar
        const antes = await db.query('SELECT COUNT(*) as total FROM representantes');
        console.log(`📊 Representantes antes de limpiar: ${antes.rows[0].total}`);
        
        // Eliminar representantes que tengan emails con números (probablemente datos de prueba)
        const resultado = await db.query(`
            DELETE FROM representantes 
            WHERE email LIKE '%1@email.com' 
            OR email LIKE '%2@email.com' 
            OR email LIKE '%3@email.com'
            OR email LIKE '%4@email.com'
            OR email LIKE '%5@email.com'
            OR email LIKE '%6@email.com'
            OR email LIKE '%7@email.com'
            OR email LIKE '%8@email.com'
            OR email LIKE '%9@email.com'
            OR email LIKE '%0@email.com'
            OR email LIKE '%00@email.com'
            OR email LIKE '%01@email.com'
            OR email LIKE '%02@email.com'
            OR email LIKE '%03@email.com'
            OR email LIKE '%04@email.com'
            OR email LIKE '%05@email.com'
            OR email LIKE '%06@email.com'
            OR email LIKE '%07@email.com'
            OR email LIKE '%08@email.com'
            OR email LIKE '%09@email.com'
            OR email LIKE '%10@email.com'
            OR email LIKE '%11@email.com'
            OR email LIKE '%12@email.com'
            OR email LIKE '%13@email.com'
            OR email LIKE '%14@email.com'
            OR email LIKE '%15@email.com'
            OR email LIKE '%16@email.com'
            OR email LIKE '%17@email.com'
            OR email LIKE '%18@email.com'
            OR email LIKE '%19@email.com'
            OR email LIKE '%20@email.com'
            OR email LIKE '%21@email.com'
            OR email LIKE '%22@email.com'
            OR email LIKE '%23@email.com'
            OR email LIKE '%24@email.com'
            OR email LIKE '%25@email.com'
            OR email LIKE '%26@email.com'
            OR email LIKE '%27@email.com'
            OR email LIKE '%28@email.com'
            OR email LIKE '%29@email.com'
            OR email LIKE '%30@email.com'
            OR email LIKE '%31@email.com'
            OR email LIKE '%32@email.com'
            OR email LIKE '%33@email.com'
            OR email LIKE '%34@email.com'
            OR email LIKE '%35@email.com'
            OR email LIKE '%36@email.com'
            OR email LIKE '%37@email.com'
            OR email LIKE '%38@email.com'
            OR email LIKE '%39@email.com'
            OR email LIKE '%40@email.com'
            OR email LIKE '%41@email.com'
            OR email LIKE '%42@email.com'
            OR email LIKE '%43@email.com'
            OR email LIKE '%44@email.com'
            OR email LIKE '%45@email.com'
            OR email LIKE '%46@email.com'
            OR email LIKE '%47@email.com'
            OR email LIKE '%48@email.com'
            OR email LIKE '%49@email.com'
            OR email LIKE '%50@email.com'
            OR email LIKE '%51@email.com'
            OR email LIKE '%52@email.com'
            OR email LIKE '%53@email.com'
            OR email LIKE '%54@email.com'
            OR email LIKE '%55@email.com'
            OR email LIKE '%56@email.com'
            OR email LIKE '%57@email.com'
            OR email LIKE '%58@email.com'
            OR email LIKE '%59@email.com'
            OR email LIKE '%60@email.com'
            OR email LIKE '%61@email.com'
            OR email LIKE '%62@email.com'
            OR email LIKE '%63@email.com'
            OR email LIKE '%64@email.com'
            OR email LIKE '%65@email.com'
            OR email LIKE '%66@email.com'
            OR email LIKE '%67@email.com'
            OR email LIKE '%68@email.com'
            OR email LIKE '%69@email.com'
            OR email LIKE '%70@email.com'
            OR email LIKE '%71@email.com'
            OR email LIKE '%72@email.com'
            OR email LIKE '%73@email.com'
            OR email LIKE '%74@email.com'
            OR email LIKE '%75@email.com'
            OR email LIKE '%76@email.com'
            OR email LIKE '%77@email.com'
            OR email LIKE '%78@email.com'
            OR email LIKE '%79@email.com'
            OR email LIKE '%80@email.com'
            OR email LIKE '%81@email.com'
            OR email LIKE '%82@email.com'
            OR email LIKE '%83@email.com'
            OR email LIKE '%84@email.com'
            OR email LIKE '%85@email.com'
            OR email LIKE '%86@email.com'
            OR email LIKE '%87@email.com'
            OR email LIKE '%88@email.com'
            OR email LIKE '%89@email.com'
        `);
        
        console.log(`🗑️ Representantes eliminados: ${resultado.rowCount}`);
        
        // Contar representantes después de limpiar
        const despues = await db.query('SELECT COUNT(*) as total FROM representantes');
        console.log(`📊 Representantes después de limpiar: ${despues.rows[0].total}`);
        
        // Mostrar representantes restantes
        const restantes = await db.query('SELECT id, cedula, nombre, email FROM representantes ORDER BY id');
        console.log('\n📋 Representantes restantes:');
        restantes.rows.forEach(rep => {
            console.log(`   - ID: ${rep.id} | Cédula: ${rep.cedula} | Nombre: ${rep.nombre} | Email: ${rep.email}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

limpiarDatosPrueba(); 