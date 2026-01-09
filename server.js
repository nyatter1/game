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

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  // Point to the index.html inside the public folder
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Real-time communication logic
io.on('connection', (socket) => {
  console.log('A guest has entered the lounge');

  // Handle joining the room
  socket.on('join', (username) => {
    socket.username = username;
    socket.broadcast.emit('system_message', `${username} has joined the circle.`);
  });

  // Handle chat messages
  socket.on('chat_message', (msg) => {
    io.emit('chat_message', {
      user: socket.username || 'Anonymous',
      text: msg.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('system_message', `${socket.username} has left the gallery.`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Lumière Lounge operating on port ${PORT}`);
});
