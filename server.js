const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse cookies and serve static files from the 'public' directory
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Root Route Logic
 * 1. Checks for a 'chat_username' cookie.
 * 2. If missing, redirects to signup.html (your registration/login page).
 * 3. If present, redirects to index.html (the main chat hub).
 */
app.get('/', (req, res) => {
    const username = req.cookies.chat_username;

    if (!username) {
        // User hasn't registered or logged in yet
        res.redirect('/signup.html');
    } else {
        // User is recognized, take them to the chat interface
        res.redirect('/chat.html');
    }
});

/**
 * Route: Signup / Auth Page
 * Explicitly serve the registration file.
 */
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

/**
 * Route: Main Chat
 * Explicitly serve the chat file.
 */
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

/**
 * Global Fallback
 * Redirects any unknown paths back to the root logic.
 */
app.get('*', (req, res) => {
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`
🚀 ChatHub Server is live!
🔗 Local: http://localhost:${PORT}
📂 Serving from: ${path.join(__dirname, 'public')}
    `);
});
