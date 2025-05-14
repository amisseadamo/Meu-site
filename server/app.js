import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

// Array para simular um banco de dados de usuários
const users = [];

// Lista fixa de produtos disponíveis
const availableProducts = [
    { name: 'Milho Orgânico', price: 5.00 },
    { name: 'Feijão Carioca', price: 8.00 },
    { name: 'Tomate Orgânico', price: 6.00 }
];

// Objeto para rastrear o número de perguntas por usuário (usando socket.id)
const userQuestionCount = {};

// Middleware para parsing de JSON
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Middleware para verificar autenticação
const authenticate = (req, res, next) => {
    const authToken = req.headers['authorization'];
    const user = users.find(u => u.token === authToken);
    if (user) {
        req.user = user;
        next();
    } else {
        res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
};

// Rota de login
app.post('/login', (req, res) => {
    console.log('Tentativa de login:', req.body);
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        const token = `token-${email}-${Date.now()}`;
        user.token = token;
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: 'Email ou senha inválidos.' });
    }
});

// Rota de cadastro
app.post('/register', (req, res) => {
    console.log('Tentativa de cadastro:', req.body);
    const { name, email, password } = req.body;
    if (users.find(u => u.email === email)) {
        res.status(400).json({ success: false, message: 'Email já registrado.' });
    } else {
        users.push({ name, email, password });
        res.json({ success: true, message: 'Cadastro realizado com sucesso!' });
    }
});

// Rota para o formulário de contato (protegida)
app.post('/send-message', authenticate, (req, res) => {
    res.json({ message: 'Mensagem enviada com sucesso!' });
});

// Rota para finalizar pedido (protegida)
app.post('/checkout', authenticate, (req, res) => {
    const { cart } = req.body;
    res.json({ message: 'Pedido finalizado com sucesso!' });
});

// Função para gerar a hora atual
const getCurrentTime = () => {
    const date = new Date();
    return date.toLocaleTimeString();
};

// Função para extrair o nome do produto da mensagem
const extractProductName = (message) => {
    const keywords = ['tem ', 'tem?', 'há ', 'há?'];
    for (let keyword of keywords) {
        if (message.toLowerCase().includes(keyword)) {
            let productPart = message.toLowerCase().replace(keyword, '').trim();
            // Remover caracteres indesejados como "?" e normalizar
            productPart = productPart.replace(/[?]/g, '').trim();
            // Tentar corresponder a variações simples (ex.: "tomate" para "Tomate Orgânico")
            return productPart.split(' ')[0]; // Pega apenas a primeira palavra como base
        }
    }
    return null;
};

// WebSocket para o chat
io.on('connection', (socket) => {
    console.log('Novo usuário conectado');

    // Inicializar o contador de perguntas para o usuário
    userQuestionCount[socket.id] = 0;

    socket.on('chat-message', (data) => {
        // Enviar a mensagem do usuário para todos os clientes
        io.emit('chat-message', data);

        // Verificar se a mensagem é uma consulta sobre produto
        const message = data.message.toLowerCase();
        const productName = extractProductName(message);

        if (productName) {
            // Incrementar o contador de perguntas
            userQuestionCount[socket.id] = (userQuestionCount[socket.id] || 0) + 1;

            // Normalizar o nome do produto para comparação
            const normalizedProductName = productName.charAt(0).toUpperCase() + productName.slice(1);
            // Verificar se o produto existe (busca parcial no início do nome)
            const product = availableProducts.find(p => 
                p.name.toLowerCase().startsWith(normalizedProductName.toLowerCase())
            );
            const responseMessage = product
                ? `Sim, temos ${product.name} disponível por MZN ${product.price.toFixed(2)}/kg.`
                : `Desculpe, não temos ${normalizedProductName} disponível no momento.`;

            // Enviar resposta automática como "AgroVendas"
            io.emit('chat-message', {
                name: 'AgroVendas',
                message: responseMessage,
                time: getCurrentTime()
            });

            // Verificar se o usuário atingiu 3 perguntas
            if (userQuestionCount[socket.id] >= 3) {
                const supportMessage = 'Você fez várias perguntas sobre produtos. Deseja falar com o administrador para mais informações?';
                io.emit('chat-message', {
                    name: 'AgroVendas',
                    message: supportMessage,
                    time: getCurrentTime()
                });
                // Resetar o contador após enviar a mensagem
                userQuestionCount[socket.id] = 0;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuário desconectado');
        // Limpar o contador do usuário ao desconectar
        delete userQuestionCount[socket.id];
    });
});

// Redirecionar para login.html como página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Proteger acesso a index.html e chat.html
app.get('/index.html', (req, res, next) => {
    const authToken = req.headers['authorization'] || req.query.token;
    const user = users.find(u => u.token === authToken);
    if (user) {
        next();
    } else {
        res.redirect('/login.html');
    }
});

app.get('/chat.html', (req, res, next) => {
    const authToken = req.headers['authorization'] || req.query.token;
    const user = users.find(u => u.token === authToken);
    if (user) {
        next();
    } else {
        res.redirect('/login.html');
    }
});

server.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});