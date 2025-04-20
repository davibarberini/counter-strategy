import express, { Express } from "express";
import http from "http";
import { Server, Socket } from "socket.io"; // Import Socket type
import cors from "cors"; // Import cors
import { v4 as uuidv4 } from "uuid"; // For generating room codes

const app: Express = express();

// Use cors middleware
app.use(
  cors({
    origin: "http://localhost:5173", // Allow client origin (Vite default)
    methods: ["GET", "POST"],
  })
);

const server = http.createServer(app);

// Initialize Socket.IO server with CORS options
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT: string | number = process.env.PORT || 3001;

interface User {
  id: string;
  username: string;
  ready: boolean; // Added ready status
}

interface Room {
  id: string;
  users: User[];
  // Add game state later
}

// In-memory storage for rooms and users
const rooms: Map<string, Room> = new Map();
const users: Map<string, User> = new Map(); // Maps socket ID to User info

// Helper function to emit room updates
const emitRoomUpdate = (roomId: string) => {
  const room = rooms.get(roomId);
  if (room) {
    io.to(roomId).emit("room-update", room); // Send the entire room object
  }
};

io.on("connection", (socket: Socket) => {
  console.log("a user connected:", socket.id);

  // Handle username setting (can be part of create/join or separate)
  // For now, assume username is passed with create/join

  socket.on(
    "get-lobbies",
    (callback: (lobbies: { id: string; playerCount: number }[]) => void) => {
      const availableLobbies = [];
      for (const [roomId, room] of rooms.entries()) {
        // Only list non-empty and non-full rooms (assuming max 2 for now)
        if (room.users.length > 0 && room.users.length < 2) {
          availableLobbies.push({ id: roomId, playerCount: room.users.length });
        }
        if (availableLobbies.length >= 5) {
          // Limit to 5 lobbies
          break;
        }
      }
      callback(availableLobbies);
    }
  );

  socket.on(
    "create-room",
    (
      username: string,
      callback: (response: {
        success: boolean;
        roomId?: string;
        error?: string;
      }) => void
    ) => {
      if (!username || username.trim().length < 3) {
        return callback({
          success: false,
          error: "Username must be at least 3 characters long.",
        });
      }

      const roomId = uuidv4().substring(0, 6).toUpperCase(); // Simple 6-char ID
      const newUser: User = {
        id: socket.id,
        username: username.trim(),
        ready: false,
      }; // Initialize ready to false

      const newRoom: Room = {
        id: roomId,
        users: [newUser],
      };

      rooms.set(roomId, newRoom);
      users.set(socket.id, newUser);
      socket.join(roomId);

      console.log(
        `User ${username} (${socket.id}) created and joined room ${roomId}`
      );
      callback({ success: true, roomId: roomId }); // Send room ID back to creator
      emitRoomUpdate(roomId); // Emit initial room state
      io.emit("lobbies-updated"); // Notify all clients that lobby list might have changed
    }
  );

  socket.on(
    "join-room",
    (
      roomId: string,
      username: string,
      callback: (response: {
        success: boolean;
        roomId?: string;
        error?: string;
      }) => void
    ) => {
      if (!username || username.trim().length < 3) {
        return callback({
          success: false,
          error: "Username must be at least 3 characters long.",
        });
      }
      if (!roomId || !rooms.has(roomId)) {
        return callback({ success: false, error: "Room not found." });
      }

      const room = rooms.get(roomId)!;

      // Basic check: prevent joining if room is "full" (e.g., 2 players for 1v1)
      // You'll expand this logic based on game rules
      if (room.users.length >= 2) {
        return callback({ success: false, error: "Room is full." });
      }

      // Check if username is already taken in that room
      if (room.users.some((user) => user.username === username.trim())) {
        return callback({
          success: false,
          error: "Username already taken in this room.",
        });
      }

      const newUser: User = {
        id: socket.id,
        username: username.trim(),
        ready: false,
      }; // Initialize ready to false
      room.users.push(newUser);
      users.set(socket.id, newUser);
      socket.join(roomId);

      console.log(`User ${username} (${socket.id}) joined room ${roomId}`);
      // Notify others in the room
      socket.to(roomId).emit("user-joined", newUser);
      callback({ success: true, roomId: roomId }); // Confirm join to the user
      emitRoomUpdate(roomId); // Emit updated room state to everyone
      io.emit("lobbies-updated"); // Notify all clients that lobby list might have changed
    }
  );

  socket.on(
    "toggle-ready",
    (callback: (response: { success: boolean; error?: string }) => void) => {
      const user = users.get(socket.id);
      if (!user) {
        return callback({ success: false, error: "User not found." });
      }

      let userRoomId: string | null = null;
      // Find the user in a room and toggle their status
      for (const [roomId, room] of rooms.entries()) {
        const userInRoom = room.users.find((u) => u.id === socket.id);
        if (userInRoom) {
          userRoomId = roomId;
          userInRoom.ready = !userInRoom.ready; // Toggle ready state
          console.log(
            `User ${user.username} (${socket.id}) ready status in room ${roomId}: ${userInRoom.ready}`
          );
          emitRoomUpdate(roomId); // Notify everyone in the room about the change
          callback({ success: true });
          break;
        }
      }

      if (!userRoomId) {
        callback({ success: false, error: "User not found in any room." });
      }
    }
  );

  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
    const user = users.get(socket.id);
    if (user) {
      // Find which room the user was in
      let userRoomId: string | null = null;
      let lobbyListChanged = false; // Flag to check if lobby list needs update
      for (const [roomId, room] of rooms.entries()) {
        const userIndex = room.users.findIndex((u) => u.id === socket.id);
        if (userIndex !== -1) {
          userRoomId = roomId;
          const wasRoomFull = room.users.length === 2; // Check if room was full before user left
          room.users.splice(userIndex, 1);
          console.log(`User ${user.username} removed from room ${roomId}`);
          // Notify remaining users in the room
          socket.to(roomId).emit("user-left", user.username);
          // If room becomes empty, delete it (optional)
          if (room.users.length === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted as it became empty.`);
            lobbyListChanged = true; // Room deleted
          } else {
            emitRoomUpdate(roomId); // Notify remaining users
            if (wasRoomFull) {
              // If room was full, it might be available now
              lobbyListChanged = true;
            }
          }
          break; // User found, no need to check other rooms
        }
      }
      users.delete(socket.id); // Remove user from global user map
      if (lobbyListChanged) {
        io.emit("lobbies-updated"); // Notify clients if a room became available or was deleted
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});
