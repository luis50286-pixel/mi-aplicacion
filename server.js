const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const webpush = require('web-push'); // <-- Agregado

const app = express();
const PORT = process.env.PORT || 3000;

// Permite procesar JSON en el body de las peticiones
app.use(express.json());

// CONFIGURACIÓN WEBPUSH (Reemplaza con tus claves)
const Public Key:BHy7T_n9pJEoSmYVCOxRb4_TK3IxM6vAekhJf_10t3OgRleZLQUsaVdXLW3uW0nXC-35QpPZmwB96m8Wx-OkcQY
const Private Key:dK-haDjSnLc2HjaM-qTULS_3EPlUu_RrSt3gm_p93q0
webpush.setVapidDetails(
    'mailto:admin@local.com',
    PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY
);

// Arreglo en memoria para guardar las suscripciones activas
let subscriptions = [];

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
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

app.use(express.static(__dirname));
app.use('/downloads', express.static(uploadsDir));

// Endpoint para enviar la clave pública al cliente
app.get('/vapid-key', (req, res) => {
    res.json({ publicKey: PUBLIC_VAPID_KEY });
});

// Endpoint para suscribirse a las notificaciones
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
    res.status(201).json({ status: 'ok' });
});

// Función para notificar a todos los dispositivos registrados
function notifyClients(fileNameCount) {
    const payload = JSON.stringify({
        title: '📩 ¡Nuevo Archivo Recibido!',
        body: `Se ha(n) subido ${fileNameCount} nuevo(s) archivo(s) a la red.`
    });

    subscriptions.forEach((sub, index) => {
        webpush.sendNotification(sub, payload).catch(err => {
            console.error('Error enviando notificación:', err);
            // Si la suscripción ya no es válida o caducó, eliminarla
            if (err.statusCode === 410 || err.statusCode === 404) {
                subscriptions.splice(index, 1);
            }
        });
    });
}

// Endpoint para subir archivos + Notificación
app.post('/upload', upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No se seleccionó ningún archivo.');
    }
    
    const uploadedFiles = req.files.map(file => file.filename);
    
    // Notificar a los dispositivos conectados
    notifyClients(req.files.length);

    res.send({ status: 'ok', filenames: uploadedFiles });
});

app.get('/files', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).send('Error al leer archivos.');
        const visibleFiles = files.filter(f => !f.startsWith('.'));
        res.json(visibleFiles);
    });
});

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
