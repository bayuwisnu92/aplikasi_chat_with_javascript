const Message = require('../models/message');
const User = require('../models/users');
const db = require('../db');
const Conversation = require('../models/conversationModel');

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

    // 1. Ambil data conversation untuk mencari receiverId
    const conversation = await Conversation.getById(conversationId);
    if (!conversation) throw new Error("Conversation tidak ditemukan");

    // Tentukan siapa penerimanya
    const receiverId = conversation.user_one === senderId 
      ? conversation.user_two 
      : conversation.user_one;

    let finalContent = content || '';
    let imageUrl = null;

    if (req.file) {
      imageUrl = `http://localhost:3000/uploads/${req.file.filename}`;
      // Jika ada teks + gambar, gabungkan. Jika hanya gambar, isi dengan URL.
      finalContent = content ? `${content} ${imageUrl}` : imageUrl;
    }

    const messageId = await Message.create({
      conversationId,
      senderId,
      content: finalContent
    });

    // 2. Return data lengkap ke route (termasuk receiverId)
    return {
      messageId,
      conversationId,
      senderId,
      receiverId, // <--- Sangat penting untuk update kontak realtime
      senderName: req.user.username,
      content: finalContent,
      image: imageUrl,
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

    // Ambil data conversation
    const conversation = await Conversation.getById(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation tidak ditemukan' });
    }

    // Tentukan lawan chat
    const otherUserId =
      conversation.user_one === currentUserId
        ? conversation.user_two
        : conversation.user_one;

    // Ambil data user
    const lawanChat = await User.getById(otherUserId);

    // Ambil pesan
    const rawMessages = await Message.findByConversation(conversationId);

    const messages = rawMessages.map(msg => ({
      messageId: msg.message_id,
      content: msg.content,
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

    // 🔥 ambil conversationId dulu
    const message = await Message.findById(messageId);

    if (!message) {
      throw new Error("Pesan tidak ditemukan");
    }

    await Message.hapusPesan(messageId);

    return {
      messageId,
      conversationId: message.conversation_id
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

    return {
      messageId,
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
