const express = require('express');
const path = require('path');
const app = express();

// Use the PORT provided by Render, or default to 3000
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Always serve index.html for any request (Single Page Application support)
// Since index.html is inside /public, we point the join path there
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Chatlaxy server is running on port ${PORT}`);
});
