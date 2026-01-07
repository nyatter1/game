const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for root to public/index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Explicit route for chat.html if it's inside public/
app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Store active users in memory
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a user joins, store their profile info
    socket.on('join', (userData) => {
        activeUsers.set(socket.id, {
            ...userData,
            id: socket.id
        });
        
        // Broadcast updated user list to everyone
        io.emit('user_list_update', Array.from(activeUsers.values()));
        
        // Notify others
        socket.broadcast.emit('system_message', `✨ ${userData.username} joined the lounge.`);
    });

    // Handle chat messages
    socket.on('chat_message', (msgData) => {
        // Broadcast message to all connected clients
        io.emit('chat_message', {
            ...msgData,
            timestamp: new Date().toISOString()
        });
    });

    // Handle dice rolls specifically to sync results
    socket.on('dice_roll', (diceData) => {
        io.emit('dice_result', {
            ...diceData,
            timestamp: new Date().toISOString()
        });
    });

    // Handle disconnects
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            activeUsers.delete(socket.id);
            io.emit('user_list_update', Array.from(activeUsers.values()));
            console.log(`${user.username} disconnected`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`VIP Lounge Server running on port ${PORT}`);
});
