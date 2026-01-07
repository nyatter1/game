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

// Serve static files (your chat_app.html)
app.use(express.static(path.join(__dirname, 'public')));

// Store simple in-memory state (Note: Render spins down on free tier, clearing this)
let messages = [];
let users = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a user joins
    socket.on('join', (userData) => {
        users[socket.id] = userData;
        // Send existing message history to the new user
        socket.emit('history', messages);
        // Notify others
        socket.broadcast.emit('system_message', `${userData.username} joined the chat`);
    });

    // Handle new chat messages
    socket.on('chat_message', (msg) => {
        const messageObj = {
            ...msg,
            id: Date.now() + Math.random(),
            timestamp: new Date()
        };
        messages.push(messageObj);
        if (messages.length > 100) messages.shift(); // Keep last 100
        
        // Broadcast to everyone
        io.emit('chat_message', messageObj);
    });

    // Handle profile updates or currency sync
    socket.on('update_user', (userData) => {
        users[socket.id] = userData;
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            console.log('User disconnected:', users[socket.id].username);
            delete users[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
