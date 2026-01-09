const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Keep track of online users: { socketId: username }
const onlineUsers = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle user joining
    socket.on('join', (username) => {
        onlineUsers[socket.id] = username;
        
        // Broadcast the updated list of online usernames to everyone
        const onlineNames = Object.values(onlineUsers);
        io.emit('user_update', onlineNames);
        
        // Notify the room
        socket.broadcast.emit('system_message', `${username.toUpperCase()} HAS ENTERED THE CIRCLE`);
    });

    // Handle chat messages
    socket.on('chat_message', (data) => {
        const username = onlineUsers[socket.id] || 'Guest';
        const now = new Date();
        const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                           now.getMinutes().toString().padStart(2, '0');

        const messagePayload = {
            user: username,
            text: data.text,
            time: timeString
        };

        // Send message to everyone including sender
        io.emit('chat_message', messagePayload);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const username = onlineUsers[socket.id];
        if (username) {
            delete onlineUsers[socket.id];
            const onlineNames = Object.values(onlineUsers);
            io.emit('user_update', onlineNames);
            io.emit('system_message', `${username.toUpperCase()} HAS LEFT THE CIRCLE`);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Lumière server running on port ${PORT}`);
});
