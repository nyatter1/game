const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// Keep track of connected users
let users = {}; 

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register user', (username) => {
    users[socket.id] = { id: socket.id, username: username };
    // Broadcast updated user list to everyone
    io.emit('update user list', Object.values(users));
  });

  socket.on('global message', (data) => {
    // Send to everyone
    io.emit('global message', data);
  });

  socket.on('private message', (data) => {
    // data.targetId is the socket.id of the recipient
    if (users[data.targetId]) {
      io.to(data.targetId).emit('private message', data);
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('update user list', Object.values(users));
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
