const db = require('../db')

class Conversation {

  static async getById(conversationId) {
    const [rows] = await db.query(
      `SELECT * FROM conversations WHERE conversation_id = ?`,
      [conversationId]
    );

    return rows[0];
  }

  static async findBetweenUsers(userOne, userTwo) {
    const [rows] = await db.query(
      `SELECT * FROM conversations 
       WHERE (user_one = ? AND user_two = ?)
       OR (user_one = ? AND user_two = ?)`,
      [userOne, userTwo, userTwo, userOne]
    );

    return rows[0];
  }

  static async create(userOne, userTwo) {
    const [result] = await db.query(
      `INSERT INTO conversations (user_one, user_two) VALUES (?, ?)`,
      [userOne, userTwo]
    );

    return result.insertId;
  }

}

module.exports = Conversation;