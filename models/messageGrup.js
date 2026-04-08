const db = require('../db');


class MessageGroup {
    static async findByGroupId(groupId) {
  const [rows] = await db.execute(
    `SELECT 
      m.message_id,
      m.content,
      m.message_type,
      m.image_url,
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
      static async sendMessage({ groupId, senderId, content, messageType, imageUrl }) {
  // Validasi: Sekarang content boleh kosong (jika kirim gambar saja), 
  // tapi groupId dan senderId tetap wajib ada.
  if (!groupId || !senderId) {
    throw new Error('Data tidak lengkap untuk menyimpan pesan');
  }

  // Gunakan query yang menyertakan message_type dan image_url
  const [result] = await db.execute(
    `INSERT INTO group_messages 
    (group_id, sender_id, content, message_type, image_url, sent_at) 
    VALUES (?, ?, ?, ?, ?, NOW())`,
    [
      groupId, 
      senderId, 
      content || null,         // Jika cuma kirim gambar, teksnya jadi NULL
      messageType || 'text',   // Default-nya 'text'
      imageUrl || null         // Isi nama file .webp tadi
    ]
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