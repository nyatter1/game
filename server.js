const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Automatic Redirection Logic
app.get('/', (req, res) => {
    // Check if user is already "logged in" via cookies
    const username = req.cookies.chat_username;

    if (!username) {
        // No account found, send to signup/landing page
        res.redirect('/signup.html');
    } else {
        // Account exists, send to main chat
        res.redirect('/index.html');
    }
});

// Fallback for any other routes
app.get('*', (req, res) => {
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
