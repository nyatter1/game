const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { handleCommand } = require('./commands');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Keep track of online users: { socketId: username }
const onlineUsers = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * HELPER: Broadcast updated user list
 * We ensure we send the array of unique usernames to EVERYONE
 */
function broadcastUserUpdate() {
    const onlineNames = Array.from(new Set(Object.values(onlineUsers)));
    io.emit('user_update', onlineNames);
}

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // When a user connects, we immediately send them the current online list
    // so they aren't looking at an empty sidebar while waiting for the next update
    const currentOnlineNames = Array.from(new Set(Object.values(onlineUsers)));
    socket.emit('user_update', currentOnlineNames);

    // Handle user joining
    socket.on('join', (username) => {
        if (!username) return;
        
        socket.username = username;
        onlineUsers[socket.id] = username;
        
        // Force a global refresh for everyone
        broadcastUserUpdate();
        
        // System notification
        socket.broadcast.emit('system_message', `${username.toUpperCase()} HAS ENTERED THE CIRCLE`);
    });

    // Handle chat messages and commands
    socket.on('chat_message', (data) => {
        if (!socket.username || !data.text) return;

        // Check if the message is a command
        if (data.text.startsWith('/')) {
            const result = handleCommand(data.text, socket, io);
            socket.emit('command_response', result);
            return;
        }

        // Regular message processing
        const messagePayload = {
            user: socket.username,
            text: data.text,
            time: new Date().toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            })
        };

        io.emit('chat_message', messagePayload);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const username = onlineUsers[socket.id];
        if (username) {
            delete onlineUsers[socket.id];
            // Immediately inform others that this user left
            broadcastUserUpdate();
            io.emit('system_message', `${username.toUpperCase()} HAS LEFT THE CIRCLE`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`-------------------------------------------`);
    console.log(`Lumière Server: Active on Port ${PORT}`);
    console.log(`-------------------------------------------`);
});
