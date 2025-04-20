import React, { useState, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  CssBaseline, // Ensures baseline styles and dark mode works easily
  ThemeProvider, // To apply theme
  createTheme, // To create a theme
  List,
  ListItem,
  ListItemText,
  Stack, // Useful for layout
  Paper, // For containing the room view
  Chip, // For status indicators
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // Ready icon
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked"; // Not ready icon
// Define a dark theme (can be customized further)
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      // CS-like orange/yellow
      main: "#f0ad4e",
      contrastText: "#1a1a1a", // Dark text for primary button
    },
    secondary: {
      // CS-like blue/cyan
      main: "#5bc0de",
      contrastText: "#1a1a1a", // Dark text for secondary button
    },
    background: {
      default: "#121212", // Even darker background
      paper: "#1e1e1e", // Slightly lighter paper
    },
    text: {
      primary: "#e0e0e0",
      secondary: "#b0b0b0",
    },
    success: {
      main: "#4caf50", // Green for ready/connected
    },
    error: {
      main: "#d9534f", // Red for errors/leave
    },
    divider: "rgba(255, 255, 255, 0.12)", // Lighter divider for dark mode
  },
  typography: {
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    h4: {
      fontWeight: "bold",
      textTransform: "uppercase",
      letterSpacing: "2px",
      marginBottom: "1rem",
      textShadow: "1px 1px 3px rgba(0, 0, 0, 0.5)",
    },
    h5: {
      fontWeight: "bold",
    },
    body2: {
      // For status text
      color: "#999999",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          fontWeight: "bold",
          letterSpacing: "1px",
          padding: "0.6rem 1.5rem",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            "&.Mui-focused fieldset": {
              borderColor: "#f0ad4e", // Focus color
            },
          },
        },
      },
    },
    MuiPaper: {
      // Style for the room view container
      styleOverrides: {
        root: {
          padding: "2rem",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          width: "100%",
          maxWidth: "500px",
          textAlign: "center",
        },
      },
    },
  },
});

interface User {
  id: string;
  username: string;
  ready: boolean;
}

interface Room {
  id: string;
  users: User[];
}

interface ServerResponse {
  success: boolean;
  roomId?: string;
  error?: string;
}

interface ToggleReadyResponse {
  success: boolean;
  error?: string;
}

