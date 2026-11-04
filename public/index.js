const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    context.log('Procesando solicitud SSL Data...');

    const connectionString = process.env.BLOB_CONNECTION_STRING;
    const containerName = "ssl-data";
    const blobName = "data.json";

    if (!connectionString) {
        context.res = { status: 500, body: "Error: Falta la variable de entorno BLOB_CONNECTION_STRING" };
        return;
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Crea el contenedor si no existe (privado por defecto, seguro)
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    if (req.method === "GET") {
        try {
            const downloadBlockBlobResponse = await blockBlobClient.download(0);
            const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);
            const data = downloaded ? JSON.parse(downloaded) : { certificados: [], aplicaciones: [] };
            context.res = { status: 200, body: data };
        } catch (err) {
            // Si el blob no existe aún, devolvemos estructura vacía
            context.res = { status: 200, body: { certificados: [], aplicaciones: [] } };
        }
    } else if (req.method === "POST") {
        try {
            const data = req.body; // Azure Functions parsea JSON automáticamente
            const content = JSON.stringify(data, null, 2);
            await blockBlobClient.upload(content, content.length);
            context.res = { status: 200, body: { success: true } };
        } catch (err) {
            context.res = { status: 500, body: { success: false, message: err.message } };
        }
    } else {
        context.res = { status: 405, body: "Método no permitido" };
    }
};

async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}