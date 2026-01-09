const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/**
 * PRESENCE TRACKING
 * Map<SocketID, Username>
 */
const activeUsers = new Map(); 

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * HELPER: Broadcast updated user list
 * Sends a unique list of usernames to all clients
 */
function broadcastUserUpdate() {
  const onlineUsernames = Array.from(new Set(activeUsers.values()));
  io.emit('user_update', onlineUsernames);
}

io.on('connection', (socket) => {
  console.log('New connection established:', socket.id);

  socket.on('join', (username) => {
    // CLEANUP: If this user is already connected on another tab/device, 
    // you might want to allow it, but we ensure the username is tracked.
    socket.username = username;
    activeUsers.set(socket.id, username);
    
    console.log(`${username} entered the lounge.`);
    
    // Send the full list to everyone (including the person who just joined)
    broadcastUserUpdate();
    
    // System notification
    socket.broadcast.emit('system_message', `${username.toUpperCase()} HAS ENTERED THE CIRCLE`);
  });

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

  socket.on('disconnect', () => {
    if (socket.username) {
      console.log(`${socket.username} disconnected.`);
      
      // Remove this specific socket session
      activeUsers.delete(socket.id);
      
      // Update the UI for everyone else
      broadcastUserUpdate();
      
      io.emit('system_message', `${socket.username.toUpperCase()} HAS DEPARTED`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`Lumière Server: Active on Port ${PORT}`);
  console.log(`-------------------------------------------`);
});
