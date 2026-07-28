const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const webpush = require('web-push');
const http = require('http'); // Importamos http
const { Server } = require('socket.io'); // Importamos Socket.IO

const app = express();
const server = http.createServer(app); // Creamos el servidor HTTP con Express
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());

// CONFIGURACIÓN WEBPUSH (Remplaza las variables con tus credenciales)
const PUBLIC_VAPID_KEY = 'BHy7T_n9pJEoSmYVCOxRb4_TK3IxM6vAekhJf_10t3OgRleZLQUsaVdXLW3uW0nXC-35QpPZmwB96m8Wx-OkcQY';
const PRIVATE_VAPID_KEY = 'dK-haDjSnLc2HjaM-qTULS_3EPlUu_RrSt3gm_p93q0';

webpush.setVapidDetails(
    'mailto:admin@local.com',
    PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY
);

let subscriptions = [];

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
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

// --- LÓGICA DE SOCKET.IO (CHAT EN TIEMPO REAL) ---
io.on('connection', (socket) => {
    console.log(`Usuario conectado al chat ID: ${socket.id}`);

    // Cuando un cliente envía un mensaje
    socket.on('chatMessage', (data) => {
        // Reemitir el mensaje a TODOS los clientes conectados
        io.emit('chatMessage', data);
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
    });
});

// Endpoints API
app.get('/vapid-key', (req, res) => res.json({ publicKey: PUBLIC_VAPID_KEY }));

app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
    res.status(201).json({ status: 'ok' });
});

function notifyClients(fileNameCount) {
    const payload = JSON.stringify({
        title: '📩 ¡Nuevo Archivo Recibido!',
        body: `Se ha(n) subido ${fileNameCount} nuevo(s) archivo(s) a la red.`
    });

    subscriptions.forEach((sub, index) => {
        webpush.sendNotification(sub, payload).catch(err => {
            console.error('Error enviando notificación:', err);
            if (err.statusCode === 410 || err.statusCode === 404) {
                subscriptions.splice(index, 1);
            }
        });
    });
}

app.post('/upload', upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No se seleccionó ningún archivo.');
    }
    
    const uploadedFiles = req.files.map(file => file.filename);
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

// Escuchar eventos con 'server.listen' en lugar de 'app.listen'
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`¡Servidor Local Activo!`);
    console.log(`Desde tu PC entra a: http://localhost:${PORT}`);
    console.log(`Desde tu Celular entra a: http://${getLocalIP()}:${PORT}`);
    console.log(`==================================================\n`);
});
