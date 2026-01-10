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

// In-memory store for active connections
// Key: socket.id, Value: userProfile object
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    /**
     * USER REGISTRATION / UPDATE
     * Triggered when a user logs in, changes status, or updates their profile
     */
    socket.on('register user', (profile) => {
        // Store user data associated with this socket
        activeUsers.set(socket.id, {
            ...profile,
            socketId: socket.id,
            lastSeen: Date.now()
        });
        
        // Broadcast the updated online list to everyone
        broadcastUserList();
    });

    /**
     * CHAT MESSAGING
     */
    socket.on('global message', (msg) => {
        // Broadcast message to all connected clients
        io.emit('global message', msg);
    });

    /**
     * DEVELOPER ADMINISTRATIVE ACTIONS
     * Allows the Developer to force-update other users' ranks or profiles
     */
    socket.on('admin update user', (updatedUser) => {
        // Check if the sender is actually a developer (Server-side validation)
        const sender = activeUsers.get(socket.id);
        if (sender && sender.rank === 'DEVELOPER') {
            
            // Find if the target user is currently online to notify them
            for (let [id, user] of activeUsers.entries()) {
                if (user.username === updatedUser.username) {
                    // Update our internal tracking
                    const newProfile = { ...user, ...updatedUser };
                    activeUsers.set(id, newProfile);
                    
                    // Tell that specific client to update their local storage/session
                    io.to(id).emit('force update profile', newProfile);
                }
            }

            // Update the list for everyone
            broadcastUserList();
        }
    });

    /**
     * DISCONNECT
     */
    socket.on('disconnect', () => {
        activeUsers.delete(socket.id);
        broadcastUserList();
        console.log(`User disconnected: ${socket.id}`);
    });

    /**
     * HELPER: Broadcast unique users to all clients
     */
    function broadcastUserList() {
        // Convert Map to Array and filter for unique usernames (in case of multi-tabs)
        const usersArray = Array.from(activeUsers.values());
        const uniqueUsers = [];
        const seenNames = new Set();

        for (const u of usersArray) {
            if (!seenNames.has(u.username)) {
                uniqueUsers.push(u);
                seenNames.add(u.username);
            }
        }

        io.emit('update user list', uniqueUsers);
    }
});

server.listen(PORT, () => {
    console.log(`Chatlaxy Elite Server running on port ${PORT}`);
});
