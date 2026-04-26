const db = require("./db");
const jwt = require("jsonwebtoken");
let io;

const initSocket = (server) => {
  const { Server } = require("socket.io");

 io = new Server(server, {
  cors: {
    origin: [
      "http://127.0.0.1:5501",
      "https://bayuwisnu92.github.io"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const onlineUsers = new Map(); // userId -> jumlah koneksi
  io.on("connection", (socket) => {
    
    console.log("User connected:", socket.id);

    const token = socket.handshake.auth?.token;

    if (!token) {
      console.log("TOKEN TIDAK ADA");
      return;
    }

    try {

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      console.log("USER ID FROM TOKEN:", userId);

      socket.userId = userId;
      // === TAMBAHKAN BARIS INI ===
      // Setiap user join ke room unik berdasarkan ID-nya sendiri
      socket.join("user_" + userId); 
      console.log(`User ${userId} bergabung ke room pribadi: user_${userId}`);
      console.log("USER JOIN:", userId, "->", "user_" + userId);
      // ===========================
      // update status online
      db.query(
        "UPDATE users SET status='online' WHERE user_id=?",
        [userId]
      );

     if (!onlineUsers.has(userId)) {
  onlineUsers.set(userId, 0);
}

onlineUsers.set(userId, onlineUsers.get(userId) + 1);

// 🔥 hanya emit kalau ini koneksi pertama
if (onlineUsers.get(userId) === 1) {
  io.emit("user_status", {
    userId,
    status: "online"
  });
}

      // =========================
      // JOIN PRIVATE CONVERSATION
      // =========================
      // PRIVATE
        socket.on("joinConversation", (conversationId) => {
          const room = "chat_" + conversationId;
          socket.join(room);
        });

        // GROUP
        socket.on("joinGroup", (groupId) => {
          const room = "group_" + groupId;
          socket.join(room);
        });

        socket.on("typing", async ({ type, id, senderId }) => {
  try {
    const room = type === "group"
      ? "group_" + id
      : "chat_" + id;

    const [rows] = await db.query(
      "SELECT username FROM users WHERE user_id=?",
      [senderId]
    );

    socket.to(room).emit("userTyping", {
      senderId,
      id,
      type,
      username: rows[0]?.username || "User"
    });

  } catch (err) {
    console.error("Error ambil username:", err);
  }
});


socket.on("stopTyping", async ({ type, id, senderId }) => {
  try {
    const room = type === "group"
      ? "group_" + id
      : "chat_" + id;

    const [rows] = await db.query(
      "SELECT username FROM users WHERE user_id=?",
      [senderId]
    );

    socket.to(room).emit("userStopTyping", {
      senderId,
      id,
      type,
      username: rows[0]?.username || "User"
    });

  } catch (err) {
    console.error("Error stopTyping:", err);
  }
});
        
        
        socket.on("messageDelivered", async ({ messageId, conversationId }) => {
        await db.query(
          "UPDATE messages SET status='delivered' WHERE message_id=?",
          [messageId]
        );

        io.to("chat_" + conversationId).emit("messageStatus", {
          messageId,
          status: "delivered"
        });
});

socket.on("messageRead", async ({ conversationId }) => {
  const userId = socket.userId;

  const [rows] = await db.query(
    `SELECT message_id FROM messages 
     WHERE conversation_id=? 
     AND sender_id != ? 
     AND status != 'read'`,
    [conversationId, userId]
  );

  if (!rows.length) return;

  const messageIds = rows.map(r => r.message_id);

  await db.query(
    `UPDATE messages 
     SET status='read' 
     WHERE message_id IN (?)`,
    [messageIds]
  );

  io.to("chat_" + conversationId).emit("messageStatus", {
    messageIds,
    status: "read"
  });
});

      // =========================
      // DISCONNECT
      // =========================
      socket.on("disconnect", async () => {

  const count = onlineUsers.get(userId) || 0;

  if (count <= 1) {
    onlineUsers.delete(userId);

    await db.query(
      "UPDATE users SET status='offline', last_online=NOW() WHERE user_id=?",
      [userId]
    );

    io.emit("user_status", {
      userId,
      status: "offline"
    });

  } else {
    onlineUsers.set(userId, count - 1);
  }

});

    } catch (err) {
      console.log("TOKEN INVALID:", err.message);
    }

  });

};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io belum diinisialisasi!");
  }
  return io;
};

module.exports = { initSocket, getIO };