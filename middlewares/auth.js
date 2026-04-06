const jwt = require('jsonwebtoken');
const db = require('../db'); // ⬅️ TAMBAHKAN INI

exports.authenticate = async (req, res, next) => {

  const token = req.header('Authorization')?.replace('Bearer ', '') || 
                (req.cookies ? req.cookies.token : null);

  if (!token) {
    return res.status(401).json({ 
      error: 'Akses ditolak. Token tidak ditemukan.' 
    });
  }

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 AMBIL USER DARI DATABASE
    const [rows] = await db.query(
      'SELECT user_id, username, email FROM users WHERE user_id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User tidak ditemukan' });
    }

    const user = rows[0];

    // ✅ SEKARANG LENGKAP
    req.user = {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      role: decoded.role
    };

    next();

  } catch (error) {

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Token tidak valid' });
    }

    console.error('Auth error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};