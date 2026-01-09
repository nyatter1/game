/**
 * server.js
 * Real-time backend for Elite Circle Luxury Chat.
 * * TO RUN THIS SERVER:
 * 1. Ensure you have a package.json with these dependencies:
 * "dependencies": {
 * "express": "^4.18.2",
 * "socket.io": "^4.7.2",
 * "cors": "^2.8.5"
 * }
 * 2. Run: npm install
 * 3. Run: npm start (ensure scripts.start is "node server.js")
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS configured for web clients
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust this to your specific domain in production
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
// Make sure your frontend files (index.html, etc.) are inside a folder named 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- In-Memory State ---
let messages = [
    { 
        id: 1, 
        senderName: 'System', 
        text: 'Secure connection established. Welcome to the Elite Circle.', 
        time: new Date().toLocaleTimeString(), 
        isSystem: true 
    }
];
let onlineUsers = new Map(); // Key: socket.id, Value: user object

// --- Socket.io Logic ---
io.on('connection', (socket) => {
    console.log(`New connection established: ${socket.id}`);

    // When a user joins the session
    socket.on('join', (userData) => {
        // Store user info associated with this specific socket
        onlineUsers.set(socket.id, {
            ...userData,
            socketId: socket.id,
            joinedAt: new Date().toISOString()
        });

        // Send existing chat history to the newly connected user
        socket.emit('chat_history', messages);

        // Broadcast the updated online user list to all connected clients
        io.emit('user_list', Array.from(onlineUsers.values()));
        
        console.log(`${userData.name || 'Anonymous'} joined. Total active: ${onlineUsers.size}`);
    });

    // Handle profile updates (name changes, avatar swaps)
    socket.on('update_profile', (updatedData) => {
        if (onlineUsers.has(socket.id)) {
            const currentUser = onlineUsers.get(socket.id);
            onlineUsers.set(socket.id, { ...currentUser, ...updatedData });
            io.emit('user_list', Array.from(onlineUsers.values()));
        }
    });

    // Handle incoming chat messages
    socket.on('send_message', (msgData) => {
        const message = {
            ...msgData,
            id: Date.now(),
            timestamp: new Date().toISOString()
        };
        
        messages.push(message);
        
        // Keep memory usage low: limit history to last 100 messages
        if (messages.length > 100) {
            messages.shift();
        }

        // Send the message to everyone (including sender)
        io.emit('new_message', message);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        if (onlineUsers.has(socket.id)) {
            const user = onlineUsers.get(socket.id);
            onlineUsers.delete(socket.id);
            
            // Update the user list for remaining clients
            io.emit('user_list', Array.from(onlineUsers.values()));
            console.log(`${user.name || 'User'} left (${reason}). Remaining: ${onlineUsers.size}`);
        }
    });
});

// --- API Routes ---

// Health check for deployment monitoring
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'active', 
        usersOnline: onlineUsers.size,
        memoryUsage: process.memoryUsage().rss
    });
});

// Fallback: Serve index.html for any unknown routes (supports SPA routing)
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(404).send("Front-end 'public/index.html' not found. Please ensure your frontend files are in the 'public' folder.");
        }
    });
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`
    =========================================
    ELITE CIRCLE BACKEND RUNNING
    Port: ${PORT}
    Status: Online
    Ready for npm start connections.
    =========================================
    `);
});
