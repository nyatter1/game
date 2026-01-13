const express = require('express');
const path = require('path');
const app = express();

// Use the port Render provides, or 3000 locally
const PORT = process.env.PORT || 3000;

// Serve all your frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to send index.html for any route (useful for SPAs)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
