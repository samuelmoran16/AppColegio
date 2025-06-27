# Instrucciones para Limpiar Datos Duplicados en Render

## Problema
El error "La cédula o el correo electrónico ya están registrados" ocurre porque hay datos duplicados en la base de datos de PostgreSQL en Render.

## Solución

### Opción 1: Ejecutar Script de Limpieza (Recomendado)

1. **Conectarse a la consola de Render:**
   - Ve a tu aplicación en Render
   - Haz clic en "Shell" en el menú lateral
   - Se abrirá una terminal web

2. **Ejecutar el script de verificación:**
   ```bash
   NODE_ENV=production node verificar_duplicados_produccion.js
   ```

3. **Si se encuentran duplicados, ejecutar el script de limpieza:**
   ```bash
   NODE_ENV=production node limpiar_duplicados_produccion.js
   ```

### Opción 2: Limpieza Manual desde la Consola de PostgreSQL

1. **Conectarse a la base de datos PostgreSQL:**
   - Ve a tu base de datos en Render
   - Haz clic en "Connect" → "External Database"
   - Copia la cadena de conexión

2. **Ejecutar las siguientes consultas SQL:**

   ```sql
   -- Verificar representantes duplicados
   SELECT cedula, email, COUNT(*) as cantidad
   FROM representantes 
   GROUP BY cedula, email 
   HAVING COUNT(*) > 1;
   
   -- Eliminar representantes duplicados (mantener el más antiguo)
   DELETE FROM representantes 
   WHERE id NOT IN (
     SELECT MIN(id) 
     FROM representantes 
     GROUP BY cedula, email
   );
   
   -- Verificar maestros duplicados
   SELECT cedula, email, COUNT(*) as cantidad
   FROM maestros 
   GROUP BY cedula, email 
   HAVING COUNT(*) > 1;
   
   -- Eliminar maestros duplicados (mantener el más antiguo)
   DELETE FROM maestros 
   WHERE id NOT IN (
     SELECT MIN(id) 
     FROM maestros 
     GROUP BY cedula, email
   );
   
   -- Verificar estudiantes duplicados
   SELECT cedula, COUNT(*) as cantidad
   FROM estudiantes 
   WHERE cedula IS NOT NULL
   GROUP BY cedula 
   HAVING COUNT(*) > 1;
   
   -- Eliminar estudiantes duplicados (mantener el más antiguo)
   DELETE FROM estudiantes 
   WHERE id NOT IN (
     SELECT MIN(id) 
     FROM estudiantes 
     WHERE cedula IS NOT NULL
     GROUP BY cedula
   )
   AND cedula IS NOT NULL;
   ```

## Verificación

Después de la limpieza, verifica que todo funcione correctamente:

1. Intenta registrar un nuevo representante
2. Intenta registrar un nuevo maestro
3. Intenta registrar un nuevo estudiante

## Notas Importantes

- **Backup:** Antes de ejecutar cualquier limpieza, asegúrate de tener un backup de tu base de datos
- **Datos Únicos:** Los scripts mantienen el registro más antiguo (ID más bajo) y eliminan los duplicados
- **Relaciones:** Los scripts respetan las relaciones entre tablas

## Mejoras Implementadas

El código del backend ahora:
- Verifica duplicados antes de insertar (más eficiente)
- Proporciona mensajes de error más específicos
- Evita errores de restricción única en la base de datos

## Contacto

Si tienes problemas con la limpieza, puedes:
1. Revisar los logs de la aplicación en Render
2. Verificar la conectividad de la base de datos
3. Ejecutar los scripts de verificación para diagnosticar el problema 