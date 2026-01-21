const db = require('./db');

async function checkUserExists(userId) {
  const [rows] = await db.query(
    'SELECT user_id, username FROM users WHERE user_id = ?', 
    [userId]
  );
  return rows[0] || null;
}

async function validateChatUsers() {
  const testCases = [
    { current: 1, other: 2 }, // Case valid
    { current: 1, other: 999 } // Case invalid
  ];

  for (const test of testCases) {
    const currentUser = await checkUserExists(test.current);
    const otherUser = await checkUserExists(test.other);
    
    console.log(`Test Case: ${test.current} -> ${test.other}`);
    console.log('Current User:', currentUser);
    console.log('Other User:', otherUser);
    console.log('------------------------');
  }
}

validateChatUsers();