const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS handling
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/**
 * PRESENCE TRACKING
 * Keeps track of active usernames mapped to their socket IDs
 */
const activeUsers = new Map(); // Map<SocketID, Username>

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * HELPER: Broadcast updated user list
 */
function broadcastUserUpdate() {
  const onlineUsernames = Array.from(new Set(activeUsers.values()));
  io.emit('user_update', onlineUsernames);
}

/**
 * SOCKET.IO REAL-TIME LOGIC
 */
io.on('connection', (socket) => {
  console.log('A connection has been established.');

  // When a user successfully logs in/signs up on the client and emits 'join'
  socket.on('join', (username) => {
    socket.username = username;
    activeUsers.set(socket.id, username);
    
    console.log(`${username} has entered the Main Gallery.`);
    
    // Notify all clients of the new online list immediately
    broadcastUserUpdate();
    
    // Notify other connected clients (system message)
    socket.broadcast.emit('system_message', `${username.toUpperCase()} HAS ENTERED THE CIRCLE.`);
  });

  // Handle incoming chat messages
  socket.on('chat_message', (msg) => {
    if (!socket.username) return;

    const messageData = {
      user: socket.username,
      text: msg.text,
      time: new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    };

    io.emit('chat_message', messageData);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.username) {
      console.log(`${socket.username} has departed.`);
      
      // Remove from active tracking
      activeUsers.delete(socket.id);
      
      // Update everyone's online/offline list
      broadcastUserUpdate();
      
      io.emit('system_message', `${socket.username.toUpperCase()} HAS LEFT THE GALLERY.`);
    }
  });
});

/**
 * SERVER STARTUP
 */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`Lumière Live Lounge operating on port ${PORT}`);
  console.log(`-------------------------------------------`);
});
