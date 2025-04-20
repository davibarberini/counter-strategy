import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  IconButton,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { User } from "./Lobby"; // Re-use User interface
import { useSocketContext } from "../context/SocketContext"; // Import the new context hook

// Define ChatMessage interface (can be moved to a types file later)
interface ChatMessage {
  username: string;
  message: string;
  timestamp: number;
}

interface ChatInterfaceProps {
  roomId: string;
  currentUser: User;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  roomId,
  currentUser,
}) => {
  const { socket } = useSocketContext(); // Use the context hook
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null); // Ref to scroll to bottom

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listener for 'new-message' events from socket
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (message: ChatMessage) => {
      console.log(
        "[Client Log] Received 'new-message':",
        JSON.stringify(message)
      );
      setMessages((prevMessages) => [...prevMessages, message]);
    };
    socket.on("new-message", handleNewMessage);
    return () => {
      socket.off("new-message", handleNewMessage);
    };
  }, [socket]);

  const handleSendMessage = () => {
    if (newMessage.trim() === "" || !socket) {
      return;
    }

    const messageData = {
      roomId: roomId,
      message: newMessage.trim(),
      username: currentUser.username,
    };

    console.log("Sending message:", messageData);
    // Emit 'send-message' event to socket
    socket.emit("send-message", messageData);

    // Clear input field
    setNewMessage("");
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(event.target.value);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault(); // Prevent new line on enter
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Typography
        variant="h6"
        sx={{ p: 2, pb: 1, borderBottom: 1, borderColor: "divider" }}
      >
        Chat
      </Typography>
      <Box sx={{ flexGrow: 1, overflowY: "auto", p: 1 }}>
        <List dense>
          {messages.map((msg, index) => (
            <ListItem key={index} sx={{ alignItems: "flex-start" }}>
              <ListItemText
                primary={msg.username}
                secondary={msg.message}
                primaryTypographyProps={{
                  fontWeight: "bold",
                  color:
                    currentUser.username === msg.username
                      ? "secondary.main"
                      : "primary.main",
                }} // Highlight own messages differently
                secondaryTypographyProps={{
                  color: "text.primary",
                  sx: { wordBreak: "break-word" },
                }}
              />
            </ListItem>
          ))}
          {/* Empty div to scroll to */}
          <div ref={messagesEndRef} />
        </List>
      </Box>
      <Paper elevation={3} square sx={{ p: 1, mt: "auto" }}>
        {" "}
        {/* Push to bottom */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <TextField
            variant="outlined"
            size="small"
            fullWidth
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            multiline
            maxRows={3} // Allow some expansion
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !socket}
            sx={{ ml: 1 }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};
