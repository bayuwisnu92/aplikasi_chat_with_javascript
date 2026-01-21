const db = require('../db')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 


class Message {
  static async create({ conversationId, senderId, content }) {
    const [result] = await db.execute(
      'INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)',
      [conversationId, senderId, content]
    );
    return result.insertId;
  }

  static async findByConversation(conversationId) {
  const [rows] = await db.execute(`
  SELECT 
    m.message_id,
    m.content,
    m.sent_at AS timestamp,
    u.user_id,
    u.last_online,
    u.status,
    u.username
  FROM messages m
  JOIN users u ON m.sender_id = u.user_id
  WHERE m.conversation_id = ?
  ORDER BY m.sent_at ASC
`, [conversationId]);
;

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
}

module.exports = Message;