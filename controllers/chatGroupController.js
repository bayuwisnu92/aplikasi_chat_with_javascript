const db = require('../db')

const messageGrup = require('../models/messageGrup')

const { getIO } = require('../socket'); // INI SERING LUPA DI-IMPORT
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');


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
            `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'admin', NOW())`,
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
        const userId = req.user?.userId; 

        const [rows] = await db.query(
    `SELECT 
        g.group_id,
        g.name AS group_name,
        g.profile_picture,    -- TAMBAHKAN INI
        g.created_by,
        g.created_at,
        gm_msg.content AS last_message,
        gm_msg.message_type,
        gm_msg.image_url,
        gm_msg.sent_at AS last_message_time,
        u.username AS sender_username
    FROM groups g
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
static async findBygroupId(req, res) {
    try {
        const groupId = req.params.groupId;
        const userId = req.user.userId; // AMBIL DARI TOKEN (WAJIB)

        // 1. Ambil pesan grup
        const rows = await messageGrup.findByGroupId(groupId);
        
        const messages = rows.map(msg => ({
    messageId: msg.message_id,
    content: msg.content,
    messageType: msg.message_type,
    imageUrl: msg.image_url,
    timestamp: msg.timestamp,
    sender: {
        id: msg.user_id,
        username: msg.username,
        stat: msg.status
    }
}));

        // 2. Ambil role user di grup tersebut
        const [memberInfo] = await db.query(
            "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
            [groupId, userId]
        );

        // Jika user ID 4 admin tapi tidak ditemukan di sini, berarti belum terdaftar di group_members
        if (memberInfo.length === 0) {
            return res.status(403).json({
                status: 'error',
                message: 'Anda bukan anggota grup ini'
            });
        }

        const userRole = memberInfo[0].role; // DEFINISIKAN VARIABLE INI

        // 3. Kirim respon
        res.status(200).json({
            role: userRole, // Sekarang userRole sudah ada isinya
            messages: messages
        });

    } catch (error) {
        console.error("Error findBygroupId:", error); // Muncul di terminal VS Code
        res.status(500).json({
            status: 'error',
            message: 'Gagal mengambil isi chat grup'
        });
    }
}
static async sendMessage(req) {
  try {
    const { content } = req.body;
    const { groupId } = req.params;
    const senderId = req.user?.userId;

    let messageType = 'text';
    let imageUrl = null;

    // JIKA ADA FILE GAMBAR
    if (req.file) {
      messageType = 'image';
      // Kita pakai format .webp agar size gambar kaos distro-mu jadi super kecil (KB bukan MB)
      const fileName = `group-${Date.now()}.webp`;
      const uploadPath = path.join(__dirname, '../public/uploads', fileName);

      // PROSES KOMPRESI DENGAN SHARP
      await sharp(req.file.buffer)
        .resize({ width: 800, withoutEnlargement: true }) // Lebar maks 800px
        .webp({ quality: 75 }) // Kualitas 75% sudah sangat jernih di HP
        .toFile(uploadPath);

      imageUrl = fileName;
    }

    // SIMPAN KE DATABASE (Pastikan model messageGrup sudah mendukung messageType & imageUrl)
    const messageId = await messageGrup.sendMessage({
      groupId,
      senderId,
      content: content || null, // Sekarang content murni teks/caption saja
      messageType: messageType,
      imageUrl: imageUrl
    });

    // RETURN DATA UNTUK SOCKET.IO
    return { 
      messageId, 
      groupId,
      senderId,
      senderName: req.user?.username,
      content: content || '',
      messageType: messageType,
      imageUrl: imageUrl, // Kirim nama filenya saja
      created_at: new Date() 
    };
  } catch (error) {
    console.error('SERVER ERROR:', error);
    throw error;
  }
}

static async deleteGrupMessage(req) {
  const messageId = req.params.messageId;

  // 🔥 ambil groupId + senderId
  const [rows] = await db.execute(
    'SELECT group_id, sender_id FROM group_messages WHERE message_id = ?',
    [messageId]
  );

  if (!rows.length) {
    throw new Error("Pesan tidak ditemukan");
  }

  const { group_id: groupId, sender_id: senderId } = rows[0];

  const deleted = await messageGrup.deleteMessage(messageId);

  if (!deleted) {
    throw new Error("Gagal menghapus pesan");
  }

  console.log("GROUP ID:", groupId);
  console.log("SENDER ID:", senderId);

  return {
    messageId,
    groupId,
    senderId
  };
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
static async addMember(req, res) {
    try {
        const { groupId } = req.params;
        const { targetUserId } = req.body;
        const requesterId = req.user.userId; // ID orang yang klik tombol "Add"

        // 1. CEK OTORITAS: Apakah requesterId adalah ADMIN di grup ini?
        const [checkAdmin] = await db.query(
            "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
            [groupId, requesterId]
        );

        if (!checkAdmin.length || checkAdmin[0].role !== 'admin') {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Hanya Admin yang bisa menambahkan anggota, lur!' 
            });
        }

        // 2. Jika dia Admin, lanjut cek apakah target sudah jadi member
        const [existing] = await db.query(
            "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
            [groupId, targetUserId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'User sudah ada di grup.' });
        }

        // 3. Eksekusi Insert sebagai member biasa
        await db.query(
            "INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', NOW())",
            [groupId, targetUserId]
        );

        // ... kirim socket newGroupAssigned seperti sebelumnya ...
        res.status(200).json({ status: 'success', message: 'Anggota berhasil ditambahkan oleh Admin' });

    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal' });
    }
}

static async updatePesanGrup(req, res) {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    // 🔥 ambil data message dulu
    const [rows] = await db.query(
      `SELECT group_id, sender_id 
       FROM group_messages 
       WHERE message_id = ?`,
      [messageId]
    );

    if (!rows.length) {
      throw new Error("Pesan tidak ditemukan");
    }

    const { group_id: groupId, sender_id: senderId } = rows[0];

    await messageGrup.updatemessagegrup(messageId, content);

    const io = getIO();

    // 🔥 emit ke semua member grup
    io.to("group_" + groupId).emit("groupMessageEdited", {
      messageId,
      groupId,
      senderId,
      content
    });
            io.emit("updateGroupContactList", {
        groupId,
        lastMessage: content,
        timestamp: new Date()
        });

    res.status(200).json({ message: 'Pesan berhasil diupdate' });

  } catch (error) {
    console.error('Gagal mengupdate pesan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate pesan' });
  }
}

static async searchUser(req, res) {
    try {
        const { username } = req.query;
        console.log("Mencari username:", username); // Ini harus muncul di terminal hitam

        const [users] = await db.query(
            "SELECT user_id, username FROM users WHERE username LIKE ?",
            [`%${username}%`] // Hapus sementara filter 'AND user_id != ?'
        );

        console.log("Hasil dari DB:", users);
        res.json(users);
    } catch (error) {
        console.error("Error SQL:", error);
        res.status(500).json({ message: "Gagal" });
    }
}

static async updateGroupProfile(req, res) {
    const { groupId } = req.params; 
    const userId = req.user.userId;

    // 1. CEK FILE (Gunakan buffer karena pakai memoryStorage)
    if (!req.file) {
        return res.status(400).json({ message: 'Gambar wajib dipilih, lur!' });
    }

    const connection = await db.getConnection();
    try {
        // 2. CEK ADMIN
        const [member] = await connection.query(
            `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
            [groupId, userId]
        );

        if (member.length === 0 || member[0].role !== 'admin') {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Hanya admin grup yang bisa ganti foto!' 
            });
        }

        // 3. PROSES GAMBAR DENGAN SHARP (Sama seperti sendMessage)
        const fileName = `group-profile-${Date.now()}.webp`;
        // Pastikan path folder ini benar sesuai struktur sservermu
        const uploadPath = path.join(__dirname, '../public/uploads/profile', fileName);

        // Pastikan folder 'profile' ada, jika tidak, buat otomatis
        if (!fs.existsSync(path.dirname(uploadPath))) {
            fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
        }

        await sharp(req.file.buffer)
            .resize({ width: 400, height: 400, fit: 'cover' }) // Ukuran kotak rapi untuk profil
            .webp({ quality: 80 })
            .toFile(uploadPath);

        // 4. UPDATE DATABASE
        await connection.query(
            `UPDATE groups SET profile_picture = ? WHERE group_id = ?`,
            [fileName, groupId]
        );

        res.status(200).json({
            status: 'success',
            message: 'Foto profil grup berhasil diperbarui',
            profile_picture: fileName
        });

    } catch (error) {
        console.error("Error saat updateGroupProfile:", error);
        res.status(500).json({ status: 'error', message: 'Gagal update foto grup' });
    } finally {
        connection.release();
    }
}
static async getMemberGrup(req, res) {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    if (!groupId) {
      return res.status(400).json({ message: 'groupId wajib diisi' });
    }

    const [members] = await db.query(
      `SELECT 
         u.user_id,
         u.username,
         u.last_online,
         gm.role,
         u.profile_picture
       FROM group_members gm
       JOIN users u ON gm.user_id = u.user_id
       WHERE gm.group_id = ?`,
      [groupId]
    );
    const dataWithStatus = members.map(member => ({
      user_id : member.user_id,
      username : userId === member.user_id ? `${member.username} (Anda)` : member.username,
      last_online : member.last_online,
      role : member.role,
      profile_picture : member.profile_picture,
    }));
    return res.status(200).json({
      success: true,
      total: members.length,
      data: dataWithStatus
    });

  } catch (error) {
    console.error('Error getMemberGrup:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
}
module.exports = chatGroup