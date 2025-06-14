const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_PATH = path.join(__dirname, 'data', 'data.json');

app.use(express.static('public'));
app.use(express.json());

app.get('/data', (req, res) => {
  const raw = fs.readFileSync(DATA_PATH);
  res.json(JSON.parse(raw));
});

app.post('/:type', (req, res) => {
  const { type } = req.params;
  if (!['timeline', 'conflicts'].includes(type)) return res.status(400).send('Invalid type');
  const raw = fs.readFileSync(DATA_PATH);
  const data = JSON.parse(raw);
  const entry = req.body;
  data[type].push(entry);
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  res.status(201).send('Entry saved');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));