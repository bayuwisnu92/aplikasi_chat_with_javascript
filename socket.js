const db = require("./db");
const jwt = require("jsonwebtoken");
let io;

const initSocket = (server) => {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: "http://127.0.0.1:5501",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

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

      // update status online
      db.query(
        "UPDATE users SET status='online' WHERE user_id=?",
        [userId]
      );

      io.emit("user_status", {
        userId,
        status: "online"
      });

      // =========================
      // JOIN PRIVATE CONVERSATION
      // =========================
      socket.on("joinConversation", (conversationId) => {
        console.log("JOIN CONVERSATION:", conversationId);
        socket.join(conversationId);
      });

      // =========================
      // JOIN GROUP
      // =========================
      socket.on("joinGroup", (groupId) => {
        const room = "group_" + groupId;
        console.log("JOIN GROUP:", room);
        socket.join(room);
      });

      // =========================
      // DISCONNECT
      // =========================
      socket.on("disconnect", async () => {

        console.log("User disconnected:", socket.id);

        await db.query(
          "UPDATE users SET status='offline', last_online=NOW() WHERE user_id=?",
          [userId]
        );

        io.emit("user_status", {
          userId,
          status: "offline"
        });

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