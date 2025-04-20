import React, { useState, useEffect, useCallback } from "react";
import { useSocketContext } from "../context/SocketContext";
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
  ListItemButton, // For clickable lobby list items
  Stack, // Useful for layout
  Paper, // For containing the room view
  Chip, // For status indicators
  Divider, // To separate sections
  IconButton, // For refresh button
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // Ready icon
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked"; // Not ready icon
import RefreshIcon from "@mui/icons-material/Refresh"; // Refresh icon
import { GameScene } from "./GameScene"; // Import the new component

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

// Export interfaces for use in other components
export interface User {
  id: string;
  username: string;
  ready: boolean;
}

export interface Room {
  id: string;
  users: User[];
}

interface LobbyInfo {
  id: string;
  playerCount: number;
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

const USERNAME_STORAGE_KEY = "combatStrategyUsername";

export const Lobby: React.FC = () => {
  const { socket, isConnected } = useSocketContext();
  // Load initial username from localStorage
  const [username, setUsername] = useState(
    () => localStorage.getItem(USERNAME_STORAGE_KEY) || ""
  );
  const [roomCode, setRoomCode] = useState("");
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<Room | null>(null);
  const [availableLobbies, setAvailableLobbies] = useState<LobbyInfo[]>([]); // State for lobby list
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLobbies, setIsLoadingLobbies] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [gameStarted, setGameStarted] = useState(false); // State for game start

  // --- LocalStorage Effect ---
  useEffect(() => {
    // Save username whenever it changes (could also be done only on join/create)
    if (username.trim()) {
      localStorage.setItem(USERNAME_STORAGE_KEY, username.trim());
    } else {
      // Optional: remove if username is cleared
      // localStorage.removeItem(USERNAME_STORAGE_KEY);
    }
  }, [username]);

  // --- Socket Event Listeners ---
  const fetchLobbies = useCallback(() => {
    if (!socket || !isConnected) return;
    setIsLoadingLobbies(true);
    socket.emit("get-lobbies", (lobbies: LobbyInfo[]) => {
      setAvailableLobbies(lobbies);
      setIsLoadingLobbies(false);
      console.log("Fetched lobbies:", lobbies);
    });
  }, [socket, isConnected]);

  // Define handleLobbiesUpdated outside useEffect, wrapped in useCallback
  const handleLobbiesUpdated = useCallback(() => {
    console.log("[Client Log] Lobbies updated signal received.");
    // Always refetch lobbies
    fetchLobbies();
    // If currently in a room, explicitly ask for its state
    if (socket && joinedRoomId) {
      console.log(
        `[Client Log] In room ${joinedRoomId}, requesting specific update.`
      );
      socket.emit("get-room-state", joinedRoomId);
    }
  }, [socket, joinedRoomId, fetchLobbies]);

  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdate = (updatedRoom: Room) => {
      console.log(
        "[Client Log] Received room-update:",
        JSON.stringify(updatedRoom)
      );
      setRoomState(updatedRoom);
      setRoomState((currentState) => {
        console.log(
          "[Client Log] roomState updated to:",
          JSON.stringify(currentState)
        );
        return currentState;
      });
    };

    const handleStartGame = (finalRoomState: Room) => {
      console.log(
        "[Client Log] Start game signal received! Room:",
        finalRoomState
      );
      setRoomState(finalRoomState); // Ensure state is final
      setGameStarted(true);
    };

    // Setup listeners
    socket.on("room-update", handleRoomUpdate);
    socket.on("lobbies-updated", handleLobbiesUpdated);
    socket.on("specific-room-update", handleRoomUpdate);
    socket.on("start-game", handleStartGame); // Add listener for game start

    // Fetch initial lobby list when connected
    if (isConnected) {
      fetchLobbies();
    }

    return () => {
      // Clean up listeners
      socket.off("room-update", handleRoomUpdate);
      socket.off("lobbies-updated", handleLobbiesUpdated);
      socket.off("specific-room-update", handleRoomUpdate);
      socket.off("start-game", handleStartGame); // Clean up game start listener
    };
  }, [socket, isConnected, fetchLobbies, handleLobbiesUpdated]); // Add handleLobbiesUpdated to dependency array

  // Clear error on input change
  useEffect(() => {
    setError(null);
  }, [username, roomCode]);

  // Reset room state when leaving
  useEffect(() => {
    if (!joinedRoomId) {
      setRoomState(null);
    }
  }, [joinedRoomId]);

  // --- Action Handlers ---
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
    localStorage.setItem(USERNAME_STORAGE_KEY, name); // Save username on action

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
          setRoomCode(response.roomId);
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
        setError(response.error || "Failed to update ready status.");
      } else {
        setError(null);
      }
    });
  };

  const handleLeaveRoom = () => {
    if (socket) {
      // You could emit a 'leave-room' event here if needed on the server
    }
    setJoinedRoomId(null);
    setRoomCode("");
    setRoomState(null);
    setError(null);
    fetchLobbies(); // Refresh lobby list after leaving
  };

  const handleLobbyClick = (lobbyId: string) => {
    setRoomCode(lobbyId);
  };

  const currentUser = roomState?.users.find((user) => user.id === socket?.id);

  // --- Conditional Rendering ---

  // Render Game Scene if started
  if (gameStarted && roomState && currentUser) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <GameScene room={roomState} currentUser={currentUser} />
      </ThemeProvider>
    );
  }

  // Render Joined Room View if in room but game not started
  if (joinedRoomId && roomState) {
    console.log(
      "[Client Log] Rendering Joined Room View with roomState:",
      JSON.stringify(roomState)
    );
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
                color={currentUser?.ready ? "warning" : "success"}
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

  // Render Lobby Form View otherwise
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container
        maxWidth="sm" // Use sm for a slightly wider form area
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          pt: { xs: 2, sm: 4 },
          pb: 4,
        }}
      >
        <Paper
          sx={{
            p: { xs: 2, sm: 3 },
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

          {/* === Join/Create Section === */}
          <Box sx={{ width: "100%", mb: 3 }}>
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
              InputLabelProps={{ shrink: true }} // Keep label floated when loaded from storage
              sx={{ mb: 2 }} // Add margin below username
            />

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
                sx={{ flexGrow: 1 }}
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
                }}
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
              sx={{ mt: 1 }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Create New Room"
              )}
            </Button>
          </Box>

          <Divider sx={{ width: "100%", my: 3 }}>OR</Divider>

          {/* === Available Lobbies Section === */}
          <Box sx={{ width: "100%" }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="h6">Available Lobbies</Typography>
              <IconButton
                onClick={fetchLobbies}
                disabled={isLoadingLobbies || !isConnected}
                size="small"
              >
                {isLoadingLobbies ? (
                  <CircularProgress size={20} />
                ) : (
                  <RefreshIcon />
                )}
              </IconButton>
            </Stack>
            {isLoadingLobbies ? (
              <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
                <CircularProgress />
              </Box>
            ) : availableLobbies.length > 0 ? (
              <List dense>
                {" "}
                {/* dense makes list items smaller */}
                {availableLobbies.map((lobby) => (
                  <ListItem key={lobby.id} disablePadding>
                    <ListItemButton
                      onClick={() => handleLobbyClick(lobby.id)}
                      disabled={isLoading}
                    >
                      <ListItemText
                        primary={`Room ${lobby.id}`}
                        secondary={`${lobby.playerCount}/2 Players`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                No available lobbies found. Create one!
              </Typography>
            )}
          </Box>
        </Paper>
      </Container>
    </ThemeProvider>
  );
};
