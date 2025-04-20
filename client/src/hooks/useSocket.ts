import { useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";

const SOCKET_SERVER_URL = "http://localhost:3001"; // Your server URL

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Connect to the socket server
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    const handleConnect = () => {
      console.log("Connected to socket server", newSocket.id);
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log("Disconnected from socket server");
      setIsConnected(false);
    };

    // Add event listeners
    newSocket.on("connect", handleConnect);
    newSocket.on("disconnect", handleDisconnect);

    // Clean up on unmount
    return () => {
      newSocket.off("connect", handleConnect);
      newSocket.off("disconnect", handleDisconnect);
      newSocket.disconnect();
      setSocket(null);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return { socket, isConnected };
};
