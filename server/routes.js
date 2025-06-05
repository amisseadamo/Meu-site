const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');

// Configura armazenamento de uploads
const upload = multer({
  dest: path.join(__dirname, '../public/uploads'),
  limits: { fileSize: 5 * 1024 * 1024 },
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

// Caminho para os arquivos JSON
const usersFilePath = path.join(__dirname, 'users.json');
const productsFilePath = path.join(__dirname, 'products.json');

// Função para ler usuários
async function readUsers() {
  try {
    const data = await fs.readFile(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Arquivo users.json não encontrado, criando novo.');
      await fs.writeFile(usersFilePath, '[]');
      return [];
    }
    throw new Error(`Erro ao ler users.json: ${error.message}`);
  }
}

// Função para escrever usuários
async function writeUsers(users) {
  try {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
    console.log('Arquivo users.json atualizado com sucesso.');
  } catch (error) {
    throw new Error(`Erro ao escrever em users.json: ${error.message}`);
  }
}

// Função para ler produtos
async function readProducts() {
  try {
    const data = await fs.readFile(productsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Arquivo products.json não encontrado, criando novo.');
      await fs.writeFile(productsFilePath, '[]');
      return [];
    }
    throw new Error(`Erro ao ler products.json: ${error.message}`);
  }
}

// Função para escrever produtos
async function writeProducts(products) {
  try {
    await fs.writeFile(productsFilePath, JSON.stringify(products, null, 2));
    console.log('Arquivo products.json atualizado com sucesso.');
  } catch (error) {
    throw new Error(`Erro ao escrever em products.json: ${error.message}`);
  }
}

// Rota de cadastro
router.post('/register', async (req, res) => {
  console.log('Requisição recebida em /api/register:', req.body);
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    console.log('Campos obrigatórios ausentes:', { name, email, password });
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const users = await readUsers();
    const userExists = users.find(u => u.email === email);
    if (userExists) {
      console.log('Email já registrado:', email);
      return res.status(400).json({ message: 'Email already registered.' });
    }

    users.push({ name, email, password, isAdmin: false });
    await writeUsers(users);

    console.log('Usuário registrado com sucesso:', { name, email });
    res.status(200).json({ message: 'Registration successful!' });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error.message);
    res.status(500).json({ message: 'Erro ao cadastrar. Tente novamente.' });
  }
});

