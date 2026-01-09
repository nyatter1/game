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

// --- STATE MANAGEMENT ---
const onlineUsers = {};

// Detailed User Data Store
// Structure: { username: { gold, rubies, pfp, banner, bio, rank, role } }
const userStore = {}; 

// Default Profile Constants
const DEFAULT_PFP = "https://th.bing.com/th/id/OIP.Mx3MRciD-058jG_oPtm3FQAAAA?pid=ImgDet&rs=1";
const DEFAULT_BANNER = "https://images.unsplash.com/photo-1533134486753-c833f0ed4866?q=80&w=2070&auto=format&fit=crop";

// Helper: Get or Create User
function getUser(username) {
    if (!userStore[username]) {
        // Determine Rank/Role based on username
        const isDev = username.toLowerCase() === 'developer';
        
        userStore[username] = {
            username: username,
            gold: 1000,
            rubies: 100,
            pfp: DEFAULT_PFP,
            banner: DEFAULT_BANNER,
            bio: isDev ? "The Architect of the Circle." : "A traveler in the lounge.",
            rank: isDev ? "DEV" : "MEMBER",
            role: isDev ? "developer" : "user",
            joinedAt: new Date().toISOString()
        };
    }
    return userStore[username];
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/**
 * COMMAND HANDLER
 */
function handleCommand(text, socket, io) {
    const args = text.slice(1).trim().split(/\s+/);
    const command = args[0].toLowerCase();
    const username = socket.username;
    const user = getUser(username);
    const isRigged = user.role === 'developer';

    switch (command) {
        case 'bank':
            socket.emit('bank_display', { ...user, level: calculateLevel(user) });
            return { success: true, message: "Action Complete" };

        case 'dice': {
            const typeInput = args[1] ? args[1].toLowerCase() : null;
            let amount = parseInt(args[2]);

            if (!typeInput || isNaN(amount)) return { success: false, message: "Usage: /dice {g/r} {amount}" };

            const isGold = typeInput.startsWith('g');
            const currency = isGold ? 'gold' : 'rubies';
            const currencyIcon = isGold ? '🪙' : '💎';

            if (amount <= 0) return { success: false, message: "Amount must be positive" };
            if (user[currency] < amount) return { success: false, message: `Insufficient ${currency}` };

            // --- GAME LOGIC (RIGGED FOR DEV) ---
            let roll, isWin;
            
            if (isRigged) {
                // 99% chance to win for Developer
                if (Math.random() < 0.99) {
                    roll = 6;
                    isWin = true;
                } else {
                    roll = 1; // The 1% failure
                    isWin = false;
                }
            } else {
                // Normal Logic (1/6 chance)
                roll = Math.floor(Math.random() * 6) + 1;
                isWin = roll === 6;
            }
            
            const face = DICE_FACES[roll - 1];

            if (isWin) {
                user[currency] += amount;
                io.emit('chat_message', {
                    user: 'System',
                    text: `<span class="${isRigged ? 'text-purple-400' : 'text-emerald-400'} font-bold">${username}</span> ROLLED A <span class="text-2xl">${face}</span>! WON <span class="text-amber-200">${amount.toLocaleString()} ${currencyIcon}</span>`
                });
                return { success: true, message: `You won ${amount} ${currency}!` };
            } else {
                user[currency] -= amount;
                io.emit('chat_message', {
                    user: 'System',
                    text: `<span class="text-zinc-500 font-bold">${username}</span> ROLLED A <span class="text-2xl">${face}</span>. LOST <span class="text-red-400">${amount.toLocaleString()} ${currencyIcon}</span>`
                });
                return { success: false, message: `You lost ${amount} ${currency}` };
            }
        }

        case 'allin': {
            const typeInput = args[1] ? args[1].toLowerCase() : null;
            if (!typeInput) return { success: false, message: "Usage: /allin {g/r}" };

            const isGold = typeInput.startsWith('g');
            const currency = isGold ? 'gold' : 'rubies';
            const currencyIcon = isGold ? '🪙' : '💎';
            const betAmount = user[currency];

            if (betAmount <= 0) return { success: false, message: `You have no ${currency} to bet!` };

            // --- ALL IN LOGIC (RIGGED FOR DEV) ---
            let isWin;
            if (isRigged) {
                isWin = Math.random() < 0.99; // 99% Win Rate
            } else {
                isWin = Math.random() < 0.25; // 25% Win Rate
            }

            if (isWin) {
                const multiplier = Math.floor(Math.random() * 10) + 1; // x1 to x10
                const winAmount = betAmount * multiplier;
                user[currency] = winAmount;

                io.emit('chat_message', {
                    user: 'System',
                    text: `<div class="space-y-1 text-center"><div class="text-amber-300 font-bold text-lg animate-pulse">🎰 JACKPOT ALERT 🎰</div><div>${username} WENT ALL IN AND HIT <span class="text-xl font-bold">x${multiplier}</span>!</div><div class="text-xs text-zinc-400">BALANCE: ${winAmount.toLocaleString()} ${currencyIcon}</div></div>`
                });
                return { success: true, message: `ALL IN SUCCESS! x${multiplier}` };
            } else {
                user[currency] = 0;
                io.emit('chat_message', {
                    user: 'System',
                    text: `<span class="text-zinc-500">${username} went ALL IN on ${currencyIcon} and <span class="text-red-500 font-bold">LOST IT ALL</span>. 📉</span>`
                });
                return { success: false, message: "You lost it all..." };
            }
        }

        case 'clear':
            return { success: true, message: "Chat cleared locally" };

        default:
            return { success: false, message: "Unknown command" };
    }
}

function calculateLevel(user) {
    return Math.floor((user.gold + user.rubies * 10) / 1000);
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function broadcastUserUpdate() {
    // Send full user objects for the sidebar, not just strings
    const onlineData = Object.keys(onlineUsers).map(socketId => {
        const username = onlineUsers[socketId];
        return getUser(username);
    });
    // Deduplicate by username
    const uniqueUsers = Array.from(new Map(onlineData.map(item => [item.username, item])).values());
    io.emit('user_update', uniqueUsers);
}

io.on('connection', (socket) => {
    socket.on('join', (username) => {
        if (!username) return;
        socket.username = username;
        onlineUsers[socket.id] = username;
        
        // Ensure profile exists
        getUser(username);

        broadcastUserUpdate();
        socket.broadcast.emit('system_message', `${username.toUpperCase()} HAS ENTERED THE CIRCLE`);
    });

    // Get Profile Data (Viewer)
    socket.on('get_profile', (targetUsername) => {
        const profile = getUser(targetUsername);
        const level = calculateLevel(profile);
        socket.emit('profile_data', { ...profile, level });
    });

    // Update Profile (Editor)
    socket.on('update_profile', (data) => {
        if (!socket.username) return;
        const user = getUser(socket.username);
        
        // Update allowed fields
        if (data.pfp) user.pfp = data.pfp;
        if (data.banner) user.banner = data.banner;
        if (data.bio) user.bio = data.bio;
        
        // If username change is requested (simple implementation)
        // Note: In a real app, you'd need ID checks, existing name checks etc.
        // We will skip username changing for stability in this demo to keep socket ID consistent
        
        socket.emit('command_response', { success: true, message: "Profile Updated" });
        broadcastUserUpdate(); // Refresh PFP/Data for everyone
    });

    socket.on('chat_message', (data) => {
        if (!socket.username || !data.text) return;

        if (data.text.startsWith('/')) {
            const result = handleCommand(data.text, socket, io);
            socket.emit('command_response', result);
            return;
        }

        const user = getUser(socket.username);
        const messagePayload = {
            user: socket.username,
            pfp: user.pfp, // Send PFP with every message
            rank: user.rank,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
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
    console.log(`Lumière Server: Active on Port ${PORT}`);
});
