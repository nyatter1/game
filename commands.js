/**
 * Lumière Command Registry
 * Handles logic for commands executed via the chat interface.
 */

// Simple in-memory storage for player stats
// Default: 100 Gold, 10 Rubies, Level 1
const playerStats = {};

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

            // Broadcast to everyone to show the "Bank Menu" overlay
            io.emit('bank_display', {
                username: username,
                gold: stats.gold,
                rubies: stats.rubies,
                level: stats.level,
                pfp: stats.pfp
            });

            return { success: true, message: "WEALTH REVEALED" };
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
