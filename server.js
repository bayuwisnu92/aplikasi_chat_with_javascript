const express = require('express');
const app = express();
const port = 3000;
const routeApi =require('./route/routeApi')
const authRoutes = require('./route/authRoutes')
const path = require('path')
const cookieParser = require('cookie-parser');
const cors = require('cors'); // Import package cors



require('dotenv').config();
app.use(cors({
  origin: 'http://127.0.0.1:5501', // Ganti dengan origin frontend Anda
  credentials: true, // Untuk mengizinkan cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Izinkan method tertentu
  allowedHeaders: ['Content-Type', 'Authorization'] // Izinkan headers
}));
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use('/api',routeApi)
app.use(cookieParser()); // Harus dipasang SEBELUM middleware auth
app.use('/auth',authRoutes)

app.listen(port,()=>{
    console.log(`server is running on port ${port}`) 
})


