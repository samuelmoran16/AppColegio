# 🏫 Sistema de Gestión Escolar

Aplicación web completa para la gestión de un colegio, con roles de administrador y representante, que permite registrar estudiantes, representantes, notas y pagos de mensualidad.

## 🚀 Características

### 👨‍💼 Panel de Administrador
- **Gestión de Representantes**: Registrar, editar y eliminar representantes
- **Gestión de Estudiantes**: Registrar estudiantes con cédula opcional
- **Sistema de Notas**: Registrar, editar y eliminar notas por estudiante
- **Generación de Mensualidades**: Crear mensualidades automáticas para el año escolar
- **Carnets Únicos**: Sistema automático de carnets únicos para cada estudiante

### 👨‍👩‍👧‍👦 Panel de Representante
- **Visualización de Hijos**: Ver información de todos los estudiantes a cargo
- **Consulta de Notas**: Revisar notas de cada hijo por período y materia
- **Sistema de Pagos**: Realizar pagos de mensualidad con generación de facturas PDF
- **Historial de Pagos**: Ver estado de todas las mensualidades

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js + Express.js
- **Base de Datos**: PostgreSQL (producción) / SQLite (desarrollo)
- **Frontend**: HTML5, CSS3, Bootstrap 5, JavaScript
- **Autenticación**: bcrypt + express-session
- **PDF**: PDFKit para generación de facturas
- **Despliegue**: Render

## 📋 Requisitos Previos

- Node.js >= 18.0.0
- npm o yarn
- Cuenta en Render (para despliegue)

## 🔧 Instalación Local

1. **Clonar el repositorio**:
```bash
git clone <url-del-repositorio>
cd webapp-colegio
```

2. **Instalar dependencias**:
```bash
npm install
```

3. **Configurar variables de entorno** (opcional):
```bash
# Para desarrollo local, no es necesario configurar variables
# La aplicación usará SQLite automáticamente
```

4. **Ejecutar la aplicación**:
```bash
npm start
```

5. **Acceder a la aplicación**:
- URL: http://localhost:3000
- Credenciales por defecto:
  - **Administrador**: admin@colegio.com / admin123

## 🌐 Despliegue en Render

### 1. Preparar el Repositorio
```bash
# Asegurarse de que todos los cambios estén commitados
git add .
git commit -m "Preparar para despliegue en Render"
git push origin main
```

### 2. Configurar en Render

1. **Crear cuenta en Render**: https://render.com
2. **Crear nuevo Web Service**:
   - Conectar con tu repositorio de GitHub
   - Seleccionar el repositorio de la aplicación

3. **Configurar el servicio**:
   - **Name**: webapp-colegio (o el nombre que prefieras)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (o el plan que prefieras)

4. **Configurar variables de entorno**:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: URL de tu base de datos PostgreSQL en Render

### 3. Crear Base de Datos PostgreSQL

1. **En Render, crear PostgreSQL Database**:
   - **Name**: webapp-colegio-db
   - **Database**: webapp_colegio
   - **User**: (se genera automáticamente)
   - **Password**: (se genera automáticamente)

2. **Copiar la URL de conexión**:
   - Ir a la base de datos creada
   - Copiar la "External Database URL"
   - Pegarla en la variable `DATABASE_URL` del Web Service

### 4. Desplegar

1. **Hacer clic en "Create Web Service"**
2. **Esperar a que se complete el despliegue**
3. **La aplicación estará disponible en la URL proporcionada por Render**

## 🔐 Credenciales por Defecto

### Administrador
- **Email**: admin@colegio.com
- **Contraseña**: admin123

### Representantes
- Se crean desde el panel de administrador
- Cada representante recibe credenciales temporales

## 📊 Estructura de la Base de Datos

### Tablas Principales
- **administradores**: Gestión de administradores del sistema
- **representantes**: Información de representantes legales
- **estudiantes**: Datos de estudiantes con carnets únicos
- **notas**: Calificaciones por materia y período
- **pagos**: Sistema de mensualidades y pagos

## 🎯 Funcionalidades Destacadas

### Sistema de Cédula Opcional
- **Pregunta intuitiva**: "¿El estudiante tiene cédula de identidad?"
- **Flexibilidad total**: Permite registrar con o sin cédula
- **Validación inteligente**: Solo requiere cédula si se indica que la tiene

### Generación Automática de Facturas
- **Facturas PDF**: Generadas automáticamente al realizar pagos
- **Datos completos**: Incluye información del colegio, representante, estudiante y pago
- **Descarga directa**: Accesible desde la interfaz de representantes

### Carnets Únicos
- **Formato**: COLEGIO-YYYY-XXXX
- **Generación automática**: Se crean al registrar estudiantes
- **Identificación única**: Evita confusiones en la gestión

## 🚨 Notas Importantes

- **Base de datos**: En desarrollo usa SQLite, en producción PostgreSQL
- **Sesiones**: Configuradas para funcionar en Render
- **Archivos estáticos**: Servidos desde la carpeta `public`
- **Facturas**: Se guardan en `public/facturas/`

## 📞 Soporte

Para soporte técnico o preguntas sobre la aplicación, contactar al desarrollador.

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles. 