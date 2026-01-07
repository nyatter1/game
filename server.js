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

// Fallback for root to public/index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Explicit route for chat.html if it's inside public/
app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Store active users in memory (Key: Socket ID, Value: User Profile)
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('User attempting connection:', socket.id);

    // Immediately send the current user list to the newcomer
    socket.emit('user_list_update', Array.from(activeUsers.values()));

    // When a user joins, store their profile info
    socket.on('join', (userData) => {
        // Validation to prevent empty users
        if (!userData || !userData.username) return;

        activeUsers.set(socket.id, {
            ...userData,
            socketId: socket.id,
            lastSeen: Date.now()
        });
        
        // Broadcast updated user list to EVERYONE (including the sender)
        const updatedList = Array.from(activeUsers.values());
        io.emit('user_list_update', updatedList);
        
        // Notify others
        socket.broadcast.emit('system_message', `✨ ${userData.username} joined the lounge.`);
        console.log(`User ${userData.username} registered with ID ${socket.id}`);
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
            console.log(`${user.username} disconnected`);
            activeUsers.delete(socket.id);
            // Update everyone that the user is gone
            io.emit('user_list_update', Array.from(activeUsers.values()));
        }
    });

    // Error handling
    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`VIP Lounge Server running on port ${PORT}`);
});
