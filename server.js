const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for active sessions
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Handle user registration/login
    socket.on('register user', (profile) => {
        const userData = {
            id: socket.id,
            username: profile.username,
            pfp: profile.pfp,
            gender: profile.gender,
            age: profile.age
        };
        
        activeUsers.set(socket.id, userData);
        
        // Broadcast updated user list to everyone
        io.emit('update user list', Array.from(activeUsers.values()));
    });

    // Handle PFP updates during session
    socket.on('update pfp', (newPfp) => {
        const user = activeUsers.get(socket.id);
        if (user) {
            user.pfp = newPfp;
            activeUsers.set(socket.id, user);
            // Sync the updated PFP across all clients' sidebars
            io.emit('update user list', Array.from(activeUsers.values()));
        }
    });

    // Handle Global Messages
    socket.on('global message', (msg) => {
        // Ensure the sender ID is correct from the socket session
        msg.senderId = socket.id;
        io.emit('global message', msg);
    });

    // Handle Private Messages (PMs)
    socket.on('private message', (msg) => {
        const targetSocketId = msg.targetId;
        const senderData = activeUsers.get(socket.id);

        if (targetSocketId && senderData) {
            // Forward the message specifically to the recipient
            io.to(targetSocketId).emit('private message', {
                senderId: socket.id,
                senderName: senderData.username,
                senderPfp: senderData.pfp,
                text: msg.text,
                timestamp: msg.timestamp
            });
        }
    });

    // Handle Disconnection
    socket.on('disconnect', () => {
        activeUsers.delete(socket.id);
        io.emit('update user list', Array.from(activeUsers.values()));
        console.log(`User disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`AuraChat Pro Server running on port ${PORT}`);
});
