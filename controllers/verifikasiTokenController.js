const jwt = require('jsonwebtoken');
const db = require('../db')



class verify{
    static async verifyToken(req, res){
  const token = req.header('Authorization')?.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔑 Decoded Token Payload:", decoded);

    const userId = decoded.userId; // ✅ FIXED


    const [rows] = await db.query(
      `SELECT 
        user_id as id, 
        COALESCE(username, email) as username,
        email
       FROM users 
       WHERE user_id = ?`,
      [userId]
    );

    const user = rows[0];
    console.log("📦 Hasil Query DB:", user);

    if (!user) {
      throw new Error(`User dengan ID ${userId} tidak ditemukan`);
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(401).json({ 
      error: error.message,
      debug: {
        tokenPayload: token ? jwt.decode(token) : null,
        dbQuery: {
          sql: 'SELECT user_id as id, username, email FROM users WHERE user_id = ?',
          params: [decoded?.id]
        }
      }
    });
  }
};
}

module.exports = verify;