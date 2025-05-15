// src/server.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Servidor rodando!');
});

app.listen(PORT, () => {
  console.log(`Servidor escutando na porta ${PORT}`);
});
