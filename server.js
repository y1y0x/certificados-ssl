const express = require('express');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Blob Storage
const connectionString = process.env.BLOB_CONNECTION_STRING;
const containerName = 'ssl-data';
const blobName = 'data.json';

async function getBlobClient() {
    if (!connectionString) {
        throw new Error('Falta la variable BLOB_CONNECTION_STRING');
    }
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
    return containerClient.getBlockBlobClient(blobName);
}

// Endpoint GET - Leer datos
app.get('/api/ssl-data', async (req, res) => {
    try {
        const blockBlobClient = await getBlobClient();
        const downloadResponse = await blockBlobClient.download(0);
        const downloaded = await streamToString(downloadResponse.readableStreamBody);
        const data = downloaded ? JSON.parse(downloaded) : { certificados: [], aplicaciones: [] };
        res.json(data);
    } catch (err) {
        // Si el blob no existe, devolver estructura vacía
        res.json({ certificados: [], aplicaciones: [] });
    }
});

// Endpoint POST - Guardar datos
app.post('/api/ssl-data', async (req, res) => {
    try {
        const blockBlobClient = await getBlobClient();
        const data = req.body;
        const content = JSON.stringify(data, null, 2);
        await blockBlobClient.upload(content, content.length);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Ruta por defecto - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper para leer streams
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => chunks.push(data.toString()));
        readableStream.on('end', () => resolve(chunks.join('')));
        readableStream.on('error', reject);
    });
}

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});