export const Lobby: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<Room | null>(null); // Store the current room state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);

  // Clear error on input change
  useEffect(() => {
    setError(null);
  }, [username, roomCode]);

  // Listen for room updates
  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdate = (updatedRoom: Room) => {
      console.log("Room update received:", updatedRoom);
      setRoomState(updatedRoom);
    };

    socket.on("room-update", handleRoomUpdate);

    return () => {
      socket.off("room-update", handleRoomUpdate);
    };
  }, [socket]);

  // Reset room state when leaving
  useEffect(() => {
    if (!joinedRoomId) {
      setRoomState(null);
    }
  }, [joinedRoomId]);

  const handleAction = (action: "create" | "join") => {
    if (!socket) return;

    const name = username.trim();
    const code = roomCode.trim().toUpperCase();

    if (name.length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }
    if (action === "join" && code === "") {
      setError("Room code cannot be empty.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const event = action === "create" ? "create-room" : "join-room";
    const args = action === "create" ? [name] : [code, name];

    socket.emit(event, ...args, (response: ServerResponse) => {
      setIsLoading(false);
      if (response.success && response.roomId) {
        console.log(
          `${action === "create" ? "Created" : "Joined"} room:`,
          response.roomId
        );
        setJoinedRoomId(response.roomId);
        if (action === "create") {
          setRoomCode(response.roomId); // Pre-fill code after creation
        }
      } else {
        console.error(`Failed to ${action} room:`, response.error);
        setError(response.error || `Failed to ${action} room.`);
      }
    });
  };

  const handleToggleReady = () => {
    if (!socket || isTogglingReady) return;

    setIsTogglingReady(true);
    socket.emit("toggle-ready", (response: ToggleReadyResponse) => {
      setIsTogglingReady(false);
      if (!response.success) {
        console.error("Failed to toggle ready status:", response.error);
        // Potentially show an error to the user
        setError(response.error || "Failed to update ready status.");
      } else {
        setError(null); // Clear previous errors on success
      }
    });
  };

  const handleLeaveRoom = () => {
    if (socket) {
      // Optional: Inform the server the user is leaving proactively
      // socket.emit('leave-room');
    }
    setJoinedRoomId(null);
    setRoomCode("");
    setRoomState(null); // Clear room state
    setError(null); // Clear errors
  };

  const currentUser = roomState?.users.find((user) => user.id === socket?.id);

  // --- Render Joined Room View ---
  if (joinedRoomId && roomState) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Container
          maxWidth="sm"
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
          }}
        >
          <Paper elevation={3}>
            <Typography
              variant="h5"
              component="h2"
              color="primary"
              gutterBottom
            >
              Room: {roomState.id}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Welcome, {currentUser?.username || username}!
            </Typography>

            <Typography variant="h6" sx={{ mb: 1 }}>
              Players:
            </Typography>
            <List sx={{ width: "100%", mb: 3 }}>
              {roomState.users.map((user) => (
                <ListItem
                  key={user.id}
                  disablePadding
                  secondaryAction={
                    <Chip
                      icon={
                        user.ready ? (
                          <CheckCircleIcon />
                        ) : (
                          <RadioButtonUncheckedIcon />
                        )
                      }
                      label={user.ready ? "Ready" : "Not Ready"}
                      color={user.ready ? "success" : "default"}
                      size="small"
                    />
                  }
                >
                  <ListItemText
                    primary={user.username}
                    sx={{
                      color:
                        user.id === socket?.id
                          ? "primary.main"
                          : "text.primary",
                    }}
                  />
                </ListItem>
              ))}
              {[...Array(Math.max(0, 2 - roomState.users.length))].map(
                (_, i) => (
                  <ListItem key={`empty-${i}`} disablePadding>
                    <ListItemText
                      primary="...waiting..."
                      sx={{ fontStyle: "italic", color: "text.secondary" }}
                    />
                  </ListItem>
                )
              )}
            </List>

            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                color={currentUser?.ready ? "warning" : "success"} // Toggle color
                onClick={handleToggleReady}
                disabled={isTogglingReady}
                startIcon={
                  isTogglingReady ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : currentUser?.ready ? (
                    <RadioButtonUncheckedIcon />
                  ) : (
                    <CheckCircleIcon />
                  )
                }
              >
                {currentUser?.ready ? "Not Ready" : "Ready"}
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleLeaveRoom}
              >
                Leave Room
              </Button>
            </Stack>
          </Paper>
        </Container>
      </ThemeProvider>
    );
  }

  // --- Render Lobby Form View ---
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container
        maxWidth="xs"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center", // Center content vertically
          minHeight: "100vh", // Ensure takes full height
          pt: { xs: 4, sm: 8 }, // Adjust padding based on screen size
          pb: 4,
        }}
      >
        <Paper
          sx={{
            p: { xs: 2, sm: 4 },
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            textAlign="center"
          >
            Combat Strategy
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mb: 3,
              color: isConnected ? "success.main" : "text.secondary",
            }}
          >
            Status: {isConnected ? "Connected" : "Offline"}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ width: "100%", mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ width: "100%", mb: 2 }}>
            <TextField
              id="username"
              label="Username"
              variant="outlined"
              fullWidth
              required
              placeholder="Enter Username (min 3 chars)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              error={Boolean(error && error.includes("Username"))}
            />
          </Box>
          // Use Stack for better control over Room Code input + Join Button
          <Stack
            direction="row"
            spacing={1}
            sx={{ width: "100%", mb: 1 }}
            alignItems="flex-start"
          >
            <TextField
              id="roomCode"
              label="Room Code"
              variant="outlined"
              fullWidth
              placeholder="Enter Code to Join"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              disabled={isLoading}
              error={Boolean(
                error &&
                  (error.includes("Room code") ||
                    error.includes("Room not found") ||
                    error.includes("full"))
              )}
              sx={{ flexGrow: 1 }} // Allow TextField to grow
            />
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleAction("join")}
              disabled={
                !isConnected ||
                roomCode.trim() === "" ||
                username.trim().length < 3 ||
                isLoading
              }
              sx={{
                height: "56px",
                whiteSpace: "nowrap",
                flexShrink: 0,
                mt: 0,
              }} // Match height, prevent shrink, remove default top margin
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Join Room"
              )}
            </Button>
          </Stack>
          <Button
            variant="contained"
            color="secondary"
            fullWidth
            onClick={() => handleAction("create")}
            disabled={!isConnected || username.trim().length < 3 || isLoading}
            sx={{ mt: 1 }} // Keep margin for this button
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Create New Room"
            )}
          </Button>
        </Paper>
      </Container>
    </ThemeProvider>
  );
};
