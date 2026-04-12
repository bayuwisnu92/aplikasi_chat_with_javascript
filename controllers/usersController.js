const User = require('../models/users');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const db = require('../db');

class UsersController {
    static async getAllUsers(req, res) {
  try {
    const currentUserId = req.user.userId; // dari token login
    const users = await User.getAllUsers(currentUserId); // ini sudah exclude diri sendiri dari SQL

    res.json(users);
  } catch (error) {
    console.error('Error saat mengambil data user:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

static async updateProfile(req,res){
    try {
            if (!req.file) {
                return res.status(400).json({ message: 'Mana fotonya, lur? Belum dipilih nih.' });
            }

            const userId = req.user.userId;
            // Nama file unik pakai ID user dan timestamp
            const fileName = `pp-${userId}-${Date.now()}.webp`;
            const uploadPath = path.join(__dirname, '../public/uploads/profile', fileName);

            // Pastikan folder 'profile' sudah ada, kalau belum kita buat
            const dir = path.join(__dirname, '../public/uploads/profile');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // PROSES SHARP: Resize jadi 300x300 (biar pas di lingkaran)
            await sharp(req.file.buffer)
                .resize(300, 300, {
                    fit: 'cover',
                    position: 'center'
                })
                .webp({ quality: 80 })
                .toFile(uploadPath);

            // UPDATE KE DATABASE
            // Kolom profile_picture sesuai di screenshot tabel users kamu
            await db.query(
                'UPDATE users SET profile_picture = ? WHERE user_id = ?',
                [fileName, userId]
            );

            res.status(200).json({
                message: 'Mantap! Foto profil berhasil diupdate.',
                imageUrl: fileName
            });

        } catch (error) {
            console.error('Error Update PP:', error);
            res.status(500).json({ message: 'Waduh, gagal update foto profil nih.' });
        }
}


    static async getUserById(req, res) {
    try {
        const userId = req.params.id; 
        const user = await User.getUserById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }
        
        res.json(user); // Kirim data user jika sukses
    } catch (error) {
        console.error('Error saat mengambil data user:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
}
static async createUser(req, res) {
    try {
        const userData = req.body;
        const userId = await User.createUser(userData);
        res.status(201).json({ 
            message: 'User berhasil ditambahkan.', 
            userId 
        });  
    } catch (error) {
        console.error('Error saat menambahkan user:', error);
        res.status(500).json({ 
            message: 'Gagal menambahkan user.', 
            error: error.message 
        });
    }
}

static async getContacts(req, res) {
  try {
    const currentUserId = req.user.userId;

    const contacts = await User.getContacts(currentUserId);

    res.json(contacts);
  } catch (error) {
    console.error('Error getContacts:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil kontak'
    });
  }
};

static async searchUsers(req, res) {

  try {

    const keyword = req.query.q;
    const currentUserId = req.user.userId;

    const users = await User.searchUsers(keyword, currentUserId);

    res.json(users);

  } catch (error) {

    console.error("Search user error:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mencari user"
    });

  }

}

}

module.exports = UsersController;
