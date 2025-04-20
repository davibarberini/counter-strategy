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
      console.log(
        `[Server Log] Added user ${newUser.username} (${socket.id}) to users map.`
      );
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
      console.log(
        `[Server Log] Added user ${newUser.username} (${socket.id}) to users map.`
      );
      socket.join(roomId);

      console.log(`User ${username} (${socket.id}) joined room ${roomId}`);
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
      let roomToUpdate: Room | null = null; // Store the room reference

      for (const [roomId, room] of rooms.entries()) {
        const userInRoom = room.users.find((u) => u.id === socket.id);
        if (userInRoom) {
          userRoomId = roomId;
          roomToUpdate = room; // Found the room
          userInRoom.ready = !userInRoom.ready;
          console.log(
            `User ${user.username} (${socket.id}) ready status in room ${roomId}: ${userInRoom.ready}`
          );
          emitRoomUpdate(roomId);
          callback({ success: true });
          break;
        }
      }

      if (!userRoomId || !roomToUpdate) {
        return callback({
          success: false,
          error: "User not found in any room.",
        });
      }

      // --- Check if game can start ---
      // Check if room has enough players (e.g., 2) and everyone is ready
      const canStart =
        roomToUpdate.users.length === 2 &&
        roomToUpdate.users.every((u) => u.ready);

      if (canStart) {
        console.log(
          `[Server Log] All players ready in room ${userRoomId}. Starting game...`
        );
        io.to(userRoomId).emit("start-game", roomToUpdate); // Send final room state with start signal
        // Consider marking the room as "in-game" or removing it from lobby list logic later
        io.emit("lobbies-updated"); // Room is now full/in-game, update lobby list
      }
    }
  );

  socket.on("disconnect", () => {
    console.log("[Server Log] disconnect event for socket:", socket.id);
    const user = users.get(socket.id);
    if (user) {
      let userRoomId: string | null = null;
      let lobbyListChanged = false;
      for (const [roomId, room] of rooms.entries()) {
        const userIndex = room.users.findIndex((u) => u.id === socket.id);
        if (userIndex !== -1) {
          userRoomId = roomId;
          const wasRoomFull = room.users.length === 2;
          room.users.splice(userIndex, 1);
          console.log(
            `[Server Log] User ${user.username} removed from room ${roomId}`
          );
          if (room.users.length === 0) {
            rooms.delete(roomId);
            console.log(
              `[Server Log] Room ${roomId} deleted as it became empty.`
            );
            lobbyListChanged = true;
          } else {
            console.log(
              `[Server Log] Emitting room-update to room ${roomId} (remaining users: ${room.users.length})`
            );
            emitRoomUpdate(roomId);
            if (wasRoomFull) {
              lobbyListChanged = true;
            }
          }
          break;
        }
      }
      users.delete(socket.id);
      if (lobbyListChanged) {
        console.log(
          "[Server Log] Emitting lobbies-updated due to disconnect changes."
        );
        io.emit("lobbies-updated");
      }
    } else {
      console.log(
        `[Server Log] Disconnected user ${socket.id} was not found in users map.`
      );
    }
  });

  // --- Get Specific Room State ---
  socket.on("get-room-state", (roomId: string) => {
    const room = rooms.get(roomId);
    if (room && room.users.some((user) => user.id === socket.id)) {
      // Ensure requester is in the room
      console.log(
        `[Server Log] Sending specific room state for ${roomId} to ${socket.id}`
      );
      // Emit back directly to the requesting socket using the new event name
      socket.emit("specific-room-update", room);
    } else {
      console.log(
        `[Server Log] Denied get-room-state for ${roomId} from ${socket.id} (not found or not in room)`
      );
      // Optionally emit an error back to the client
      // socket.emit('error-message', 'Could not retrieve room state.');
    }
  });

  // --- Chat Messaging ---
  socket.on(
    "send-message",
    (data: { roomId: string; message: string; username: string }) => {
      const { roomId, message, username } = data;
      // Basic validation
      if (!roomId || !message || !username) {
        console.log("[Server Log] Invalid send-message data received from");
        return; // Ignore invalid messages
      }

      // Ensure sender is actually in the room they claim (optional but good practice)
      const room = rooms.get(roomId);
      if (!room || !room.users.some((user) => user.id === socket.id)) {
        console.log(
          `[Server Log] User ${socket.id} tried to send message to room ${roomId} they are not in.`
        );
        return;
      }

      console.log(
        `[Server Log] Message received from ${username} in room ${roomId}: ${message}`
      );
      const messageData = {
        username: username,
        message: message.trim(), // Trim message
        timestamp: Date.now(),
      };
      // Broadcast the message to everyone in the room (including sender)
      console.log(`[Server Log] Broadcasting 'new-message' to room ${roomId}`);
      io.to(roomId).emit("new-message", messageData);
    }
  );
});

server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});
