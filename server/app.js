require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const routes = require('./routes');

// Configura armazenamento de uploads
const upload = multer({
  dest: path.join(__dirname, '../public/uploads'),
  limits: { fileSize: 20 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      console.log('Arquivo válido:', file.originalname);
      cb(null, true);
    } else {
      console.log('Arquivo inválido:', file.mimetype);
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou GIF.'));
    }
  }
});

// Middleware para processar JSON
app.use(express.json());

// Configura pasta public para arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Middleware de autenticação
async function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  console.log('Verificando token:', token ? 'Token presente' : 'Token ausente');
  if (!token) {
    console.log('Redirecionando para login.html: sem token');
    return res.redirect('/login.html');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    console.log('Token decodificado:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Erro de autenticação:', error.message);
    res.redirect('/login.html');
  }
}

// Middleware para verificar se é admin
async function adminMiddleware(req, res, next) {
  try {
    console.log('Verificando permissão de admin para:', req.user.email);
    const users = JSON.parse(await fs.readFile(path.join(__dirname, 'users.json'), 'utf8'));
    const user = users.find(u => u.email === req.user.email);
    if (user && user.isAdmin) {
      console.log('Usuário é admin:', user.email);
      next();
    } else {
      console.log('Acesso negado: usuário não é admin:', req.user.email);
      res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
    }
  } catch (error) {
    console.error('Erro ao verificar admin:', error.message);
    res.status(500).json({ message: 'Erro ao verificar permissões.' });
  }
}

// Rota para a página inicial
app.get('/', (req, res) => {
  console.log('Acessando raiz, redirecionando para login.html');
  res.redirect('/login.html');
});

// Rota para login.html
app.get('/login.html', (req, res) => {
  console.log('Servindo login.html');
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Rota para admin.html (protegida)
app.get('/admin.html', authMiddleware, adminMiddleware, (req, res) => {
  console.log('Servindo admin.html para:', req.user.email);
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Usa as rotas definidas em routes.js
app.use('/api', routes);

// Gerenciamento de usuários online para o chat
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  socket.on('register-user', (userData) => {
    if (userData.email && userData.name) {
      onlineUsers.set(socket.id, { email: userData.email, name: userData.name });
      console.log('Usuário registrado:', userData);
      io.to('admin-room').emit('online-users', Array.from(onlineUsers.entries()));
    }
  });

  socket.on('join-admin', () => {
    socket.join('admin-room');
    console.log('Administrador entrou na sala admin:', socket.id);
    socket.emit('online-users', Array.from(onlineUsers.entries()));
  });

  socket.on('admin-message', ({ toSocketId, message }) => {
    console.log('Mensagem de admin para:', toSocketId, message);
    io.to(toSocketId).emit('receive-message', {
      from: 'Administrador',
      message,
      timestamp: new Date().toISOString(),
    });
    socket.emit('receive-message', {
      from: 'Administrador',
      to: onlineUsers.get(toSocketId)?.email || 'Desconhecido',
      message,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('user-message', ({ message }) => {
    const user = onlineUsers.get(socket.id);
    console.log('Mensagem de usuário:', user?.email, message);
    io.to('admin-room').emit('receive-message', {
      from: user?.email || 'Desconhecido',
      message,
      timestamp: new Date().toISOString(),
    });
    socket.emit('receive-message', {
      from: user?.email || 'Desconhecido',
      message,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    onlineUsers.delete(socket.id);
    io.to('admin-room').emit('online-users', Array.from(onlineUsers.entries()));
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro no servidor:', err.message);
  res.status(500).json({ message: 'Erro interno no servidor: ' + err.message });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});