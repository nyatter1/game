const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Aura | Sovereign Network Server
 * * This server handles the delivery of the minimalist Aura interface.
 * It serves the landing page (login), user setup, and the encrypted chat hub.
 */

// Middleware to serve static files if you have separate assets
app.use(express.static(path.join(__dirname, 'public')));

// Route: Entry Point (Login/Landing)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route: Identity Setup (The Wizard)
app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'setup.html'));
});

// Route: Unified Chat Hub
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

// Fallback: Redirect unknown routes to home
app.get('*', (req, res) => {
    res.redirect('/');
});

// Start the transmission
app.listen(PORT, () => {
    console.log(`
    -------------------------------------------
    AURA NETWORK ONLINE
    Protocol: HTTP
    Encryption: UI-Simulated
    Access Point: http://localhost:${PORT}
    -------------------------------------------
    `);
});
