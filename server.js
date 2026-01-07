const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Setup terminal interface for server-side "Nuclear" commands
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
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
 * Utility to perform a Global Factory Reset
 * This clears the server database AND tells all clients to clear their cache/localStorage
 */
const triggerGlobalNuke = () => {
    console.log("!!! GLOBAL FACTORY RESET INITIATED !!!");
    
    // 1. Wipe Server Files
    saveData(USERS_FILE, {});
    saveData(CHAT_FILE, []);
    
    // 2. Clear Online State
    onlineUsers = {};

    // 3. Signal EVERYONE to clear their local browser storage/cache and reload
    io.emit('system_message', "⚠️ GLOBAL WIPE: The site is being reset. All data cleared.");
    io.emit('force_wipe_client'); 
};

// Console Command: Type 'nuke' in your terminal to clear everything for everyone
rl.on('line', (line) => {
    if (line.trim().toLowerCase() === 'nuke') {
        triggerGlobalNuke();
        console.log(">> Global wipe complete. All users reset.");
    }
});

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
        
        let persistentUser = users[username] || userData;
        
        if (username === 'dev') {
            persistentUser.rank = 'Developer';
        } else if (username === 'rawrer') {
            persistentUser.rank = 'Owner';
        } else if (username === 'empty') {
            persistentUser.rank = 'Site-helper';
        } else if (!persistentUser.rank) {
            persistentUser.rank = 'VIP';
        }

        onlineUsers[socket.id] = persistentUser;
        io.emit('user_list_update', Object.values(onlineUsers));
        
        const history = readData(CHAT_FILE);
        socket.emit('history', history);
        
        io.emit('system_message', `${persistentUser.username} (${persistentUser.rank}) joined the chat`);
    });

    // Handle new chat messages
    socket.on('chat_message', (msg) => {
        const sender = onlineUsers[socket.id];
        if (!sender) return;

        if (msg.text && msg.text.startsWith('/')) {
            const parts = msg.text.split(' ');
            const cmd = parts[0].toLowerCase();

            // /wipe command for Dev in chat
            if (cmd === '/wipe' && sender.username.toLowerCase() === 'dev') {
                triggerGlobalNuke();
                return;
            }

            // /give {user} {g/r} {amount}
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
                            if (users[targetName]) {
                                if (isGold) users[targetName].gold += amount;
                                else users[targetName].rubies += amount;
                                saveData(USERS_FILE, users);
                            }

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

    socket.on('update_user', (userData) => {
        if (onlineUsers[socket.id]) {
            const username = onlineUsers[socket.id].username.toLowerCase();
            onlineUsers[socket.id] = { ...onlineUsers[socket.id], ...userData };
            
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
