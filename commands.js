/**
 * Lumière Command Registry
 * Handles logic for commands executed via the chat interface.
 */

// Simple in-memory storage for player stats
// Default: 100 Gold, 10 Rubies, Level 1
let playerStats = {};

const commands = {
    "bank": {
        description: "Display your status and wealth to the circle",
        execute: (socket, io, args) => {
            const username = socket.username || "Guest";
            
            // Initialize stats if first time using a command
            if (!playerStats[username]) {
                playerStats[username] = {
                    gold: 100,
                    rubies: 10,
                    level: 1,
                    pfp: "https://th.bing.com/th/id/OIP.Mx3MRciD-058jG_oPtm3FQAAAA?pid=ImgDet&rs=1"
                };
            }

            const stats = playerStats[username];

            // Trigger the small centered UI overlay for immediate impact
            io.emit('bank_display', {
                username: username,
                gold: stats.gold,
                rubies: stats.rubies,
                level: stats.level,
                pfp: stats.pfp
            });

            // Send a system message to the chat so it persists in the history (visible to all)
            io.emit('system_message', `VAULT ACCESS: ${username.toUpperCase()} | LVL ${stats.level} | ${stats.gold} GOLD | ${stats.rubies} RUBIES`);

            return { success: true, message: "ACTION COMPLETE" };
        }
    },
    "wipe": {
        description: "Delete all account data and reset the circle",
        execute: (socket, io, args) => {
            // Clear the server-side stats memory
            playerStats = {};
            
            // Broadcast a system-wide alert that a wipe has occurred
            io.emit('system_message', "!! SYSTEM WIPE INITIATED: ALL ACCOUNTS AND STATS HAVE BEEN DELETED !!");
            
            // Note: This only clears server-side memory for current session stats.
            // Client-side localStorage (passwords/accounts) would need a client-side trigger.
            io.emit('force_logout_all'); 

            return { success: true, message: "ACTION COMPLETE" };
        }
    }
};

/**
 * Handles incoming command strings from the client.
 * @param {string} input - The full raw input (e.g., "/bank")
 * @param {Object} socket - The current user's socket session
 * @param {Object} io - The global Socket.io instance
 */
function handleCommand(input, socket, io) {
    const parts = input.slice(1).trim().split(/ +/);
    const commandName = parts.shift().toLowerCase();
    const args = parts;

    if (commands[commandName]) {
        try {
            return commands[commandName].execute(socket, io, args);
        } catch (error) {
            console.error(`Error executing /${commandName}:`, error);
            return { success: false, message: "ERROR EXECUTING COMMAND" };
        }
    }

    return { success: false, message: "INVALID COMMAND" };
}

module.exports = {
    handleCommand
};
