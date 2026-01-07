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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory state (resets on server restart)
let messages = [];
let onlineUsers = {}; // Key: socket.id, Value: user data object

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a user joins
    socket.on('join', (userData) => {
        // Assign Ranks
        if (userData.username.toLowerCase() === 'dev') {
            userData.rank = 'Developer';
        } else {
            userData.rank = 'VIP';
        }

        // Add to online tracking
        onlineUsers[socket.id] = userData;
        
        // Broadcast updated user list to everyone
        io.emit('user_list_update', Object.values(onlineUsers));
        
        // Send history to the joiner
        socket.emit('history', messages);
        
        // System message
        io.emit('system_message', `${userData.username} (${userData.rank}) joined the chat`);
    });

    // Handle new chat messages
    socket.on('chat_message', (msg) => {
        // 1. Check for /give command (Developer only)
        if (msg.text && msg.text.startsWith('/give ')) {
            const sender = onlineUsers[socket.id];
            
            if (sender && sender.username.toLowerCase() === 'dev') {
                const parts = msg.text.split(' '); // /give {user} {type} {amount}
                if (parts.length === 4) {
                    const targetName = parts[1].toLowerCase();
                    const type = parts[2].toLowerCase(); // gold or rubies
                    const amount = parseInt(parts[3]);

                    if (!isNaN(amount)) {
                        // Find target socket
                        const targetSocketId = Object.keys(onlineUsers).find(
                            id => onlineUsers[id].username.toLowerCase() === targetName
                        );

                        if (targetSocketId) {
                            // Update the target's data on the server
                            if (type === 'gold') onlineUsers[targetSocketId].gold += amount;
                            if (type === 'rubies' || type === 'ruby') onlineUsers[targetSocketId].rubies += amount;

                            // Send private update to the target user
                            io.to(targetSocketId).emit('force_update', onlineUsers[targetSocketId]);
                            
                            // Broadcast the event
                            io.emit('system_message', `DEV granted ${amount} ${type} to ${targetName}!`);
                            return; // Don't post the command as a chat message
                        }
                    }
                }
            }
        }

        // Standard message processing
        const messageObj = {
            ...msg,
            rank: onlineUsers[socket.id]?.rank || 'VIP',
            id: Date.now() + Math.random(),
            timestamp: new Date()
        };
        
        messages.push(messageObj);
        if (messages.length > 100) messages.shift();
        
        io.emit('chat_message', messageObj);
    });

    // Sync state changes from client (e.g., gambling results)
    socket.on('update_user', (userData) => {
        if (onlineUsers[socket.id]) {
            onlineUsers[socket.id] = { ...onlineUsers[socket.id], ...userData };
            io.emit('user_list_update', Object.values(onlineUsers));
        }
    });

    socket.on('disconnect', () => {
        if (onlineUsers[socket.id]) {
            const username = onlineUsers[socket.id].username;
            delete onlineUsers[socket.id];
            io.emit('user_list_update', Object.values(onlineUsers));
            console.log('User disconnected:', username);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
