const Message = require('../models/message');
const db = require('../db');
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
  static async sendMessage(req, res) {
  try {
    const { content } = req.body;
    const { conversationId } = req.params;
    const senderId = req.user.userId;

    let finalContent = content || '';
    if(req.file){
      const imageUrl = `http://localhost:3000/uploads/${req.file.filename}`;
      finalContent += imageUrl;
    }
    
    const messageId = await Message.create({
      conversationId,
      senderId,
      content : finalContent
    });

    res.status(201).json({ messageId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
  


static async getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.userId;

    // Validasi ID percakapan
    if (!conversationId || isNaN(conversationId)) {
      return res.status(400).json({ error: 'ID percakapan tidak valid' });
    }

    // Ambil pesan + data pengirim dari model
    const rawMessages = await Message.findByConversation(conversationId);

    if (!rawMessages || rawMessages.length === 0) {
      return res.json({ messages: [], lawanChat: null });
    }

    // Ambil data lawan chat (selain user yang login)
    const lawanChatMsg = rawMessages.find(msg => msg.user_id !== currentUserId);
    const lawanChat = lawanChatMsg ? {
      id: lawanChatMsg.user_id,
      username: lawanChatMsg.username,
      status: lawanChatMsg.status, // status 'online' atau 'offline'
      lastOnline: lawanChatMsg.last_online
    } : null;

    // Format semua pesan
    const messages = rawMessages.map(msg => ({
      messageId: msg.message_id,
      content: msg.content,
      timestamp: msg.timestamp,
      sender: {
        id: msg.user_id,
        username: msg.username
      }
    }));

    // Kirim response lengkap
    res.json({
      messages,
      lawanChat
    });

  } catch (error) {
    console.error('Gagal mengambil pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
}
static async hapusPesan(req,res) {
  try{
    const { messageId } = req.params;
    await Message.hapusPesan(messageId);
    res.status(200).json({ message: 'Pesan berhasil dihapus' });
  } catch (error) {
    console.error('Gagal menghapus pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat menghapus pesan' });
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

static async updatePesan(req,res){
  try{
    const { messageId } = req.params;
    const { content } = req.body;
    await Message.updatePesan(messageId,content);
    res.status(200).json({ message: 'Pesan berhasil diupdate' });
  }
  catch(error){
    console.error('Gagal mengupdate pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate pesan' });
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
