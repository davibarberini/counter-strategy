import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import { Room, User } from "./Lobby"; // Re-use interfaces from Lobby
import { ChatInterface } from "./ChatInterface"; // Import Chat

interface GameSceneProps {
  room: Room;
  currentUser: User;
}

export const GameScene: React.FC<GameSceneProps> = ({ room, currentUser }) => {
  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        width: "100vw", // Ensure it takes full viewport width
        overflow: "hidden", // Prevent potential scrollbars on main container
        bgcolor: "background.default",
      }}
    >
      {/* Main Game Canvas Area (Placeholder) */}
      <Box
        component={Paper}
        elevation={1}
        square
        sx={{
          flexGrow: 1, // Takes up remaining space
          height: "calc(100vh - 16px)", // Full height minus margins
          p: 2,
          m: 1,
          mr: 0, // No right margin
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "grey.900",
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Game Canvas Area
        </Typography>
        <Typography variant="caption" color="text.secondary">
          (Room: {room.id})
        </Typography>
      </Box>

      {/* Chat Sidebar */}
      <Box
        component={Paper}
        elevation={2}
        square
        sx={{
          width: "350px", // Slightly wider chat
          flexShrink: 0, // Prevent chat from shrinking
          height: "calc(100vh - 16px)", // Full height minus margins
          m: 1,
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
        }}
      >
        <ChatInterface roomId={room.id} currentUser={currentUser} />
      </Box>
    </Box>
  );
};
