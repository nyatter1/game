const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for active users
// Format: { socketId: { username, age, gender } }
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a user joins the chat after signup/login
    socket.on('join', (userData) => {
        const { username, age, gender } = userData;
        
        // Store user data associated with this socket
        activeUsers.set(socket.id, { username, age, gender });

        // Broadcast to everyone that a new user has joined
        io.emit('userJoined', {
            username,
            onlineCount: activeUsers.size,
            users: Array.from(activeUsers.values())
        });

        console.log(`${username} joined. Total users: ${activeUsers.size}`);
    });

    // Handle incoming chat messages
    socket.on('sendMessage', (messageText) => {
        const user = activeUsers.get(socket.id);
        if (user) {
            const messageData = {
                user: user.username,
                text: messageText,
                timestamp: new Date().toISOString()
            };
            
            // Send message to all connected clients
            io.emit('newMessage', messageData);
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            const username = user.username;
            activeUsers.delete(socket.id);

            // Notify others that the user left
            io.emit('userLeft', {
                username,
                onlineCount: activeUsers.size,
                users: Array.from(activeUsers.values())
            });
            
            console.log(`${username} disconnected. Total users: ${activeUsers.size}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
