const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static files from the root directory so chat.html/index.html are accessible
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Data Persistence Paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}
if (!fs.existsSync(CHAT_FILE)) {
    fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
}

/**
 * Utility to read JSON files
 */
const readData = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return filePath === CHAT_FILE ? [] : {};
    }
};

/**
 * Utility to write JSON files
 */
const saveData = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error saving ${filePath}:`, err);
    }
};

// --- API ROUTES ---

// Registration/Login Route
app.post('/api/auth', (req, res) => {
    const { identifier, password, isLogin, email, age, gender } = req.body;
    const users = readData(USERS_FILE);

    if (isLogin) {
        // Login Logic
        let user = users[identifier.toLowerCase()];
        if (!user) {
            user = Object.values(users).find(u => u.email === identifier.toLowerCase());
        }

        if (user && user.password === password) {
            const { password, ...safeUser } = user;
            return res.json({ success: true, user: safeUser });
        }
        return res.status(401).json({ success: false, message: "Invalid credentials" });
    } else {
        // Signup Logic
        const username = identifier.toLowerCase();
        if (users[username]) return res.status(400).json({ success: false, message: "Username taken" });
        
        const newUser = {
            username,
            email: email.toLowerCase(),
            password,
            age,
            gender,
            pfp: "https://tse4.mm.bing.net/th/id/OIP.RzSDY3QeLinMNH2kcOduWQAAAA?rs=1&pid=ImgDetMain&o=7&rm=3",
            gold: username === 'dev' ? 1000000000 : 100,
            rubies: username === 'dev' ? 1000000 : 10,
            joinedAt: new Date().toISOString()
        };

        users[username] = newUser;
        saveData(USERS_FILE, users);
        
        const { password: pw, ...safeUser } = newUser;
        res.json({ success: true, user: safeUser });
    }
});

// Get Chat History
app.get('/api/chat', (req, res) => {
    const history = readData(CHAT_FILE);
    res.json(history);
});

// Save Chat Message
app.post('/api/chat', (req, res) => {
    const msgObj = req.body;
    if (!msgObj || !msgObj.user) return res.status(400).json({ success: false });

    const history = readData(CHAT_FILE);
    history.push(msgObj);
    if (history.length > 100) history.shift();
    
    saveData(CHAT_FILE, history);
    res.json({ success: true });
});

// Update User Stats (Gold/Gems/PFP)
app.post('/api/user/update', (req, res) => {
    const { username, updates } = req.body;
    const users = readData(USERS_FILE);
    
    if (users[username]) {
        users[username] = { ...users[username], ...updates };
        saveData(USERS_FILE, users);
        res.json({ success: true, user: users[username] });
    } else {
        res.status(404).json({ success: false, message: "User not found" });
    }
});

// Fallback: serve index.html for unknown routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
