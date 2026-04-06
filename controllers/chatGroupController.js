const db = require('../db')

const messageGrup = require('../models/messageGrup')


class chatGroup{
    // controllers/groupController.js
        static async createGroup(req, res) {
    try {
        const { name } = req.body;
        const creatorId = req.user.userId;

        const [group] = await db.query(
            `INSERT INTO groups (name, created_by) VALUES (?, ?)`,
            [name, creatorId]
        );
    
        // ✅ Tambahkan status: 'success'
        res.status(201).json({ 
            status: 'success',
            message: 'Grup berhasil dibuat',
            groupId: group.insertId 
        });
    } catch (error) {
        // ✅ Tangani error
        console.error(error);
        res.status(500).json({ 
            status: 'error',
            message: 'Gagal membuat grup' 
        });
    }
}
static async allGrup(req, res){
    try {
        const [rows] = await db.query(
            `SELECT 
            g.group_id,
            g.name AS group_name,
            g.created_by,
            g.created_at,
            gm.content AS last_message,
            gm.sent_at AS last_message_time,
            u.username AS sender_username
            FROM groups g
            LEFT JOIN (
            SELECT gm1.*
            FROM group_messages gm1
            JOIN (
                SELECT group_id, MAX(sent_at) AS last_time
                FROM group_messages
                GROUP BY group_id
        ) gm2 ON gm1.group_id = gm2.group_id AND gm1.sent_at = gm2.last_time
        ) gm ON g.group_id = gm.group_id
        LEFT JOIN users u ON gm.sender_id = u.user_id
        ORDER BY 
        IF(gm.sent_at IS NULL, 1, 0),
        gm.sent_at DESC;
        `
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'error',
            message: 'Gagal mengambil daftar grup'
        });
    }
}
static async findBygroupId(req,res){
    try{
        const groupId = req.params.groupId;
        const rows = await messageGrup.findByGroupId(groupId)
        const messages = rows.map(msg => ({
      messageId: msg.message_id,
      content: msg.content,
      timestamp: msg.timestamp,
      sender: {
        id: msg.user_id,
        username: msg.username,
        stat:msg.status.length
      }
    }));
        res.status(200).json(messages);
    }catch(error){
        res.status(500).json({
            status: 'error',
            message: 'Gagal mengambil daftar grup'
        });
    }
}
static async sendMessage(req, res) {
  try {
    const { content } = req.body;
    const { groupId } = req.params;
    const senderId = req.user?.userId;

    console.log({ content, groupId, senderId }); // Tambahkan ini
    let finalcontent = content || ''
    if(req.file){
        const imageUrl = `http://localhost:3000/uploads/${req.file.filename}`;
        finalcontent += imageUrl
    }
    const messageId = await messageGrup.sendMessage({
      groupId,
      senderId,
      content : finalcontent
    });

    res.status(201).json({ messageId });
  } catch (error) {
    console.error('SERVER ERROR:', error); // Log error ke console
    res.status(500).json({ error: error.message });
  }
}

static async deleteGrupMessage(req,res){
 try{
    const id =req.params.messageId
 const deleteGrup = await messageGrup.deleteMessage(id)
 if(deleteGrup){
    res.status(200).json({
        status:'success',
        message:'pesan berhasil di hapus'
    })
 }
 }catch(error){
    res.status(500).json({
        status:'error',
        message:'pesan gagal di hapus'
    })
 }
}
static async editPesanGrup(req,res){
  try{
    const { messageId } = req.params;
    const oldContent = await messageGrup.editmessage(messageId);
    
    res.json(oldContent)
  }
  catch(error){
    console.error('Gagal mengedit pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengedit pesan' });
  }
}

static async updatePesanGrup(req,res){
  try{
    const { messageId } = req.params;
    const { content } = req.body;
    await messageGrup.updatemessagegrup(messageId,content);
    res.status(200).json({ message: 'Pesan berhasil diupdate' });
  }
  catch(error){
    console.error('Gagal mengupdate pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate pesan' });
  }

}

}
module.exports = chatGroup