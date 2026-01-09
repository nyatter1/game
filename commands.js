/**
 * Lumière Command Registry
 * This file handles logic for commands executed via the chat interface.
 * Commands are triggered by a leading "/" in the chat input.
 */

const commands = {
    /**
     * Example Command Structure:
     * "command_name": {
     * description: "What the command does",
     * execute: (socket, io, args) => {
     * // Logic here
     * }
     * }
     */
};

/**
 * Handles incoming command strings from the client.
 * @param {string} input - The full raw input (e.g., "/help args")
 * @param {Object} socket - The current user's socket session
 * @param {Object} io - The global Socket.io instance
 */
function handleCommand(input, socket, io) {
    const parts = input.slice(1).trim().split(/ +/);
    const commandName = parts.shift().toLowerCase();
    const args = parts;

    if (commands[commandName]) {
        try {
            commands[commandName].execute(socket, io, args);
            return { success: true, message: "ACTION COMPLETE" };
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
