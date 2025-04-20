import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import io, { Socket } from "socket.io-client";

const SOCKET_SERVER_URL = "http://localhost:3001";

interface SocketContextProps {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextProps | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    console.log("[SocketProvider] Initializing socket connection...");
    const newSocket = io(SOCKET_SERVER_URL, {
      // Optional: Add connection options if needed
      // transports: ['websocket'],
    });

    setSocket(newSocket);

    const handleConnect = () => {
      console.log("[SocketProvider] Connected:", newSocket.id);
      setIsConnected(true);
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      console.log("[SocketProvider] Disconnected:", reason);
      setIsConnected(false);
      // Optional: Handle reconnection attempts or notify user
    };

    const handleConnectError = (error: Error) => {
      console.error("[SocketProvider] Connection Error:", error);
      setIsConnected(false);
      // Optional: Handle connection errors
    };

    newSocket.on("connect", handleConnect);
    newSocket.on("disconnect", handleDisconnect);
    newSocket.on("connect_error", handleConnectError);

    // Cleanup on component unmount
    return () => {
      console.log("[SocketProvider] Disconnecting socket...");
      newSocket.off("connect", handleConnect);
      newSocket.off("disconnect", handleDisconnect);
      newSocket.off("connect_error", handleConnectError);
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, []); // Empty dependency array ensures this runs only once

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to consume the context
export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocketContext must be used within a SocketProvider");
  }
  return context;
};
