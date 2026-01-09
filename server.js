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
const userBalances = {}; // { username: { gold: number, rubies: number } }

// Helper: Get or Initialize User Balance
function getBalance(username) {
    if (!userBalances[username]) {
        userBalances[username] = { gold: 1000, rubies: 100 };
    }
    return userBalances[username];
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/**
 * INTERNAL COMMAND HANDLER
 */
function handleCommand(text, socket, io) {
    const args = text.slice(1).trim().split(/\s+/);
    const command = args[0].toLowerCase();
    const username = socket.username;
    const balance = getBalance(username);

    switch (command) {
        case 'bank':
            socket.emit('bank_display', {
                username: username,
                gold: balance.gold,
                rubies: balance.rubies,
                level: Math.floor((balance.gold + balance.rubies * 10) / 1000), // Dynamic level based on wealth
                pfp: "https://th.bing.com/th/id/OIP.Mx3MRciD-058jG_oPtm3FQAAAA?pid=ImgDet&rs=1"
            });
            return { success: true, message: "Action Complete" };

        case 'dice': {
            // Usage: /dice {r/g} {amount}
            const typeInput = args[1] ? args[1].toLowerCase() : null;
            let amount = parseInt(args[2]);

            if (!typeInput || isNaN(amount)) {
                return { success: false, message: "Usage: /dice {gold/rubies} {amount}" };
            }

            const isGold = typeInput.startsWith('g');
            const currency = isGold ? 'gold' : 'rubies';
            const currencyIcon = isGold ? '🪙' : '💎';

            if (amount <= 0) return { success: false, message: "Amount must be positive" };
            if (balance[currency] < amount) return { success: false, message: `Insufficient ${currency}` };

            // Game Logic
            const roll = Math.floor(Math.random() * 6) + 1; // 1-6
            const isWin = roll === 6;
            const face = DICE_FACES[roll - 1];

            if (isWin) {
                // User asked to double the bet. Usually means they get their bet back + equal amount profit.
                // Balance is not deducted yet, so we just add the amount.
                balance[currency] += amount;
                io.emit('chat_message', {
                    user: 'System',
                    text: `<span class="text-emerald-400 font-bold">${username}</span> ROLLED A <span class="text-2xl">${face}</span>! WON <span class="text-amber-200">${amount.toLocaleString()} ${currencyIcon}</span>`
                });
                return { success: true, message: `You won ${amount} ${currency}!` };
            } else {
                balance[currency] -= amount;
                io.emit('chat_message', {
                    user: 'System',
                    text: `<span class="text-zinc-500 font-bold">${username}</span> ROLLED A <span class="text-2xl">${face}</span>. LOST <span class="text-red-400">${amount.toLocaleString()} ${currencyIcon}</span>`
                });
                return { success: false, message: `You lost ${amount} ${currency}` };
            }
        }

        case 'allin': {
            // Usage: /allin {r/g}
            const typeInput = args[1] ? args[1].toLowerCase() : null;
            
            if (!typeInput) {
                return { success: false, message: "Usage: /allin {gold/rubies}" };
            }

            const isGold = typeInput.startsWith('g');
            const currency = isGold ? 'gold' : 'rubies';
            const currencyIcon = isGold ? '🪙' : '💎';
            const betAmount = balance[currency];

            if (betAmount <= 0) return { success: false, message: `You have no ${currency} to bet!` };

            // Game Logic: 25% chance to win
            const isWin = Math.random() < 0.25;

            if (isWin) {
                const multiplier = Math.floor(Math.random() * 10) + 1; // x1 to x10
                const winAmount = betAmount * multiplier;
                
                // Logic: "x that number you betted by that number"
                // If I bet 1000 and get x10, I now have 10,000.
                balance[currency] = winAmount;

                io.emit('chat_message', {
                    user: 'System',
                    text: `<div class="space-y-1 text-center"><div class="text-amber-300 font-bold text-lg animate-pulse">🎰 JACKPOT ALERT 🎰</div><div>${username} WENT ALL IN AND HIT <span class="text-xl font-bold">x${multiplier}</span>!</div><div class="text-xs text-zinc-400">BALANCE: ${winAmount.toLocaleString()} ${currencyIcon}</div></div>`
                });
                return { success: true, message: `ALL IN SUCCESS! x${multiplier}` };
            } else {
                balance[currency] = 0;
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
        
        // Ensure user has a balance on join
        getBalance(username);

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
