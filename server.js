const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Firebase Admin SDK for "Nuclear Wipe"
const admin = require('firebase-admin');

// IMPORTANT: Place your service account JSON file in the same folder as this script
// or set the GOOGLE_APPLICATION_CREDENTIALS environment variable.
if (fs.existsSync('./serviceAccountKey.json')) {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');

const initFiles = () => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
    if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
};
initFiles();

/**
 * THE NUCLEAR WIPE - Deletes Local Files, Firestore Data, and all Firebase Auth Users
 */
async function performNuclearFirebaseWipe() {
    console.log("!!! STARTING FULL FIREBASE & LOCAL WIPE !!!");

    try {
        // 1. Wipe Firebase Auth Users
        const listUsersResult = await admin.auth().listUsers(1000);
        const uids = listUsersResult.users.map(user => user.uid);
        if (uids.length > 0) {
            await admin.auth().deleteUsers(uids);
            console.log(`Successfully deleted ${uids.length} Firebase Auth users.`);
        }

        // 2. Wipe Firestore Data (Targeting specific artifact path)
        const db = admin.firestore();
        const appId = "default-app-id"; // Replace with your __app_id if constant
        const artifactPath = `artifacts/${appId}`;
        
        async function deleteCollection(collectionPath) {
            const collectionRef = db.collection(collectionPath);
            const query = collectionRef.orderBy('__name__').limit(500);
            const snapshot = await query.get();
            if (snapshot.size === 0) return;
            const batch = db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            process.nextTick(() => deleteCollection(collectionPath));
        }

        await deleteCollection(`${artifactPath}/public/data`);
        console.log("Firestore public data wiped.");

        // 3. Wipe Local Files
        fs.writeFileSync(USERS_FILE, JSON.stringify({}));
        fs.writeFileSync(CHAT_FILE, JSON.stringify([]));

        // 4. Force Client Reset
        io.emit('system_message', "☢️ SITE REBOOT: All accounts and data have been permanently deleted.");
        io.emit('force_wipe_client');
        
        console.log("NUCLEAR WIPE COMPLETE.");
    } catch (error) {
        console.error("Error during Nuclear Wipe:", error);
    }
}

// Terminal Command Listener
rl.on('line', (line) => {
    if (line.trim().toLowerCase() === 'nuke_firebase') {
        performNuclearFirebaseWipe();
    }
});

const saveData = (filePath, data) => {
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); } catch (err) { console.error(err); }
};

let onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('join', (userData) => {
        const username = userData.username.toLowerCase();
        onlineUsers[socket.id] = userData;
        io.emit('user_list_update', Object.values(onlineUsers));
    });

    socket.on('chat_message', (msg) => {
        const sender = onlineUsers[socket.id];
        if (!sender) return;

        // Allow /nuke command in chat for the dev
        if (msg.text === '/nuke' && sender.username.toLowerCase() === 'dev') {
            performNuclearFirebaseWipe();
            return;
        }

        io.emit('chat_message', { ...msg, timestamp: new Date() });
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('user_list_update', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Type 'nuke_firebase' to wipe everything.`));