// Rota de login
router.post('/login', async (req, res) => {
  console.log('Requisição recebida em /api/login:', req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    console.log('Campos obrigatórios ausentes:', { email, password });
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const users = await readUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      console.log('Login bem-sucedido para:', email);
      const token = jwt.sign({ email, name: user.name, isAdmin: user.isAdmin }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
      res.status(200).json({ message: 'Login successful!', token, user: { email, name: user.name, isAdmin: user.isAdmin } });
    } else {
      console.log('Credenciais inválidas para:', email);
      res.status(401).json({ message: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error.message);
    res.status(500).json({ message: 'Erro ao fazer login. Tente novamente.' });
  }
});

// Rotas de Produtos
router.get('/products', async (req, res) => {
  console.log('Requisição recebida em /api/products');
  try {
    const products = await readProducts();
    console.log('Produtos retornados:', products.map(p => ({ id: p.id, name: p.name, price: p.price, image: p.image })));
    res.status(200).json(products);
  } catch (error) {
    console.error('Erro ao ler produtos:', error.message);
    res.status(500).json({ message: 'Erro ao buscar produtos.' });
  }
});

router.post('/products', upload.single('image'), async (req, res) => {
  console.log('Requisição recebida em /api/products POST:', req.body, req.file);
  const { name, price } = req.body;
  if (!name || !price) {
    console.log('Campos obrigatórios ausentes:', { name, price });
    return res.status(400).json({ message: 'Name and price are required.' });
  }

  try {
    const products = await readProducts();
    const newProduct = {
      id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
      name,
      price: parseFloat(price),
      image: req.file ? `/uploads/${req.file.filename}` : null
    };
    products.push(newProduct);
    await writeProducts(products);
    console.log('Produto adicionado:', newProduct);
    res.status(200).json({ message: 'Product added successfully!', product: newProduct });
  } catch (error) {
    console.error('Erro ao adicionar produto:', error.message);
    res.status(500).json({ message: 'Erro ao adicionar produto: ' + error.message });
  }
});

router.put('/products/:id', upload.single('image'), async (req, res) => {
  console.log('Requisição recebida em /api/products/:id PUT:', req.params.id, req.body, req.file);
  const { id } = req.params;
  const { name, price } = req.body;
  if (!name || !price) {
    console.log('Campos obrigatórios ausentes:', { name, price });
    return res.status(400).json({ message: 'Name and price are required.' });
  }

  try {
    const products = await readProducts();
    const productIndex = products.findIndex(p => p.id === parseInt(id));
    if (productIndex === -1) {
      console.log('Produto não encontrado:', id);
      return res.status(404).json({ message: 'Product not found.' });
    }
    products[productIndex] = {
      id: parseInt(id),
      name,
      price: parseFloat(price),
      image: req.file ? `/uploads/${req.file.filename}` : products[productIndex].image
    };
    await writeProducts(products);
    console.log('Produto atualizado:', products[productIndex]);
    res.status(200).json({ message: 'Product updated successfully!', product: products[productIndex] });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error.message);
    res.status(500).json({ message: 'Erro ao atualizar produto: ' + error.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  console.log('Requisição recebida em /api/products/:id DELETE:', req.params.id);
  const { id } = req.params;
  try {
    const products = await readProducts();
    const productIndex = products.findIndex(p => p.id === parseInt(id));
    if (productIndex === -1) {
      console.log('Produto não encontrado:', id);
      return res.status(404).json({ message: 'Product not found.' });
    }
    const deletedProduct = products.splice(productIndex, 1);
    await writeProducts(products);
    console.log('Produto removido:', deletedProduct);
    res.status(200).json({ message: 'Product deleted successfully!' });
  } catch (error) {
    console.error('Erro ao remover produto:', error.message);
    res.status(500).json({ message: 'Erro ao remover produto.' });
  }
});

// Rotas de Gerenciamento de Administradores
router.get('/admins', async (req, res) => {
  console.log('Requisição recebida em /api/admins');
  try {
    const users = await readUsers();
    const admins = users.filter(u => u.isAdmin);
    console.log('Administradores retornados:', admins);
    res.status(200).json(admins);
  } catch (error) {
    console.error('Erro ao buscar administradores:', error.message);
    res.status(500).json({ message: 'Erro ao buscar administradores.' });
  }
});

router.post('/admins', async (req, res) => {
  console.log('Requisição recebida em /api/admins POST:', req.body);
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    console.log('Campos obrigatórios ausentes:', { name, email, password });
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const users = await readUsers();
    const userExists = users.find(u => u.email === email);
    if (userExists) {
      console.log('Email já registrado:', email);
      return res.status(400).json({ message: 'Email already registered.' });
    }

    users.push({ name, email, password, isAdmin: true });
    await writeUsers(users);
    console.log('Administrador adicionado:', { name, email });
    res.status(200).json({ message: 'Admin added successfully!' });
  } catch (error) {
    console.error('Erro ao adicionar administrador:', error.message);
    res.status(500).json({ message: 'Erro ao adicionar administrador.' });
  }
});

router.put('/admins/:email', async (req, res) => {
  console.log('Requisição recebida em /api/admins/:email PUT:', req.params.email, req.body);
  const { email } = req.params;
  const { name, password } = req.body;
  if (!name) {
    console.log('Nome obrigatório ausente');
    return res.status(400).json({ message: 'Name is required.' });
  }

  try {
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) {
      console.log('Administrador não encontrado:', email);
      return res.status(404).json({ message: 'Admin not found.' });
    }
    users[userIndex].name = name;
    if (password) {
      users[userIndex].password = password;
    }
    await writeUsers(users);
    console.log('Administrador atualizado:', { name, email });
    res.status(200).json({ message: 'Admin updated successfully!' });
  } catch (error) {
    console.error('Erro ao atualizar administrador:', error.message);
    res.status(500).json({ message: 'Erro ao atualizar administrador.' });
  }
});

router.delete('/admins/:email', async (req, res) => {
  console.log('Requisição recebida em /api/admins/:email DELETE:', req.params.email);
  const { email } = req.params;
  try {
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.email === email && u.isAdmin);
    if (userIndex === -1) {
      console.log('Administrador não encontrado:', email);
      return res.status(404).json({ message: 'Admin not found.' });
    }
    const deletedAdmin = users.splice(userIndex, 1);
    await writeUsers(users);
    console.log('Administrador removido:', deletedAdmin);
    res.status(200).json({ message: 'Admin deleted successfully!' });
  } catch (error) {
    console.error('Erro ao remover administrador:', error.message);
    res.status(500).json({ message: 'Erro ao remover administrador.' });
  }
});

module.exports = router;