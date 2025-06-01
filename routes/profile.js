const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// Get edit profile page
router.get('/edit-profile', async (req, res) => {
  try {
    const postKey = req.query.postKey;
    
    if (!postKey) {
      return res.status(401).send('Unauthorized: No post key provided');
    }
    
    // Validate post key and get user
    const user = await db.getUserByPostKey(postKey);
    
    if (!user) {
      return res.status(401).send('Unauthorized: Invalid post key');
    }
    
    // Render the edit profile page with user data
    res.render('edit-profile', { user });
  } catch (error) {
    console.error('Error getting edit profile page:', error);
    res.status(500).send('Server error');
  }
});

// Handle profile image uploads
router.post('/upload-profile-image', upload.single('image'), async (req, res) => {
  try {
    const postKey = req.body.postKey;
    
    if (!postKey || !req.file) {
      return res.json({ success: false, message: 'Missing post key or image file' });
    }
    
    // Validate post key
    const user = await db.getUserByPostKey(postKey);
    
    if (!user) {
      return res.json({ success: false, message: 'Invalid post key' });
    }
    
    // Update image path in response
    const imagePath = '/uploads/' + req.file.filename;
    
    return res.json({
      success: true,
      message: 'Image uploaded successfully',
      imagePath
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return res.json({ success: false, message: 'Server error' });
  }
});

// Save profile changes
router.post('/save-profile', async (req, res) => {
  try {
    const { postKey, username, role, bio, customizations } = req.body;
    
    if (!postKey) {
      return res.json({ success: false, message: 'No post key provided' });
    }
    
    // Validate post key and get user
    const user = await db.getUserByPostKey(postKey);
    
    if (!user || user.username !== username) {
      return res.json({ success: false, message: 'Unauthorized or invalid user' });
    }
    
    // Save profile changes
    await updateUserProfile(username, {
      role,
      bio,
      profile_customization: customizations
    });
    
    return res.json({
      success: true,
      message: 'Profile updated successfully',
      username
    });
  } catch (error) {
    console.error('Error saving profile:', error);
    return res.json({ success: false, message: 'Server error' });
  }
});

// Helper function to update user profile
async function updateUserProfile(username, profileData) {
  const { role, bio, profile_customization } = profileData;
  const profileCustomizationStr = JSON.stringify(profile_customization);
  
  return new Promise((resolve, reject) => {
    // First, check if the profile_customization column exists
    db.all("PRAGMA table_info(users)", [], (err, columns) => {
      if (err) {
        console.error("Error checking table schema:", err);
        return reject(err);
      }
      
      const hasColumn = columns.some(col => col.name === 'profile_customization');
      
      if (hasColumn) {
        // Column exists, proceed with update
        db.run(
          "UPDATE users SET role = ?, bio = ?, profile_customization = ? WHERE username = ?",
          [role, bio, profileCustomizationStr, username],
          function(err) {
            if (err) {
              console.error("Error updating profile:", err);
              return reject(err);
            }
            resolve({ success: true, changes: this.changes });
          }
        );
      } else {
        // Column doesn't exist, add it first
        db.run("ALTER TABLE users ADD COLUMN profile_customization TEXT", [], function(err) {
          if (err) {
            console.error("Error adding profile_customization column:", err);
            // Try updating without the profile_customization
            db.run(
              "UPDATE users SET role = ?, bio = ? WHERE username = ?",
              [role, bio, username],
              function(err) {
                if (err) {
                  console.error("Error updating profile without customization:", err);
                  return reject(err);
                }
                resolve({ success: true, changes: this.changes });
              }
            );
          } else {
            // Column added successfully, now update
            db.run(
              "UPDATE users SET role = ?, bio = ?, profile_customization = ? WHERE username = ?",
              [role, bio, profileCustomizationStr, username],
              function(err) {
                if (err) {
                  console.error("Error updating profile after adding column:", err);
                  return reject(err);
                }
                resolve({ success: true, changes: this.changes });
              }
            );
          }
        });
      }
    });
  });
}

// Route to view a user profile
router.get('/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    // Get user data
    const user = await getUserData(username);
    
    if (!user) {
      return res.status(404).render('404', { message: 'User not found' });
    }
    
    // Parse profile_customization if it exists
    if (user.profile_customization) {
      try {
        user.profile_customization = JSON.parse(user.profile_customization);
      } catch (e) {
        console.error("Error parsing profile customization:", e);
        user.profile_customization = {};
      }
    } else {
      user.profile_customization = {};
    }
    
    // Get user posts
    const posts = await getUserPosts(username);
    
    res.render('profile', { user, posts });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).send('Server error');
  }
});

module.exports = router;