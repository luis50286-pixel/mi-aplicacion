const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3000;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configurar almacenamiento de Multer guardando directamente el nombre original
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Para evitar sobrescribir si el archivo ya existe
        let fileName = file.originalname;
        let filePath = path.join(uploadsDir, fileName);
        let counter = 1;

        const ext = path.extname(fileName);
        const name = path.basename(fileName, ext);

        while (fs.existsSync(filePath)) {
            fileName = `${name}_(${counter})${ext}`;
            filePath = path.join(uploadsDir, fileName);
            counter++;
        }

        cb(null, fileName);
    }
});

const upload = multer({ storage });

// Servir archivos estáticos
app.use(express.static(__dirname));
app.use('/downloads', express.static(uploadsDir));

// Endpoint para subir un archivo
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No se seleccionó ningún archivo.');
    res.send({ status: 'ok', filename: req.file.filename });
});

// Obtener lista de archivos subidos
app.get('/files', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).send('Error al leer archivos.');
        // Filtrar archivos ocultos si los hay
        const visibleFiles = files.filter(f => !f.startsWith('.'));
        res.json(visibleFiles);
    });
});

// Endpoint para eliminar un archivo
app.delete('/files/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error("Error al eliminar el archivo:", err);
            return res.status(500).send('No se pudo eliminar el archivo.');
        }
        res.send({ status: 'ok', message: 'Archivo eliminado con éxito' });
    });
});

// Obtener IP local
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (let name in interfaces) {
        for (let iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`¡Servidor Local Activo!`);
    console.log(`Desde tu PC entra a: http://localhost:${PORT}`);
    console.log(`Desde tu Celular entra a: http://${getLocalIP()}:${PORT}`);
    console.log(`==================================================\n`);
});