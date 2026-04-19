const Message = require('../models/message');
const User = require('../models/users');
const db = require('../db');
const Conversation = require('../models/conversationModel');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class ChatController {
  
  static async newChatBuild(req,res){
  try {
    const { otherUserId } = req.body;
    const currentUserId = req.user.userId; // ✅ cocokkan dengan token

    console.log('Mencari user:', { currentUserId, otherUserId });

    // 1. Cek apakah kedua user ada
    const [users] = await db.query(
      `SELECT user_id FROM users WHERE user_id IN (?, ?)`,
      [currentUserId, otherUserId]
    );

    console.log('User yang ditemukan:', users);

    const foundCurrentUser = users.some(u => u.user_id === currentUserId);
    const foundOtherUser = users.some(u => u.user_id === otherUserId);

    if (!foundCurrentUser || !foundOtherUser) {
      return res.status(404).json({
        success: false,
        error: 'User tidak ditemukan',
        details: {
          currentUserExists: foundCurrentUser,
          otherUserExists: foundOtherUser,
          searchedIds: [currentUserId, otherUserId]
        }
      });
    }

    // 2. Cek apakah conversation sudah ada
    const [existing] = await db.query(
  `SELECT conversation_id FROM conversations 
   WHERE (user_one = ? AND user_two = ?) 
      OR (user_one = ? AND user_two = ?)
   LIMIT 1`,
  [currentUserId, otherUserId, otherUserId, currentUserId]
);

    let conversationId;

    if (existing.length > 0) {
      conversationId = existing[0].conversation_id;
      return res.json({ conversationId }); 
    } else {
      // 3. Buat conversation baru
      const [insert] = await db.query(
        `INSERT INTO conversations (user_one, user_two) VALUES (?, ?)`,
        [currentUserId, otherUserId]
      );
      conversationId = insert.insertId;
      console.log('Percakapan baru dibuat, id:', conversationId);

    }

    // 4. Kirim response ke frontend
    return res.json({ conversationId });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
static async sendMessage(req) {
  try {
    const { content } = req.body;
    const { conversationId } = req.params;
    const senderId = req.user.userId;

    // 1. Cari data conversation untuk menentukan receiverId
    const conversation = await Conversation.getById(conversationId);
    if (!conversation) throw new Error("Conversation tidak ditemukan");

    const receiverId = conversation.user_one === senderId 
      ? conversation.user_two 
      : conversation.user_one;

    let messageType = 'text';
    let imageUrl = null;

    // Cek apakah ada file yang diupload
    if (req.file) {
    messageType = 'image';
    
    // 1. Tentukan nama file (pakai .webp supaya jauh lebih ringan)
    const fileName = `chat-${Date.now()}.webp`;
    const uploadPath = path.join(__dirname, '../public/uploads', fileName);

    // 2. Proses Kompresi
    await sharp(req.file.buffer) // Mengambil data dari memoryStorage
        .resize({ width: 800, withoutEnlargement: true }) // Kecilkan lebar ke 800px (jika aslinya lebih besar)
        .webp({ quality: 75 }) // Kompres kualitas ke 75% format WebP
        .toFile(uploadPath);

    imageUrl = fileName;
}

    // 2. Simpan ke Database
    // Pastikan model Message.create kamu sudah mendukung field message_type dan image_url
    const messageId = await Message.create({
      conversationId,
      senderId,
      content: content || null, // Bisa null kalau hanya kirim gambar
      messageType: messageType,
      imageUrl: imageUrl
    });

    // 3. Return data lengkap untuk Socket.io
    return {
      messageId,
      conversationId: parseInt(conversationId),
      senderId,
      receiverId,
      senderName: req.user.username,
      content: content || '',
      messageType, 
      imageUrl, // Nama file untuk diolah di frontend
      timestamp: new Date()
    };

  } catch (error) {
    console.error("sendMessage error:", error);
    throw error;
  }
}


static async getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.userId;

    if (!conversationId || isNaN(conversationId)) {
      return res.status(400).json({ error: 'ID percakapan tidak valid' });
    }

    const conversation = await Conversation.getById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation tidak ditemukan' });
    }

    const otherUserId = conversation.user_one === currentUserId
        ? conversation.user_two
        : conversation.user_one;

    const lawanChat = await User.getById(otherUserId);
    const rawMessages = await Message.findByConversation(conversationId);

    // MAPPING DATA KE FRONTEND
    const messages = rawMessages.map(msg => ({
      messageId: msg.message_id,
      content: msg.content,
      messageType: msg.message_type, // TAMBAHKAN INI
      imageUrl: msg.image_url,       // TAMBAHKAN INI
      timestamp: msg.timestamp,
      sender: {
        id: msg.user_id,
        username: msg.username
      }
    }));

    res.json({
      messages,
      lawanChat
    });

  } catch (error) {
    console.error('Gagal mengambil pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
}
static async hapusPesan(req) {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      throw new Error("Pesan tidak ditemukan");
    }
    console.log("MESSAGE FULL:", message);
console.log("SENDER_ID:", message?.sender_id);
console.log("CONVERSATION_ID:", message?.conversation_id);
    await Message.hapusPesan(messageId);

   const [rows] = await db.query(
  `SELECT user_one, user_two 
   FROM conversations 
   WHERE conversation_id = ?`,
  [message.conversation_id]
);

    const convo = rows[0];

    if (!convo) {
      throw new Error("Conversation tidak ditemukan");
    }

    const receiverId =
  convo.user_one == message.sender_id
    ? convo.user_two
    : convo.user_one;
    return {
      messageId,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      receiverId
    };

  } catch (error) {
    console.error('Gagal menghapus pesan:', error);
    throw error;
  }
}

static async editPesan(req,res){
  try{
    const { messageId } = req.params;
    const oldContent = await Message.editPesan(messageId);
    
    res.json(oldContent)
  }
  catch(error){
    console.error('Gagal mengedit pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengedit pesan' });
  }
}

static async updatePesan(req){
  try{

    const { messageId } = req.params;
    const { content } = req.body;

    // 🔥 ambil dulu data pesan
    const message = await Message.findById(messageId);

    if (!message) {
      throw new Error("Pesan tidak ditemukan");
    }

    await Message.updatePesan(messageId, content);

    const [rows] = await db.query(
  `SELECT user_one, user_two 
   FROM conversations 
   WHERE conversation_id = ?`,
  [message.conversation_id]
);

const convo = rows[0];

const senderId = Number(message.sender_id);
const userOne = Number(convo.user_one);
const userTwo = Number(convo.user_two);

const receiverId =
  userOne === senderId ? userTwo : userOne;

    return {
      messageId,
      senderId,
      receiverId,
      conversationId: message.conversation_id,
      content
    };

  }
  catch(error){
    console.error('Gagal mengupdate pesan:', error);
    throw error;
  }
}
static async hapusSemuaPesan(req,res){
  try{
    const { conversationId } = req.params;
    await Message.hapusSemuaPesan(conversationId);
    res.status(200).json({ message: 'Semua pesan berhasil dihapus' });
  } catch (error) {
    console.error('Gagal menghapus pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat menghapus pesan' });
  }
}

}

module.exports = ChatController;
