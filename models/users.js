const db = require('../db')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // <-- Ini yang sering terlupakan
class User {
    static async  getAllUsers(currentUserId) {
  const query = `
    SELECT 
      u.user_id AS user_id,
      u.username,
      u.status,
      m.content AS last_message,
      m.sent_at AS last_message_time
    FROM users u
    LEFT JOIN conversations c 
      ON (
        (c.user_one = ? AND c.user_two = u.user_id)
        OR (c.user_two = ? AND c.user_one = u.user_id)
      )
      AND c.conversation_type = 'private'
    LEFT JOIN (
      SELECT m1.*
      FROM messages m1
      JOIN (
        SELECT conversation_id, MAX(sent_at) AS last_time
        FROM messages
        GROUP BY conversation_id
      ) m2 ON m1.conversation_id = m2.conversation_id AND m1.sent_at = m2.last_time
    ) m ON m.conversation_id = c.conversation_id
    WHERE u.user_id != ?
    ORDER BY 
      IF(m.sent_at IS NULL, 1, 0),
      m.sent_at DESC
  `;
  
  const [rows] = await db.query(query, [currentUserId, currentUserId, currentUserId]);
  return rows;
}


    static async getUserById(id) {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        return rows[0]; 
    }
     static async createUser(username, email, password) {  // Parameter harus 'password', bukan 'password_hash'
      try {
        // 1. Validasi input
        if (!username || !email || !password) {
          throw new Error('username, email, dan password harus diisi');
        }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10); // Gunakan variabel 'password' yang diterima
    // 3. Cek apakah email sudah terdaftar
    const [existingUser] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      throw new Error('Email sudah terdaftar');
    }
    // 3. Simpan ke database
    const [result] = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword] // Field database: password_hash
    );

    return { id: result.insertId, email };
  } catch (error) {
    console.error('Error in createUser:', error);
    throw error; // Lempar error ke controller
  }
}
  static async login(email, password) {
  try {
    // 1. Cari user di database
    const [users] = await db.query(
      'SELECT user_id, email, password_hash FROM users WHERE email = ?', 
      [email]
    );

    if (users.length === 0) {
      throw new Error('User tidak ditemukan');
    }

    const user = users[0];

    // 2. Pastikan password dan hash ada
    if (!password || !user.password_hash) {
      throw new Error('Password atau hash tidak valid');
    }

    // 3. Bandingkan password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      throw new Error('Password salah');
    }
    await db.query(
      `UPDATE users SET status = 'online' WHERE user_id = ?`,
      [user.user_id]
    );
    // 4. Generate token
    const token = jwt.sign(
  { userId: user.user_id, email: user.email },  // Perhatikan user.user_id
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

    return token;
  } catch (error) {
    console.error('Error in login:', error);
    throw error;
  }
}
    static async updateUser(id, userData) {
        await db.query('UPDATE users SET? WHERE id =?', [userData, id]); 
    }


    static async updateProfile(id, imageProfile) {
      await db.query('UPDATE users SET profile_picture=? WHERE id =?', [imageProfile, id]); 
    }
}



module.exports = User;