const express = require('express');
const route = express.Router();
require('dotenv').config();

const { authenticate } = require('../middlewares/auth');

const usersController = require('../controllers/usersController');
const chatController = require('../controllers/chatController');
const chatGroup = require('../controllers/chatGroupController');
const verify = require('../controllers/verifikasiTokenController');

const db = require('../db');
const { getIO } = require('../socket');

const multer = require('multer');
const path = require('path');

/* =========================
   MULTER CONFIG
========================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan'), false);
    }
  }
});

/* =========================
   AUTH
========================= */

route.get('/verify-token', verify.verifyToken);

route.post('/logout', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    await db.query(
      `UPDATE users 
       SET status = 'offline',
           last_online = NOW()
       WHERE user_id = ?`,
      [userId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Logout berhasil'
    });

  } catch (error) {
    console.error('Logout error:', error);

    res.status(500).json({
      status: 'error',
      message: 'Gagal logout'
    });
  }
});

/* =========================
   USERS
========================= */

route.get('/users', authenticate, usersController.getAllUsers);
route.put('/updateProfile', authenticate, usersController.updateProfile);
route.get('/contacts',authenticate, usersController.getContacts);
route.get('/users/search', authenticate, usersController.searchUsers);

/* =========================
   PRIVATE CHAT
========================= */

route.get('/:conversationId/messages',
  authenticate,
  chatController.getMessages
);

route.post('/:conversationId/send',
  authenticate,
  upload.single('image'),
  async (req, res) => {

    try {

      const result = await chatController.sendMessage(req);

      const io = getIO();

      io.to(req.params.conversationId)
        .emit("newMessage", result);

      res.status(200).json(result);

    } catch (err) {

      console.error("socket send error:", err);

      res.status(500).json({
        message: 'Gagal mengirim pesan'
      });

    }

  }
);



route.delete('/hapuspesan/:messageId',
  authenticate,
  async (req, res) => {

    try {

      const result = await chatController.hapusPesan(req);

      const io = getIO();

      io.to("chat_" + result.conversationId)
        .emit("messageDeleted", {
          messageId: result.messageId
        });

      res.status(200).json({ message: 'Pesan berhasil dihapus' });

    } catch (err) {

      console.error("delete error:", err);
      res.status(500).json({ error: err.message });

    }

  }
);

route.delete('/hapussemuapesan/:conversationId',
  authenticate,
  chatController.hapusSemuaPesan
);

route.get('/editpesan/:messageId',
  authenticate,
  chatController.editPesan
);

route.put('/updatePesan/:messageId',
  authenticate,
  async (req, res) => {

    try {

      const result = await chatController.updatePesan(req);

      const io = getIO();

      io.to("chat_" + result.conversationId)
        .emit("messageEdited", result);

      res.status(200).json(result);

    } catch (err) {

      console.error("update error:", err);
      res.status(500).json({ error: err.message });

    }

  }
);

/* =========================
   GROUP CHAT
========================= */

route.get('/grup/:groupId/messages',
  authenticate,
  chatGroup.findBygroupId
);

route.post('/grup/:groupId/send',
  authenticate,
  upload.single('image'),
  async (req, res) => {

    try {

      const result = await chatGroup.sendMessage(req);

      const io = getIO();

      io.to("group_" + req.params.groupId)
        .emit("newGroupMessage", result);

      res.status(200).json(result);

    } catch (err) {

      console.error("socket group error:", err);

      res.status(500).json({
        message: 'Gagal kirim pesan grup'
      });

    }

  }
);

route.delete('/delete/grup/:messageId',
  authenticate,
  chatGroup.deleteGrupMessage
);

route.get('/editpesangrup/:messageId',
  authenticate,
  chatGroup.editPesanGrup
);

route.put('/updatepesangrup/:messageId',
  authenticate,
  chatGroup.updatePesanGrup
);

/* =========================
   CONVERSATION
========================= */

route.post('/conversations/start',
  authenticate,
  chatController.newChatBuild
);

/* =========================
   GROUP MANAGEMENT
========================= */

route.post('/newGroup',
  authenticate,
  chatGroup.createGroup
);

route.get('/allGroup',
  authenticate,
  chatGroup.allGrup
);

/* =========================
   EXPORT
========================= */

module.exports = route;