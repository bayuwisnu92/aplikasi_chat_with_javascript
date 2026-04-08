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


 static async getContacts(currentUserId) {
  const query = `
    SELECT 
      c.conversation_id,

      CASE
        WHEN c.user_one = ? THEN u2.user_id
        ELSE u1.user_id
      END AS user_id,

      CASE
        WHEN c.user_one = ? THEN u2.username
        ELSE u1.username
      END AS username,

      CASE
        WHEN c.user_one = ? THEN u2.status
        ELSE u1.status
      END AS status,

      m.content AS last_message,
      m.message_type,  /* <--- TAMBAHKAN INI */
      m.image_url,     /* <--- TAMBAHKAN INI */
      m.sent_at AS last_message_time

    FROM conversations c

    JOIN users u1 ON u1.user_id = c.user_one
    JOIN users u2 ON u2.user_id = c.user_two

    LEFT JOIN (
      SELECT m1.*
      FROM messages m1
      JOIN (
        SELECT conversation_id, MAX(sent_at) AS last_time
        FROM messages
        GROUP BY conversation_id
      ) m2 
      ON m1.conversation_id = m2.conversation_id
      AND m1.sent_at = m2.last_time
    ) m ON m.conversation_id = c.conversation_id

    WHERE 
      (c.user_one = ? OR c.user_two = ?)
      AND c.conversation_type = 'private'
      AND m.sent_at IS NOT NULL

    ORDER BY m.sent_at DESC
  `;

  const [rows] = await db.query(query, [
    currentUserId, currentUserId, currentUserId, currentUserId, currentUserId
  ]);

  return rows;
}

static async searchUsers(keyword, currentUserId) {

  const query = `
    SELECT 
      user_id,
      username,
      status
    FROM users
    WHERE username LIKE ?
    AND user_id != ?
    LIMIT 20
  `;

  const [rows] = await db.query(query, [
    `%${keyword}%`,
    currentUserId
  ]);

  return rows;
}
static async getById(userId) {

    const [rows] = await db.query(
      `SELECT user_id, username, status, last_online
       FROM users
       WHERE user_id = ?`,
      [userId]
    );

    return rows[0];
  }
}



module.exports = User;