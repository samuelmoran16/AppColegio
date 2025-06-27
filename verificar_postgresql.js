const { Pool } = require('pg');

// Configuración para PostgreSQL en Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function verificarPostgreSQL() {
    try {
        console.log('🔍 Verificando base de datos PostgreSQL en Render...\n');
        
        // Verificar si la tabla representantes existe
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'representantes'
            );
        `);
        
        console.log('📋 Tabla representantes existe:', tableExists.rows[0].exists);
        
        if (tableExists.rows[0].exists) {
            // Verificar estructura de la tabla
            const columns = await pool.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'representantes' 
                AND table_schema = 'public'
                ORDER BY ordinal_position;
            `);
            
            console.log('\n📊 Estructura de la tabla representantes:');
            console.log('Columna          | Tipo        | Nullable | Default');
            console.log('-----------------|-------------|----------|---------');
            columns.rows.forEach(col => {
                console.log(`${col.column_name.padEnd(15)} | ${col.data_type.padEnd(10)} | ${col.is_nullable.padEnd(8)} | ${col.column_default || 'NULL'}`);
            });
            
            // Verificar restricciones UNIQUE
            const constraints = await pool.query(`
                SELECT constraint_name, constraint_type
                FROM information_schema.table_constraints 
                WHERE table_name = 'representantes' 
                AND table_schema = 'public'
                AND constraint_type = 'UNIQUE';
            `);
            
            console.log('\n🔒 Restricciones UNIQUE:');
            if (constraints.rows.length > 0) {
                constraints.rows.forEach(constraint => {
                    console.log(`- ${constraint.constraint_name}: ${constraint.constraint_type}`);
                });
            } else {
                console.log('No hay restricciones UNIQUE');
            }
            
            // Contar representantes
            const count = await pool.query('SELECT COUNT(*) as total FROM representantes');
            console.log(`\n📈 Total de representantes: ${count.rows[0].total}`);
            
            // Mostrar algunos representantes
            const representantes = await pool.query('SELECT id, cedula, nombre, email FROM representantes ORDER BY id LIMIT 10');
            console.log('\n📋 Primeros 10 representantes:');
            console.log('ID | Cédula    | Nombre                    | Email');
            console.log('---|-----------|---------------------------|---------------------------');
            representantes.rows.forEach(rep => {
                console.log(`${rep.id.toString().padStart(2)} | ${rep.cedula.padStart(8)} | ${rep.nombre.padEnd(25)} | ${rep.email}`);
            });
            
            // Buscar Vanessa Quiñones específicamente
            const vanessa = await pool.query(`
                SELECT id, cedula, nombre, email 
                FROM representantes 
                WHERE nombre ILIKE '%vanessa%' OR nombre ILIKE '%quiñones%'
            `);
            
            console.log('\n🔍 Búsqueda de Vanessa Quiñones:');
            if (vanessa.rows.length > 0) {
                vanessa.rows.forEach(rep => {
                    console.log(`✅ Encontrada: ${rep.nombre} (${rep.cedula}) - ${rep.email}`);
                });
            } else {
                console.log('❌ No se encontró Vanessa Quiñones');
            }
            
        } else {
            console.log('❌ La tabla representantes no existe en PostgreSQL');
        }
        
    } catch (error) {
        console.error('💥 Error verificando PostgreSQL:', error);
    } finally {
        await pool.end();
    }
}

verificarPostgreSQL(); 