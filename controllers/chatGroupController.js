const db = require('../db')

const messageGrup = require('../models/messageGrup')


class chatGroup{
    // controllers/groupController.js
 static async createGroup(req, res) {
    const connection = await db.getConnection(); // Ambil koneksi untuk transaction
    try {
        await connection.beginTransaction(); // Mulai transaksi

        const { name } = req.body;
        const creatorId = req.user.userId;

        // 1. Insert ke tabel groups
        const [groupResult] = await connection.query(
            `INSERT INTO groups (name, created_by) VALUES (?, ?)`,
            [name, creatorId]
        );
        
        const newGroupId = groupResult.insertId;

        // 2. OTOMATIS Insert si pembuat ke tabel group_members
        // Kita gunakan NOW() agar joined_at terisi waktu saat ini
        await connection.query(
            `INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, NOW())`,
            [newGroupId, creatorId]
        );

        // Jika semua oke, simpan perubahan secara permanen
        await connection.commit();

        res.status(201).json({ 
            status: 'success',
            message: 'Grup berhasil dibuat dan Anda telah bergabung',
            groupId: newGroupId 
        });

    } catch (error) {
        // Jika ada yang error di tengah jalan, batalkan semua perubahan
        await connection.rollback();
        console.error("Error saat createGroup:", error);
        res.status(500).json({ 
            status: 'error',
            message: 'Gagal membuat grup' 
        });
    } finally {
        // Kembalikan koneksi ke pool
        connection.release();
    }
}
static async allGrup(req, res) {
    try {
        const userId = req.user?.userId; // Pastikan middleware authenticate sudah jalan

        const [rows] = await db.query(
            `SELECT 
                g.group_id,
                g.name AS group_name,
                g.created_by,
                g.created_at,
                gm_msg.content AS last_message,
                gm_msg.sent_at AS last_message_time,
                u.username AS sender_username
            FROM groups g
            -- Mengunci daftar grup hanya untuk member yang terdaftar
            INNER JOIN group_members g_mem ON g.group_id = g_mem.group_id
            LEFT JOIN (
                SELECT gm1.*
                FROM group_messages gm1
                JOIN (
                    SELECT group_id, MAX(sent_at) AS last_time
                    FROM group_messages
                    GROUP BY group_id
                ) gm2 ON gm1.group_id = gm2.group_id AND gm1.sent_at = gm2.last_time
            ) gm_msg ON g.group_id = gm_msg.group_id
            LEFT JOIN users u ON gm_msg.sender_id = u.user_id
            WHERE g_mem.user_id = ?
            ORDER BY 
                IF(gm_msg.sent_at IS NULL, 1, 0),
                gm_msg.sent_at DESC;`,
            [userId]
        );

        res.status(200).json(rows);
    } catch (error) {
        console.error("Error allGrup:", error);
        res.status(500).json({ message: 'Gagal mengambil daftar grup' });
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
static async sendMessage(req) { // Hapus parameter res jika tidak dipakai kirim respon di sini
  try {
    const { content } = req.body;
    const { groupId } = req.params; // Sesuai route: :groupId
    const senderId = req.user?.userId;

    let finalcontent = content || '';
    if (req.file) {
      const imageUrl = `http://localhost:3000/uploads/${req.file.filename}`;
      finalcontent += imageUrl;
    }

    const messageId = await messageGrup.sendMessage({
      groupId,
      senderId,
      content: finalcontent
    });

    // CUKUP RETURN DATA SAJA
    return { 
      messageId, 
      senderName: req.user?.username, // Pastikan ini ada untuk socket
      message_text: content,
      created_at: new Date() 
    };
  } catch (error) {
    console.error('SERVER ERROR:', error);
    throw error; // Lempar error agar ditangkap catch di route
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