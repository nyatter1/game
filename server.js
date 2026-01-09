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
 * SERVING STATIC FILES
 * The client code expects index.html to be inside a 'public' folder.
 */
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * SOCKET.IO REAL-TIME LOGIC
 */
io.on('connection', (socket) => {
  console.log('A connection has been established with the Lumière gateway.');

  // When a user successfully logs in/signs up on the client and emits 'join'
  socket.on('join', (username) => {
    socket.username = username;
    console.log(`${username} has entered the Main Gallery.`);
    
    // Notify other connected clients (system message)
    socket.broadcast.emit('system_message', `${username} HAS ENTERED THE CIRCLE.`);
  });

  // Handle incoming chat messages
  socket.on('chat_message', (msg) => {
    if (!socket.username) return; // Prevent messages from unauthenticated sockets

    const messageData = {
      user: socket.username,
      text: msg.text,
      // Formatted timestamp for the luxury UI
      time: new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    };

    // Broadcast message to everyone including the sender
    io.emit('chat_message', messageData);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.username) {
      console.log(`${socket.username} has departed.`);
      io.emit('system_message', `${socket.username} HAS LEFT THE GALLERY.`);
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
  console.log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`-------------------------------------------`);
});
