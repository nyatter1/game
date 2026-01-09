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

  // Register user with optional profile picture
  socket.on('register user', (data) => {
    // data can be just username or an object { username, pfp }
    const username = typeof data === 'string' ? data : data.username;
    const pfp = data.pfp || null;
    
    users[socket.id] = { id: socket.id, username: username, pfp: pfp };
    // Broadcast updated user list to everyone
    io.emit('update user list', Object.values(users));
  });

  // Handle PFP updates
  socket.on('update pfp', (pfpData) => {
    if (users[socket.id]) {
      users[socket.id].pfp = pfpData;
      io.emit('update user list', Object.values(users));
    }
  });

  socket.on('global message', (data) => {
    // Attach current PFP to the message data from server state
    if (users[socket.id]) {
      data.senderPfp = users[socket.id].pfp;
    }
    // Send to everyone
    io.emit('global message', data);
  });

  socket.on('private message', (data) => {
    // Attach current PFP
    if (users[socket.id]) {
      data.senderPfp = users[socket.id].pfp;
    }
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
