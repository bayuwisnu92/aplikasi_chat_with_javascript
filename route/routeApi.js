const express = require('express');
const route = express.Router();
require('dotenv').config();
const { authenticate } = require('../middlewares/auth');
const usersController = require('../controllers/usersController');
const chatController = require('../controllers/chatController')
const verify = require('../controllers/verifikasiTokenController')
const chatGroup = require('../controllers/chatGroupController')
const db = require('../db')
const multer = require('multer');
const path = require('path');

// Konfigurasi penyimpanan
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); // Pastikan folder ini ada
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unik
  }
});

const upload = multer({ storage });



// express.Router
route.get('/verify-token', verify.verifyToken)
route.get('/users',authenticate,usersController.getAllUsers)

route.get('/:conversationId/messages', authenticate,chatController.getMessages)
route.post('/:conversationId/send', authenticate,upload.single('image'),chatController.sendMessage)
route.delete('/hapuspesan/:messageId',authenticate,chatController.hapusPesan)
route.delete('/hapussemuapesan/:conversationId',authenticate,chatController.hapusSemuaPesan)
route.get('/editpesan/:messageId',authenticate,chatController.editPesan)
route.get('/editpesangrup/:messageId',authenticate,chatGroup.editPesanGrup)
route.put('/updatePesan/:messageId',authenticate,chatController.updatePesan)
route.put('/updatepesangrup/:messageId',authenticate,chatGroup.updatePesanGrup)

route.put('/updateProfile',authenticate,usersController.updateProfile)

route.get('/grup/:groupId/messages', authenticate,chatGroup.findBygroupId)
route.post('/grup/:groupId/send', authenticate,upload.single('image'),chatGroup.sendMessage)
route.delete('/delete/grup/:messageId',authenticate,chatGroup.deleteGrupMessage)

// Cek atau buat percakapan privat antara 2 user
route.post('/conversations/start', authenticate, chatController.newChatBuild)

// route untuk membuat grup

route.post('/newGroup', authenticate, chatGroup.createGroup)
route.get('/allGroup',authenticate, chatGroup.allGrup)

route.post('/logout', authenticate, async (req, res) => {
  try {
    // Gunakan req.user dari middleware authenticate
    const userId = req.user.userId;

    await db.query(
      `UPDATE users 
   SET status = 'offline', 
       last_online = NOW() 
   WHERE user_id = ?`,
  [userId]
    );

    // Kirim respons sukses
    res.status(200).json({
      status: 'success',
      message: 'Logout berhasil'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengupdate status'
    });
  }
});




module.exports = route;