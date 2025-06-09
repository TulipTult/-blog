const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const moment = require('moment');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

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

// GET route to display the post creation form
router.get('/create', (req, res) => {
  // Get all categories for the dropdown
  db.all("SELECT * FROM categories ORDER BY name", [], (err, categories) => {
    if (err) {
      console.error("Error fetching categories:", err);
      return res.render('create-post', { categories: [], error: 'Failed to load categories' });
    }
    
    res.render('create-post', { categories });
  });
});

// POST route to handle post creation
router.post('/create', upload.single('image'), (req, res) => {
  const { title, content, categoryId, postKey } = req.body;
  
  if (!title || !content || !postKey) {
    // Fetch categories again for re-rendering the form
    db.all("SELECT * FROM categories ORDER BY name", [], (err, categories) => {
      return res.render('create-post', { 
        categories: categories || [],
        error: 'Title, content, and post key are required', 
        title, 
        content 
      });
    });
    return;
  }
  
  // Validate post key
  db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
    if (err) {
      console.error("Database error during post key validation:", err);
      // Fetch categories for re-rendering
      db.all("SELECT * FROM categories ORDER BY name", [], (catErr, categories) => {
        return res.render('create-post', { 
          categories: categories || [], 
          error: 'Database error. Please try again later.', 
          title, 
          content
        });
      });
      return;
    }
    
    if (!user) {
      // Fetch categories for re-rendering
      db.all("SELECT * FROM categories ORDER BY name", [], (catErr, categories) => {
        return res.render('create-post', { 
          categories: categories || [],
          error: 'Invalid post key. Please check for typos and try again.', 
          title, 
          content 
        });
      });
      return;
    }
    
    // Prepare post data
    const date = moment().format('YYYY-MM-DD HH:mm:ss');
    let imagePath = null;
    
    if (req.file) {
      imagePath = `secure-uploads/${req.file.filename}`;
    }
    
    // Use selected category or default to 1 if not provided
    const selectedCategory = categoryId || 1;
    
    // Insert post
    db.run(
      "INSERT INTO posts (title, content, user_key, category_id, date, image_path) VALUES (?, ?, ?, ?, ?, ?)",
      [title, content, user.post_key, selectedCategory, date, imagePath],
      function(err) {
        if (err) {
          console.error("Error creating post:", err);
          // Fetch categories for re-rendering
          db.all("SELECT * FROM categories ORDER BY name", [], (catErr, categories) => {
            return res.render('create-post', { 
              categories: categories || [],
              error: 'Error creating post. Please try again.', 
              title, 
              content 
            });
          });
          return;
        }
        
        // Success - redirect to the post or category
        res.redirect(`/post/${this.lastID}`);
      }
    );
  });
});

module.exports = router;
