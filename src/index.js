const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { db, initDB } = require('./db');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();
const port = 3000;

// Inicializar DB
initDB();

// Middlewares
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'tu_super_secreto_aqui', // Cambia esto por un secreto real
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Poner en true si usas HTTPS
}));

// Rutas de Login
app.post('/login', async (req, res) => {
    const { email, password, role } = req.body;
    
    let tableName = '';
    if (role === 'admin') tableName = 'administradores';
    if (role === 'representante') tableName = 'representantes';

    if (!tableName) {
        return res.status(400).send('Rol no válido');
    }
    
    try {
        const result = await db.query(`SELECT * FROM ${tableName} WHERE email = $1`, [email]);
        const user = result.rows[0];

        if (!user) return res.status(401).send('Credenciales incorrectas');
        
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.id, email: user.email, role: role };
            if (role === 'admin') {
                res.redirect('/admin/dashboard');
            } else {
                res.redirect('/representante/dashboard');
            }
        } else {
            res.status(401).send('Credenciales incorrectas');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error del servidor');
    }
});

// Ruta de Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send('No se pudo cerrar sesión');
        res.redirect('/login.html');
    });
});

// Middleware para proteger rutas
const auth = (role) => (req, res, next) => {
    if (req.session.user && req.session.user.role === role) {
        return next();
    }
    
    // Si no está autenticado, responder de forma inteligente
    // Si la petición espera JSON (una API), se envía un error JSON.
    // Si no, se redirige a la página de login.
    if (req.accepts('json')) {
        res.status(403).json({ message: 'Acceso no autorizado. Por favor, inicie sesión de nuevo.' });
    } else {
        res.redirect('/login.html');
    }
};

// Rutas protegidas (ejemplos)
app.get('/admin/dashboard', auth('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin_dashboard.html'));
});

app.get('/representante/dashboard', auth('representante'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'representante_dashboard.html'));
});

// --- API para Administrador ---

// Obtener todos los representantes
app.get('/api/representantes', auth('admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT id, nombre, email FROM representantes ORDER BY nombre');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los representantes' });
    }
});

// Registrar un nuevo representante
app.post('/api/representantes', auth('admin'), async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO representantes (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email',
            [nombre, email, hash]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
        }
        res.status(500).json({ message: 'Error al registrar el representante' });
    }
});

// Registrar un nuevo estudiante
app.post('/api/estudiantes', auth('admin'), async (req, res) => {
    const { nombre, cedula, fecha_nacimiento, grado, id_representante } = req.body;
     if (!nombre || !cedula || !id_representante || !grado) {
        return res.status(400).json({ message: 'Nombre, Cédula, Grado y Representante son obligatorios.' });
    }
    try {
        const result = await db.query(
            'INSERT INTO estudiantes (nombre, cedula, fecha_nacimiento, grado, id_representante) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, cedula, fecha_nacimiento || null, grado, id_representante]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
         if (err.code === '23505') { 
            return res.status(409).json({ message: 'La cédula ya está registrada.' });
        }
        res.status(500).json({ message: 'Error al registrar el estudiante' });
    }
});

// Eliminar un estudiante
app.delete('/api/estudiantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        // Primero, eliminar las notas asociadas para evitar errores de foreign key
        await db.query('DELETE FROM notas WHERE id_estudiante = $1', [id]);
        // Luego, eliminar al estudiante
        const result = await db.query('DELETE FROM estudiantes WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }
        res.status(200).json({ message: 'Estudiante eliminado con éxito.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar el estudiante.' });
    }
});

// Eliminar un representante
app.delete('/api/representantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        // Verificar si el representante tiene estudiantes a su cargo
        const estudiantes = await db.query('SELECT id FROM estudiantes WHERE id_representante = $1', [id]);
        if (estudiantes.rows.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar. El representante tiene estudiantes asignados.' });
        }
        
        const result = await db.query('DELETE FROM representantes WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }
        res.status(200).json({ message: 'Representante eliminado con éxito.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar el representante.' });
    }
});

// Editar un representante
app.put('/api/representantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    const { nombre, email } = req.body;
    if (!nombre || !email) {
        return res.status(400).json({ message: 'Nombre y email son obligatorios.' });
    }
    try {
        const result = await db.query(
            'UPDATE representantes SET nombre = $1, email = $2 WHERE id = $3 RETURNING *',
            [nombre, email, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'El correo electrónico ya está en uso por otro representante.' });
        }
        res.status(500).json({ message: 'Error al actualizar el representante.' });
    }
});

