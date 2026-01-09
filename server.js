const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// Tell the server to look for index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle the "Live" connection
io.on('connection', (socket) => {
  console.log('A user connected');

  // Listen for the 'chat message' event from a user
  socket.on('chat message', (data) => {
    // Send the message to EVERYONE connected
    io.emit('chat message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Render provides a PORT environment variable, or we use 3000 locally
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
