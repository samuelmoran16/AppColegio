const fetch = require('node-fetch');

async function probarEndpointBackend() {
    try {
        console.log('🧪 Probando endpoint del backend...\n');
        
        const datos = {
            cedula: '11863492',
            nombre: 'Magio Test',
            email: 'magio@gmail.com',
            password: 'test123456'
        };
        
        console.log('📋 Datos a enviar:');
        console.log(JSON.stringify(datos, null, 2));
        
        // Simular la petición que hace el frontend
        const response = await fetch('http://localhost:3000/api/representantes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': 'colegio_session=s%3AeyJ1c2VyIjp7ImlkIjoxLCJlbWFpbCI6ImFkbWluQGNvbGVnaW8uY29tIiwiY2VkdWxhIjpudWxsLCJyb2xlIjoiYWRtaW4iLCJub21icmUiOiJBZG1pbmlzdHJhZG9yIn19.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8' // Simular sesión de admin
            },
            body: JSON.stringify(datos)
        });
        
        console.log(`\n📊 Respuesta del servidor:`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Status Text: ${response.statusText}`);
        
        const data = await response.json();
        console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
        
        if (response.ok) {
            console.log('\n✅ Éxito! El endpoint funciona correctamente');
        } else {
            console.log('\n❌ Error en el endpoint');
            console.log(`   Código: ${response.status}`);
            console.log(`   Mensaje: ${data.message}`);
        }
        
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        console.log('\n💡 Asegúrate de que el servidor esté corriendo en http://localhost:3000');
    }
}

probarEndpointBackend(); 