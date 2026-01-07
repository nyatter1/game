const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Data Persistence Paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');

// Ensure data directory and files exist
const initFiles = () => {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({}));
    }
    if (!fs.existsSync(CHAT_FILE)) {
        fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
    }
};
initFiles();

/**
 * Utility to read JSON files
 */
const readData = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return filePath === CHAT_FILE ? [] : {};
    }
};

/**
 * Utility to write JSON files
 */
const saveData = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error saving ${filePath}:`, err);
    }
};

// --- Socket.io Logic ---
let onlineUsers = {}; // Key: socket.id, Value: user data object

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a user joins
    socket.on('join', (userData) => {
        const users = readData(USERS_FILE);
        const username = userData.username.toLowerCase();
        
        // Load persistent data if exists, otherwise use what client sent
        let persistentUser = users[username] || userData;
        
        // Assign Ranks
        if (username === 'dev') {
            persistentUser.rank = 'Developer';
        } else if (username === 'rawrer') {
            persistentUser.rank = 'Owner';
        } else if (username === 'empty') {
            persistentUser.rank = 'Site-helper';
        } else if (!persistentUser.rank) {
            persistentUser.rank = 'VIP';
        }

        // Add to online tracking
        onlineUsers[socket.id] = persistentUser;
        
        // Broadcast updated user list to everyone
        io.emit('user_list_update', Object.values(onlineUsers));
        
        // Send persistent history to the joiner
        const history = readData(CHAT_FILE);
        socket.emit('history', history);
        
        // System message
        io.emit('system_message', `${persistentUser.username} (${persistentUser.rank}) joined the chat`);
    });

    // Handle new chat messages
    socket.on('chat_message', (msg) => {
        const sender = onlineUsers[socket.id];
        if (!sender) return;

        // 1. Check for commands
        if (msg.text && msg.text.startsWith('/')) {
            const parts = msg.text.split(' ');
            const cmd = parts[0].toLowerCase();

            // /wipe - Factory Reset (Dev Only)
            if (cmd === '/wipe') {
                if (sender.username.toLowerCase() === 'dev') {
                    console.log("!!! DATABASE WIPE INITIATED BY DEV !!!");
                    
                    // Clear files on server
                    saveData(USERS_FILE, {});
                    saveData(CHAT_FILE, []);
                    
                    // Notify everyone and force them to reload
                    io.emit('system_message', "⚠️ EMERGENCY: SERVER DATABASE WIPED BY DEV. REBOOTING...");
                    io.emit('chat_message', { 
                        type: 'chat', 
                        user: 'SYSTEM', 
                        text: 'Database wiped. All accounts deleted. Application will now reset.', 
                        rank: 'Developer' 
                    });

                    // Force all sockets to disconnect and tell clients to clear local storage via custom event
                    // We broadcast this so the frontend script can execute its wipe logic
                    io.emit('force_wipe_client');
                    
                    // Reset internal state
                    onlineUsers = {};
                    return;
                }
            }

            // /give {user} {g/r} {amount} (Dev Only)
            if (cmd === '/give' && sender.username.toLowerCase() === 'dev') {
                if (parts.length === 4) {
                    const targetName = parts[1].toLowerCase();
                    const typeInput = parts[2].toLowerCase();
                    const amount = parseInt(parts[3]);

                    if (!isNaN(amount)) {
                        const users = readData(USERS_FILE);
                        const isGold = typeInput === 'g' || typeInput === 'gold';
                        const isRuby = typeInput === 'r' || typeInput === 'rubies' || typeInput === 'ruby';
                        const typeLabel = isGold ? 'gold' : 'rubies';

                        if (isGold || isRuby) {
                            // Update Database first
                            if (users[targetName]) {
                                if (isGold) users[targetName].gold += amount;
                                else users[targetName].rubies += amount;
                                saveData(USERS_FILE, users);
                            }

                            // Update online user if they are here
                            const targetSocketId = Object.keys(onlineUsers).find(
                                id => onlineUsers[id].username.toLowerCase() === targetName
                            );

                            if (targetSocketId) {
                                if (isGold) onlineUsers[targetSocketId].gold += amount;
                                else onlineUsers[targetSocketId].rubies += amount;
                                io.to(targetSocketId).emit('force_update', onlineUsers[targetSocketId]);
                            }

                            io.emit('system_message', `DEV granted ${amount} ${typeLabel} to ${targetName}!`);
                            return;
                        }
                    }
                }
            }
        }

        // Standard message processing for non-command chat or handled visuals
        const messageObj = {
            ...msg,
            rank: sender.rank || 'VIP',
            id: Date.now() + Math.random(),
            timestamp: new Date()
        };
        
        const history = readData(CHAT_FILE);
        history.push(messageObj);
        if (history.length > 100) history.shift();
        saveData(CHAT_FILE, history);
        
        io.emit('chat_message', messageObj);
    });

    // Sync state changes from client (e.g., gambling results)
    socket.on('update_user', (userData) => {
        if (onlineUsers[socket.id]) {
            const username = onlineUsers[socket.id].username.toLowerCase();
            onlineUsers[socket.id] = { ...onlineUsers[socket.id], ...userData };
            
            // Save to persistent storage
            const users = readData(USERS_FILE);
            users[username] = onlineUsers[socket.id];
            saveData(USERS_FILE, users);

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
    console.log(`Server running at http://localhost:${PORT}`);
});
