/**
 * Aura | The Sovereign Hub - Node.js Server
 * * This server handles static file delivery for index.html and chat.html.
 * It is designed to be lightweight, serving the frontend while the
 * client-side code manages real-time state via Firebase.
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing and logging
app.use(express.json());

// Serve static assets (CSS, Images, JS) if you split them later
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Route: Root
 * Delivers the initialization wizard / landing page.
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Route: Chat Hub
 * Delivers the main Aura social interface.
 */
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

/**
 * Error Handling for 404s
 * Maintains the aesthetic by redirecting unknown paths to the hub.
 */
app.use((req, res) => {
    res.status(404).redirect('/');
});

/**
 * Server Activation
 */
app.listen(PORT, () => {
    console.log(`
    -------------------------------------------
    AURA | THE SOVEREIGN HUB
    Status: Online
    Port: ${PORT}
    Environment: Production-Stable
    -------------------------------------------
    `);
});
