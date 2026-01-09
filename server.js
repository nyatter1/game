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

app.use(express.static(path.join(__dirname, 'public')));

// State Management
const onlineUsers = {};

/**
 * INTERNAL COMMAND HANDLER
 * Replaces the external ./commands module
 */
function handleCommand(text, socket, io) {
    const args = text.slice(1).split(' ');
    const command = args[0].toLowerCase();

    switch (command) {
        case 'bank':
            // Emit bank data directly to the requester
            socket.emit('bank_display', {
                username: socket.username,
                gold: 12540, // Mock data - would pull from DB in production
                rubies: 42,
                level: 12,
                pfp: "https://th.bing.com/th/id/OIP.Mx3MRciD-058jG_oPtm3FQAAAA?pid=ImgDet&rs=1"
            });
            return { success: true, message: "Action Complete" };

        case 'clear':
            return { success: true, message: "Chat cleared locally" };

        default:
            return { success: false, message: "Unknown command" };
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function broadcastUserUpdate() {
    const onlineNames = Array.from(new Set(Object.values(onlineUsers)));
    io.emit('user_update', onlineNames);
}

io.on('connection', (socket) => {
    const currentOnlineNames = Array.from(new Set(Object.values(onlineUsers)));
    socket.emit('user_update', currentOnlineNames);

    socket.on('join', (username) => {
        if (!username) return;
        socket.username = username;
        onlineUsers[socket.id] = username;
        broadcastUserUpdate();
        socket.broadcast.emit('system_message', `${username.toUpperCase()} HAS ENTERED THE CIRCLE`);
    });

    socket.on('chat_message', (data) => {
        if (!socket.username || !data.text) return;

        // Check if the message is a command
        if (data.text.startsWith('/')) {
            const result = handleCommand(data.text, socket, io);
            socket.emit('command_response', result);
            return;
        }

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

    socket.on('disconnect', () => {
        const username = onlineUsers[socket.id];
        if (username) {
            delete onlineUsers[socket.id];
            broadcastUserUpdate();
            io.emit('system_message', `${username.toUpperCase()} HAS LEFT THE CIRCLE`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`-------------------------------------------`);
    console.log(`Lumière Server: Active on Port ${PORT}`);
    console.log(`Internal Command Engine: Initialized`);
    console.log(`-------------------------------------------`);
});
