const db = require('../db');


class MessageGroup {
    static async findByGroupId(groupId) {
        const [rows] = await db.execute(
          `SELECT 
            m.message_id,
            m.content,
            m.sent_at AS timestamp,
            u.user_id,
            u.username,
            u.status
          FROM group_messages m
          JOIN users u ON m.sender_id = u.user_id
          WHERE m.group_id = ?
          ORDER BY m.sent_at ASC`,
          [groupId]
        );
        return rows;
      }
      static async sendMessage({groupId, senderId, content}){
        if (!groupId || !senderId || !content) {
        throw new Error('Data tidak lengkap untuk menyimpan pesan');
  }
        const [result] = await db.execute(
          'INSERT INTO group_messages (group_id, sender_id, content) VALUES (?, ?, ?)',
          [groupId, senderId, content]
        );
        return result.insertId;
      }
      static async deleteMessage(messageId){
        const [result] = await db.execute(
          'DELETE FROM group_messages WHERE message_id = ?',
          [messageId]
        );
        return result.affectedRows > 0;
      }
      static async editmessage(messageId){
        const [result] = await db.execute(
          `SELECT content FROM group_messages WHERE message_id = ?`,
          [messageId]
        )
        return result[0].content
      }

      static async updatemessagegrup(messageId,newContent){
        await db.execute(`
        UPDATE group_messages
        SET content = ?
        WHERE message_id = ?
        `,[newContent,messageId])
        
      }
}
module.exports=MessageGroup