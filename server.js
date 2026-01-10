/**
 * server.js - User Privilege Management
 * * This script handles the initialization and synchronization of 
 * administrative ranks for specific users. 
 */

// NOTE: You must run 'npm install firebase-admin' to resolve the MODULE_NOT_FOUND error.
const admin = require('firebase-admin');

// Initialize Firebase Admin (Assumes environment variables or service account set up)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// App Configuration - Matching the ID used in the frontend
const appId = process.env.APP_ID || 'chatlaxy-pro-v1';
const PUBLIC_USERS_COLLECTION = `artifacts/${appId}/public/data/users`;

/**
 * Define Admin Users and their specific metadata
 */
const ADMIN_ROSTER = [
  {
    username: "The Plague",
    rank: "CEO",
    permissions: ["all", "admin_panel", "bypass_limits", "beta_features"],
    color: "#ff0000"
  },
  {
    username: "Developer",
    rank: "Developer",
    permissions: ["all", "debug_mode", "edit_content", "beta_features"],
    color: "#00ff00"
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
      // Find user by username (matching the field name in the frontend)
      const snapshot = await usersRef.where('username', '==', adminData.username).get();

      if (snapshot.empty) {
        console.log(`User "${adminData.username}" not found in database yet. They must log in first.`);
        continue;
      }

      // Update every instance of this name
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
    console.error("Error syncing admin privileges:", error);
  }
}

// Export for use in main server loop or run immediately
module.exports = { syncAdminPrivileges };

/**
 * Usage Example:
 * In your main server.js or entry point:
 * * const { syncAdminPrivileges } = require('./server');
 * syncAdminPrivileges();
 */
