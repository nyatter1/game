/**
 * server.js - Combined Express Server & User Privilege Management
 * This file serves the frontend and synchronizes administrative ranks 
 * for specific users.
 */

const express = require('express');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * FIREBASE ADMIN INITIALIZATION
 * To run this on Render, you must go to your Dashboard -> Environment
 * and add a variable: FIREBASE_SERVICE_ACCOUNT
 * The value should be the entire JSON string from your Firebase Service Account key file.
 */
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin initialized with Service Account.");
    } else {
      console.warn("No FIREBASE_SERVICE_ACCOUNT found. Admin rank sync may not work.");
      admin.initializeApp();
    }
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error.message);
  }
}

const db = admin.firestore();
const appId = process.env.APP_ID || 'chatlaxy-pro-v1';
const PUBLIC_USERS_COLLECTION = `artifacts/${appId}/public/data/users`;

/**
 * Define Admin Users and their specific metadata
 */
const ADMIN_ROSTER = [
  {
    username: "The Plague",
    rank: "CEO",
    permissions: ["all", "admin_panel", "bypass_limits", "beta_features"]
  },
  {
    username: "Developer",
    rank: "Developer",
    permissions: ["all", "debug_mode", "edit_content", "beta_features"]
  }
];

/**
 * Updates or Creates admin users in the public users collection
 */
async function syncAdminPrivileges() {
  console.log("--- Starting Admin Sync ---");

  try {
    const usersRef = db.collection(PUBLIC_USERS_COLLECTION);
    
    for (const adminData of ADMIN_ROSTER) {
      const snapshot = await usersRef.where('username', '==', adminData.username).get();

      if (snapshot.empty) {
        console.log(`User "${adminData.username}" not found in database yet. Sync skipped for this user.`);
        continue;
      }

      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, {
          rank: adminData.rank,
          permissions: adminData.permissions,
          isStaff: true,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`Successfully updated privileges for: ${adminData.username} (${adminData.rank})`);
    }
    console.log("--- Sync Complete ---");
  } catch (error) {
    console.error("Error syncing admin privileges:", error.message);
  }
}

// 1. Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// 2. Always serve index.html for any request (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 3. Start the server and run initial sync
app.listen(PORT, async () => {
    console.log(`Chatlaxy server is running on port ${PORT}`);
    
    // Initial sync on startup
    await syncAdminPrivileges();
    
    // Re-sync every hour to ensure ranks stay updated
    setInterval(syncAdminPrivileges, 1000 * 60 * 60);
});

module.exports = { syncAdminPrivileges };
