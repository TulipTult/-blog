const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');

// Database connection
const db = new sqlite3.Database('./blog.db');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../secure-uploads');
    // Ensure the directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    // Log the path to help with debugging
    console.log(`Uploading to directory: ${uploadsDir}`);
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Add client-side file size validation
const validateFileSize = (file) => {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      message: `File too large. Maximum size allowed is 50MB.`
    };
  }
  return { valid: true };
};

// Error handler for file uploads
const handleUploadError = (response) => {
  if (!response.ok) {
    return response.text().then(text => {
      try {
        return JSON.parse(text);
      } catch (e) {
        if (text.includes('File too large')) {
          return { success: false, message: 'File size exceeds the 50MB limit. Please choose a smaller file.' };
        }
        return { success: false, message: 'Upload failed. Please try a smaller file.' };
      }
    });
  }
  return response.json();
};

// Profile route
router.get('/profile/:username', (req, res) => {
  const username = req.params.username;
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user) {
      return res.status(404).send('User not found');
    }
    
    db.all(`SELECT posts.*, users.username AS author, categories.name AS category_name,
            (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
            (SELECT COUNT(*) FROM favorites WHERE favorites.post_id = posts.id) AS favorite_count,
            (SELECT COUNT(*) FROM reposts WHERE reposts.original_post_id = posts.id) AS repost_count
            FROM posts 
            JOIN categories ON posts.category_id = categories.id 
            JOIN users ON posts.user_key = users.post_key
            WHERE posts.user_key = ? 
            ORDER BY posts.date DESC`, [user.post_key], (err, posts) => {
      if (err) {
        console.error("Error fetching user's posts:", err.message);
        posts = [];
      }
      
      res.render('profile', { user, posts });
    });
  });
});

// Validate profile owner
router.post('/validate-profile-owner', (req, res) => {
  const { postKey, username } = req.body;
  
  if (!postKey || !username) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
  }
  
  db.get("SELECT * FROM users WHERE post_key = ? AND username = ?", [postKey, username], (err, user) => {
    if (err) {
      console.error("Database error during profile owner validation:", err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    res.json({ success: !!user });
  });
});

// Edit profile route
router.get('/edit-profile', (req, res) => {
  const { postKey } = req.query;
  
  if (!postKey) {
    return res.status(400).send('Post key is required');
  }

  db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
    if (err || !user) {
      return res.status(401).send('Invalid post key. Please check for typos and try again.');
    }
    
    // Render the edit profile page with user data
    res.render('edit-profile', { user });
  });
});

// Save profile changes
router.post('/edit-profile', upload.single('profilePic'), (req, res) => {
  const { postKey, username, bio, role } = req.body;
  const profileCustomization = req.body.profileCustomization || '{}';
  
  if (!postKey) {
    return res.status(400).json({ success: false, message: 'Post key is required' });
  }

  db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
    if (err) {
      console.error("Error validating post key:", err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid post key' });
    }
    
    let updates = { bio, role, profile_customization: profileCustomization };
    
    // Update profile picture path reference
    if (req.file) {
      updates.profile_pic = `secure-uploads/${req.file.filename}`;
      
      // Delete old profile picture if it exists and isn't the default
      if (user.profile_pic && user.profile_pic !== 'secure-uploads/default-avatar.png') {
        const oldPicPath = path.join(__dirname, '../', user.profile_pic);
        if (fs.existsSync(oldPicPath)) {
          fs.unlink(oldPicPath, (err) => {
            if (err) console.error("Failed to delete old profile pic:", err);
          });
        }
      }
    }
    
    // Update user profile
    const updateFields = Object.entries(updates)
      .filter(([_, val]) => val !== undefined)
      .map(([key, _]) => `${key} = ?`);
    
    const updateValues = Object.entries(updates)
      .filter(([_, val]) => val !== undefined)
      .map(([_, val]) => val);
    
    if (updateFields.length === 0) {
      return res.json({ success: true, message: 'No changes made' });
    }
    
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE post_key = ?`;
    updateValues.push(postKey);
    
    db.run(query, updateValues, function(err) {
      if (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        updates: { ...updates, profile_pic: updates.profile_pic }
      });
    });
  });
});

module.exports = router;
