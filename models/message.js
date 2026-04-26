const db = require('../db')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 


class Message {
 static async create({ conversationId, senderId, content, messageType, imageUrl, status }) {
    const [result] = await db.execute(
        `INSERT INTO messages 
         (conversation_id, sender_id, content, message_type, image_url, status, sent_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`, // Ganti created_at jadi sent_at
        [
            conversationId, 
            senderId, 
            content || null, 
            messageType || 'text', 
            imageUrl || null,
            status
        ]
    );
    return result.insertId;
}

  static async findByConversation(conversationId) {
  const [rows] = await db.execute(`
    SELECT 
    m.message_id,
    m.content,
    m.message_type,
    m.image_url,
    m.sent_at AS timestamp,
    m.status AS message_status,  -- Beri alias unik di sini
    u.user_id,
    u.last_online,
    u.status AS user_status,      -- Beri alias unik di sini
    u.username
FROM messages m
JOIN users u ON m.sender_id = u.user_id
WHERE m.conversation_id = ?
ORDER BY m.sent_at ASC
  `, [conversationId]);

  return rows;
}

static async hapusPesan(messageId){
  await db.execute(`
  DELETE FROM messages
  WHERE message_id = ?
  `,[messageId])
}
static async hapusSemuaPesan(conversationId){
  await db.execute(`
  DELETE FROM messages
  WHERE conversation_id = ?
  `,[conversationId])
  await db.execute(`
  DELETE FROM conversations
  WHERE conversation_id = ?
  `,[conversationId])
}

static async editPesan(messageId){
  const [result] = await db.execute(`
  SELECT content FROM messages WHERE message_id=?
  `,[messageId])
  return result[0].content
}

static async updatePesan(messageId,newContent){
  await db.execute(`
  UPDATE messages
  SET content = ?
  WHERE message_id = ?
  `,[newContent,messageId])
}

static async findById(messageId) {
  const [rows] = await db.query(
    `SELECT message_id, conversation_id, sender_id, content 
     FROM messages 
     WHERE message_id = ?`,
    [messageId]
  );

  return rows[0];
}
}



module.exports = Message;