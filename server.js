const express = require('express');
const app = express();
const port = 3000;

const routeApi = require('./route/routeApi');
const authRoutes = require('./route/authRoutes');

const path = require('path');
const cookieParser = require('cookie-parser');
const http = require('http');
const server = http.createServer(app);
const cors = require('cors');

require('dotenv').config();

const { initSocket } = require('./socket');

// CORS
app.use(cors({
  origin: [
    'http://127.0.0.1:5501',
    'https://bayuwisnu92.github.io'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(cookieParser());

// Static file (gambar upload)
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket
initSocket(server);

// Routes
app.use('/api', routeApi);
app.use('/auth', authRoutes);


// Run server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});