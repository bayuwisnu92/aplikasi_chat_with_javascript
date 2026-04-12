const jwt = require('jsonwebtoken');
const db = require('../db');

class verify {
    static async verifyToken(req, res) {
        // Ambil token dari header
        const authHeader = req.header('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: "Token tidak ditemukan" });
        }

        try {
            // Verifikasi token secara sinkron
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log("🔑 Decoded Token Payload:", decoded);

            // Gunakan userId atau id (sesuaikan dengan isi payload saat login)
            const userId = decoded.userId || decoded.id; 

            if (!userId) {
                throw new Error("Payload token tidak memiliki User ID");
            }

            // Query database
            const [rows] = await db.query(
                `SELECT 
                    user_id as id, 
                    COALESCE(username, email) as username,
                    email,
                    profile_picture
                 FROM users 
                 WHERE user_id = ?`,
                [userId]
            );

            const user = rows[0];
            console.log("📦 Hasil Query DB:", user);

            if (!user) {
                return res.status(404).json({ error: `User dengan ID ${userId} tidak ditemukan` });
            }

            // Kirim respon sukses
            return res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    profil: user.profile_picture
                }
            });

        } catch (error) {
            console.error("❌ Error di verifyToken:", error.message);

            // Melakukan decode manual (tanpa verifikasi signature) untuk keperluan debugging di log
            const manualDecode = jwt.decode(token);

            // Kirim respon error tanpa menyebabkan ReferenceError pada 'decoded'
            return res.status(401).json({ 
                error: error.message, // Akan muncul "jwt expired" atau pesan lainnya
                status: "UNAUTHORIZED",
                debug: {
                    message: "Token tidak valid atau sudah kadaluwarsa",
                    userIdAttempted: manualDecode ? (manualDecode.userId || manualDecode.id) : null
                }
            });
        }
    }
}

module.exports = verify;