// Editar un estudiante
app.put('/api/estudiantes/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    const { nombre, cedula, grado } = req.body; // Solo se pueden editar estos campos
    if (!nombre || !cedula || !grado) {
        return res.status(400).json({ message: 'Nombre, cédula y grado son obligatorios.' });
    }
    try {
        const result = await db.query(
            'UPDATE estudiantes SET nombre = $1, cedula = $2, grado = $3 WHERE id = $4 RETURNING *',
            [nombre, cedula, grado, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'La cédula ya está en uso por otro estudiante.' });
        }
        res.status(500).json({ message: 'Error al actualizar el estudiante.' });
    }
});

// Obtener todos los estudiantes
app.get('/api/estudiantes', auth('admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT e.id, e.nombre, e.cedula, e.grado, r.nombre as nombre_representante 
            FROM estudiantes e 
            JOIN representantes r ON e.id_representante = r.id 
            ORDER BY e.nombre
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los estudiantes' });
    }
});

// Registrar una nueva nota
app.post('/api/notas', auth('admin'), async (req, res) => {
    const { cedula_estudiante, materia, calificacion, periodo } = req.body;
    if (!cedula_estudiante || !materia || !calificacion || !periodo) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    try {
        const estudianteResult = await db.query('SELECT id FROM estudiantes WHERE cedula = $1', [cedula_estudiante]);
        if (estudianteResult.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontró ningún estudiante con esa cédula.' });
        }
        const id_estudiante = estudianteResult.rows[0].id;

        const result = await db.query(
            'INSERT INTO notas (id_estudiante, materia, calificacion, periodo) VALUES ($1, $2, $3, $4) RETURNING *',
            [id_estudiante, materia, calificacion, periodo]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al registrar la nota' });
    }
});

// --- API para Representantes ---

// Obtener datos del representante logueado y sus hijos
app.get('/api/representante/dashboard', auth('representante'), async (req, res) => {
    try {
        const id_representante = req.session.user.id;
        
        // Obtener datos del representante
        const repResult = await db.query('SELECT nombre, email FROM representantes WHERE id = $1', [id_representante]);
        
        // Obtener la lista de hijos
        const hijosResult = await db.query('SELECT id, nombre, cedula, fecha_nacimiento, grado FROM estudiantes WHERE id_representante = $1 ORDER BY nombre', [id_representante]);

        if (repResult.rows.length === 0) {
            return res.status(404).json({ message: 'Representante no encontrado.' });
        }

        res.json({
            representante: repResult.rows[0],
            hijos: hijosResult.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los datos del dashboard.' });
    }
});

// Obtener notas de un estudiante específico
app.get('/api/estudiante/:id/notas', auth('representante'), async (req, res) => {
    try {
        const { id } = req.params;
        const id_representante = req.session.user.id;

        // Verificar que el representante solo pueda ver las notas de sus propios hijos
        const verificacion = await db.query('SELECT id FROM estudiantes WHERE id = $1 AND id_representante = $2', [id, id_representante]);
        if (verificacion.rows.length === 0) {
            return res.status(403).json({ message: 'No tiene permiso para ver las notas de este estudiante.' });
        }

        const notasResult = await db.query('SELECT materia, calificacion, periodo FROM notas WHERE id_estudiante = $1 ORDER BY periodo, materia', [id]);
        res.json(notasResult.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener las notas.' });
    }
});

// --- API para Pagos de Mensualidad ---

// Obtener pagos de mensualidad de los hijos del representante
app.get('/api/representante/pagos', auth('representante'), async (req, res) => {
    try {
        const id_representante = req.session.user.id;
        
        // Obtener todos los hijos del representante con sus pagos
        const result = await db.query(`
            SELECT 
                e.id as estudiante_id,
                e.nombre as estudiante_nombre,
                e.cedula as estudiante_cedula,
                e.grado,
                p.id as pago_id,
                p.mes,
                p.año,
                p.monto,
                p.estado,
                p.fecha_pago,
                p.fecha_vencimiento,
                p.concepto
            FROM estudiantes e
            LEFT JOIN pagos p ON e.id = p.id_estudiante
            WHERE e.id_representante = $1
            ORDER BY e.nombre, p.año DESC, p.mes DESC
        `, [id_representante]);

        // Organizar los datos por estudiante
        const estudiantes = {};
        result.rows.forEach(row => {
            if (!estudiantes[row.estudiante_id]) {
                estudiantes[row.estudiante_id] = {
                    id: row.estudiante_id,
                    nombre: row.estudiante_nombre,
                    cedula: row.estudiante_cedula,
                    grado: row.grado,
                    pagos: []
                };
            }
            
            if (row.pago_id) {
                estudiantes[row.estudiante_id].pagos.push({
                    id: row.pago_id,
                    mes: row.mes,
                    año: row.año,
                    monto: row.monto,
                    estado: row.estado,
                    fecha_pago: row.fecha_pago,
                    fecha_vencimiento: row.fecha_vencimiento,
                    concepto: row.concepto
                });
            }
        });

        res.json(Object.values(estudiantes));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los pagos.' });
    }
});

// Generar mensualidades pendientes para un estudiante (función auxiliar)
app.post('/api/admin/generar-mensualidades', auth('admin'), async (req, res) => {
    try {
        const { estudiante_id, año } = req.body;
        
        // Validaciones
        if (!estudiante_id || !año) {
            return res.status(400).json({ message: 'Estudiante y año son obligatorios.' });
        }

        if (año !== 2025) {
            return res.status(400).json({ message: 'Solo se permiten mensualidades para el año 2025.' });
        }

        // Verificar que el estudiante existe
        const estudianteExiste = await db.query('SELECT id, nombre FROM estudiantes WHERE id = $1', [estudiante_id]);
        if (estudianteExiste.rows.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }

        const estudiante = estudianteExiste.rows[0];
        let mensualidadesGeneradas = 0;
        let mensualidadesExistentes = 0;
        
        // Generar mensualidades para el año escolar (septiembre a agosto)
        const mesesEscolares = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]; // Septiembre a Agosto
        
        for (let mes of mesesEscolares) {
            try {
                // Verificar si ya existe
                const existe = await db.query('SELECT id FROM pagos WHERE id_estudiante = $1 AND mes = $2 AND año = $3', [estudiante_id, mes, año]);
                if (existe.rows.length === 0) {
                    // Calcular fecha de vencimiento (último día del mes)
                    const fechaVencimiento = new Date(año, mes, 0);
                    
                    await db.query(`
                        INSERT INTO pagos (id_estudiante, mes, año, monto, estado, fecha_vencimiento)
                        VALUES ($1, $2, $3, $4, 'pendiente', $5)
                    `, [estudiante_id, mes, año, 12480.00, fechaVencimiento]);
                    
                    mensualidadesGeneradas++;
                } else {
                    mensualidadesExistentes++;
                }
            } catch (error) {
                console.error(`Error generando mensualidad para mes ${mes}:`, error);
                return res.status(500).json({ 
                    message: `Error al generar mensualidad para ${mes}/${año}. Detalles: ${error.message}` 
                });
            }
        }
        
        let mensaje = `Mensualidades procesadas para ${estudiante.nombre} - Año Escolar 2025 (Septiembre-Agosto). `;
        if (mensualidadesGeneradas > 0) {
            mensaje += `${mensualidadesGeneradas} mensualidades generadas. `;
        }
        if (mensualidadesExistentes > 0) {
            mensaje += `${mensualidadesExistentes} mensualidades ya existían.`;
        }
        
        res.json({ 
            message: mensaje,
            generadas: mensualidadesGeneradas,
            existentes: mensualidadesExistentes
        });
    } catch (err) {
        console.error('Error general al generar mensualidades:', err);
        res.status(500).json({ 
            message: 'Error al generar mensualidades. Detalles: ' + err.message 
        });
    }
});

// Función para generar factura PDF
async function generarFacturaPDF(pago, estudiante, representante) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const filename = `factura_${estudiante.cedula}_${pago.mes}_${pago.año}.pdf`;
            const filepath = path.join(__dirname, '..', 'public', 'facturas', filename);
            
            // Crear directorio si no existe
            const facturasDir = path.dirname(filepath);
            if (!fs.existsSync(facturasDir)) {
                fs.mkdirSync(facturasDir, { recursive: true });
            }
            
            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);
            
            // Encabezado
            doc.fontSize(20).font('Helvetica-Bold').text('COLEGIO', { align: 'center' });
            doc.fontSize(16).font('Helvetica').text('FACTURA DE MENSUALIDAD', { align: 'center' });
            doc.moveDown();
            
            // Información del colegio
            doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL COLEGIO:');
            doc.fontSize(10).font('Helvetica').text('Dirección: Av. Principal, Ciudad');
            doc.text('Teléfono: (123) 456-7890');
            doc.text('Email: info@colegio.edu');
            doc.moveDown();
            
            // Información del representante
            doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL REPRESENTANTE:');
            doc.fontSize(10).font('Helvetica').text(`Nombre: ${representante.nombre}`);
            doc.text(`Email: ${representante.email}`);
            doc.moveDown();
            
            // Información del estudiante
            doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL ESTUDIANTE:');
            doc.fontSize(10).font('Helvetica').text(`Nombre: ${estudiante.nombre}`);
            doc.text(`Cédula: ${estudiante.cedula}`);
            doc.text(`Grado: ${estudiante.grado}`);
            doc.moveDown();
            
            // Información del pago
            doc.fontSize(12).font('Helvetica-Bold').text('DETALLES DEL PAGO:');
            doc.fontSize(10).font('Helvetica').text(`Mes: ${getNombreMes(pago.mes)} ${pago.año}`);
            doc.text(`Fecha de Pago: ${new Date(pago.fecha_pago).toLocaleDateString('es-ES')}`);
            doc.text(`Concepto: ${pago.concepto}`);
            doc.moveDown();
            
            // Tabla de montos
            doc.fontSize(12).font('Helvetica-Bold').text('RESUMEN DE PAGO:');
            doc.fontSize(10).font('Helvetica').text(`Monto: Bs. ${pago.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
            doc.moveDown();
            
            // Pie de página
            doc.fontSize(8).font('Helvetica').text('Esta factura es un comprobante oficial de pago.', { align: 'center' });
            doc.text(`Generada el: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
            
            doc.end();
            
            stream.on('finish', () => {
                resolve(filename);
            });
            
            stream.on('error', (error) => {
                reject(error);
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

// Función auxiliar para obtener nombre del mes
function getNombreMes(mes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1];
}

// Registrar un pago de mensualidad con generación de factura
app.post('/api/representante/pagos', auth('representante'), async (req, res) => {
    try {
        const { estudiante_id, mes, año } = req.body;
        const id_representante = req.session.user.id;

        // Validaciones
        if (año !== 2025) {
            return res.status(400).json({ message: 'Solo se permiten pagos para el año 2025.' });
        }

        // Verificar que el estudiante pertenece al representante
        const verificacion = await db.query('SELECT id FROM estudiantes WHERE id = $1 AND id_representante = $2', [estudiante_id, id_representante]);
        if (verificacion.rows.length === 0) {
            return res.status(403).json({ message: 'No tiene permiso para realizar pagos para este estudiante.' });
        }

        // Verificar si ya existe un pago para ese mes/año
        const pagoExistente = await db.query('SELECT id FROM pagos WHERE id_estudiante = $1 AND mes = $2 AND año = $3', [estudiante_id, mes, año]);
        if (pagoExistente.rows.length > 0) {
            return res.status(409).json({ message: 'Ya existe un pago registrado para este mes y año.' });
        }

        // Calcular fecha de vencimiento (último día del mes)
        const fechaVencimiento = new Date(año, mes, 0);

        // Registrar el pago como pagado
        const result = await db.query(`
            INSERT INTO pagos (id_estudiante, mes, año, monto, estado, fecha_pago, fecha_vencimiento)
            VALUES ($1, $2, $3, $4, 'pagado', CURRENT_DATE, $5)
            RETURNING *
        `, [estudiante_id, mes, año, 12480.00, fechaVencimiento]);

        const pago = result.rows[0];

        // Obtener datos del estudiante y representante para la factura
        const estudianteResult = await db.query('SELECT * FROM estudiantes WHERE id = $1', [estudiante_id]);
        const representanteResult = await db.query('SELECT * FROM representantes WHERE id = $1', [id_representante]);

        const estudiante = estudianteResult.rows[0];
        const representante = representanteResult.rows[0];

        // Generar factura PDF
        const facturaFilename = await generarFacturaPDF(pago, estudiante, representante);

        res.status(201).json({
            ...pago,
            factura_url: `/facturas/${facturaFilename}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al registrar el pago.' });
    }
});

// --- Rutas para la gestión de Notas por parte del Admin ---

// Obtener todas las notas de un estudiante (versión admin)
app.get('/api/admin/estudiantes/:id/notas', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const notasResult = await db.query('SELECT id, materia, calificacion, periodo FROM notas WHERE id_estudiante = $1 ORDER BY periodo, materia', [id]);
        res.json(notasResult.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener las notas del estudiante.' });
    }
});

// Actualizar una nota
app.put('/api/notas/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    const { materia, calificacion, periodo } = req.body;
    if (!materia || !calificacion || !periodo) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    try {
        const result = await db.query(
            'UPDATE notas SET materia = $1, calificacion = $2, periodo = $3 WHERE id = $4 RETURNING *',
            [materia, calificacion, periodo, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Nota no encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar la nota.' });
    }
});

// Eliminar una nota
app.delete('/api/notas/:id', auth('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM notas WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Nota no encontrada.' });
        }
        res.status(200).json({ message: 'Nota eliminada con éxito.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar la nota.' });
    }
});

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
}); 