import { Server } from "socket.io"

export default function handler(req, res) {
  if (!res.socket.server.io) {
    console.log("New Socket.io server...");
    const httpServer = res.socket.server;
    const io = new Server(httpServer, {
      path: process.env.NEXT_PUBLIC_SOCKET_URL,
    });
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      console.log('a user connected');
      socket.on('joined-room', (roomId, userId) => {
        console.log('joined-room');
        socket.join(roomId);
        socket.broadcast.to(roomId).emit('user-connected', userId)

        socket.on('disconnect', () => {
          socket.broadcast.to(roomId).emit('user-disconnected');
        });
      })
    });
  }
  res.end();
}
