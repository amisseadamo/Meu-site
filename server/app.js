const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '..'))); // Serve static files (HTML, CSS)

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html')); // Default to index.html
});

const users = new Set();

wss.on('connection', ws => {
    console.log('Novo cliente conectado');

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'join') {
                ws.username = data.username;
                users.add(data.username);
                broadcast({ type: 'join', username: data.username });
            } else if (data.type === 'message') {
                broadcast({ type: 'message', username: data.username, message: data.message });
            }
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
        }
    });

    ws.on('close', () => {
        if (ws.username) {
            users.delete(ws.username);
            broadcast({ type: 'leave', username: ws.username });
            console.log('Cliente desconectado');
        }
    });
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});