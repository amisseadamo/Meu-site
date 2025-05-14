import express from 'express';
const router = express.Router();

// Simulated database
let users = [];

router.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    const userExists = users.find(u => u.email === email);
    if (userExists) {
        return res.status(400).json({ message: 'Email already registered.' });
    }
    users.push({ name, email, password });
    console.log('User registered:', { name, email });
    res.status(200).json({ message: 'Registration successful!' });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        res.status(200).json({ message: 'Login successful!' });
    } else {
        res.status(401).json({ message: 'Invalid email or password.' });
    }
});

export default router; // Adicionar export default