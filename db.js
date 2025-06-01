const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'blog.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    throw err;
  }
  console.log('Connected to the SQLite database from db.js module');
});

// Function to get user by post key
db.getUserByPostKey = function(postKey) {
  return new Promise((resolve, reject) => {
    this.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }
      
      // If user exists, try to parse profile_customization if it exists
      if (user) {
        try {
          // Check if profile_customization exists and is not null
          if (user.profile_customization) {
            user.profile_customization = JSON.parse(user.profile_customization);
          } else {
            user.profile_customization = null;
          }
        } catch (e) {
          console.error("Error parsing profile customization:", e);
          user.profile_customization = null;
        }
      }
      
      resolve(user);
    });
  });
};

// Get user by username
function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM users WHERE username = ?",
      [username],
      (err, user) => {
        if (err) {
          console.error("Error getting user:", err);
          return reject(err);
        }
        
        if (user && user.profile_customization) {
          try {
            user.profile_customization = JSON.parse(user.profile_customization);
          } catch (e) {
            console.error(`Error parsing profile_customization for ${username}:`, e);
            user.profile_customization = {};
          }
        }
        
        resolve(user);
      }
    );
  });
}

module.exports = db;