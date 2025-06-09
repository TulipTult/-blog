const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const moment = require('moment');
const fs = require('fs');
const http = require('http');
const socketIO = require('socket.io');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Import routers
const profileRouter = require('./views/profile');

// Create HTTP server for Socket.IO
const server = http.createServer(app);
const io = socketIO(server);

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Add this line to parse JSON requests
app.use(express.static(path.join(__dirname, 'public')));

// Use routers
app.use(profileRouter);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Change destination to a secure location outside public folder
    const uploadsDir = path.join(__dirname, 'secure-uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create a more secure filename with random elements
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const randomString = Math.random().toString(36).substring(2, 15);
    cb(null, `${Date.now()}-${randomString}${fileExtension}`);
  }
});

// File filter to allow specific image and video formats
const fileFilter = (req, file, cb) => {
  // Accept image and video files with specific MIME types
  if (file.mimetype.startsWith('image/')) {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only supported image and video files are allowed'), false);
    }
  } else if (file.mimetype.startsWith('video/')) {
    const allowedVideoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedVideoExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, WebM, Ogg, MOV, and AVI video formats are supported'), false);
    }
  } else {
    cb(new Error('Only image and video files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit for videos
  }
});

// Add error handler for multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 50MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// Database file path
const dbPath = './blog.db';

// Check for database corruption
let databaseNeedsReset = false;
if (fs.existsSync(dbPath)) {
  try {
    // Try opening the database
    const testDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    testDb.close();
  } catch (error) {
    console.error("Database corruption detected. Creating new database.");
    databaseNeedsReset = true;
    fs.unlinkSync(dbPath);
  }
}

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err.message);
    throw err;
  }
  console.log('Connected to the SQLite database.');
  
  // Create tables if they don't exist
  db.run(`CREATE TABLE IF NOT EXISTS users (
    post_key TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    profile_pic TEXT,
    role TEXT,
    bio TEXT
  )`);
  
  // Update users table with role and bio if needed
  db.all("PRAGMA table_info(users)", [], (err, columns) => {
    if (err) {
      console.error("Error checking users table:", err.message);
      return;
    }
    
    const hasRoleColumn = columns.some(col => col.name === 'role');
    const hasBioColumn = columns.some(col => col.name === 'bio');
    
    if (!hasRoleColumn || !hasBioColumn) {
      console.log("Updating users table schema to add role and bio columns...");
      
      // We'll use nested callbacks to ensure sequential execution
      const updateTulipInfo = () => {
        // Only update after both columns exist
        db.run("UPDATE users SET role = ?, bio = ? WHERE post_key = ?", 
          ["Agarthas Admin", "yk ur own classic pibble lover here i love pibbles so much. drink raw milk #saveeurope", "pibble_power3"],
          (err) => {
            if (err) {
              console.error("Error updating Tulip's profile:", err.message);
            } else {
              console.log("Tulip's profile updated successfully!");
            }
          });
      };

      let pendingAlters = 0;
      let altersCompleted = 0;

      const checkAndUpdateTulip = () => {
        altersCompleted++;
        if (altersCompleted === pendingAlters) {
          console.log("Schema updates completed, updating user info...");
          // Small delay to ensure schema changes are fully applied
          setTimeout(updateTulipInfo, 100);
        }
      };
      
      if (!hasRoleColumn) {
        pendingAlters++;
        db.run("ALTER TABLE users ADD COLUMN role TEXT", (err) => {
          if (err) {
            console.error("Error adding role column:", err.message);
          } else {
            console.log("Role column added successfully");
          }
          checkAndUpdateTulip();
        });
      }
      
      if (!hasBioColumn) {
        pendingAlters++;
        db.run("ALTER TABLE users ADD COLUMN bio TEXT", (err) => {
          if (err) {
            console.error("Error adding bio column:", err.message);
          } else {
            console.log("Bio column added successfully");
          }
          checkAndUpdateTulip();
        });
      }
      
      // Add profile_customization column if it doesn't exist
      const hasCustomizationColumn = columns.some(col => col.name === 'profile_customization');
      if (!hasCustomizationColumn) {
        pendingAlters++;
        db.run("ALTER TABLE users ADD COLUMN profile_customization TEXT", (err) => {
          if (err) {
            console.error("Error adding profile_customization column:", err.message);
          } else {
            console.log("Profile customization column added successfully");
          }
          checkAndUpdateTulip();
        });
      }
    }
  });
  
  // Create categories table
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT,
    created_at TEXT,
    FOREIGN KEY (created_by) REFERENCES users (post_key)
  )`);
  
  // Create likes table
  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
    FOREIGN KEY (user_key) REFERENCES users (post_key),
    UNIQUE(post_id, user_key)
  )`);

  // Create favorites table
  db.run(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
    FOREIGN KEY (user_key) REFERENCES users (post_key),
    UNIQUE(post_id, user_key)
  )`);

  // Create reposts table
  db.run(`CREATE TABLE IF NOT EXISTS reposts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_post_id INTEGER NOT NULL,
    user_key TEXT NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (original_post_id) REFERENCES posts (id) ON DELETE CASCADE,
    FOREIGN KEY (user_key) REFERENCES users (post_key)
  )`);

  // Create friends table
  db.run(`CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key_1 TEXT NOT NULL,
    user_key_2 TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_key_1) REFERENCES users (post_key),
    FOREIGN KEY (user_key_2) REFERENCES users (post_key),
    UNIQUE(user_key_1, user_key_2)
  )`);

  // Create friend_messages table
  db.run(`CREATE TABLE IF NOT EXISTS friend_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_key TEXT NOT NULL,
    receiver_key TEXT NOT NULL,
    message TEXT NOT NULL,
    image_path TEXT,
    gif_url TEXT,
    created_at TEXT NOT NULL,
    read_at TEXT,
    FOREIGN KEY (sender_key) REFERENCES users (post_key),
    FOREIGN KEY (receiver_key) REFERENCES users (post_key)
  )`);
  
  // Update strategy for posts table
  db.all("PRAGMA table_info(posts)", [], (err, columns) => {
    if (err) {
      console.error("Error checking posts table:", err.message);
    }
    // Check if original posts table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'", [], (err, table) => {
      if (table) {
        // Check if category_id column exists
        const hasColumn = columns && columns.some(col => col.name === 'category_id');
        if (!hasColumn) {
          console.log("Migrating posts table to new schema...");
          // Create backup table using sequential callbacks to avoid race conditions
          db.run("ALTER TABLE posts RENAME TO posts_old", function(err) {
            if (err) {
              console.error("Error renaming posts table:", err.message);
              return;
            }
            // Create new table with correct schema after renaming is successful
            db.run(`CREATE TABLE posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              user_key TEXT NOT NULL,
              category_id INTEGER DEFAULT 1,
              date TEXT NOT NULL,
              image_path TEXT,
              FOREIGN KEY (user_key) REFERENCES users (post_key),
              FOREIGN KEY (category_id) REFERENCES categories (id)
            )`, function(err) {
              if (err) {
                console.error("Error creating new posts table:", err.message);
                return;
              }
              // Copy data from old to new after table is created
              db.run(`INSERT INTO posts(id, title, content, user_key, date, image_path, category_id)
                      SELECT id, title, content, user_key, date, image_path, 1 FROM posts_old`, function(err) {
                if (err) {
                  console.error("Error copying data to new posts table:", err.message);
                  return;
                }
                console.log("Migration completed successfully.");
              });
            });
          });
        }
      } else {
        // If posts table doesn't exist, create it
        db.run(`CREATE TABLE posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          user_key TEXT NOT NULL,
          category_id INTEGER DEFAULT 1,
          date TEXT NOT NULL,
          image_path TEXT,
          FOREIGN KEY (user_key) REFERENCES users (post_key),
          FOREIGN KEY (category_id) REFERENCES categories (id)
        )`);
      }
    });
  });

  // Insert the initial user if it doesn't exist
  db.get("SELECT * FROM users WHERE post_key = ?", ["pibble_power3"], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (post_key, username, profile_pic, role, bio) VALUES (?, ?, ?, ?, ?)", 
        ["pibble_power3", "Tulip", "secure-uploads/default-avatar.png", 
        "Agarthas Admin", "yk ur own classic pibble lover here i love pibbles so much. drink raw milk #saveeurope"]);
    } else if (!row.role || !row.bio) {
      // Update existing user with role and bio if they're missing
      db.run("UPDATE users SET role = ?, bio = ? WHERE post_key = ?", 
        ["Agarthas Admin", "yk ur own classic pibble lover here i love pibbles so much. drink raw milk #saveeurope", "pibble_power3"]);
    }
  });
  
  // Insert the default "random" category if it doesn't exist
  db.get("SELECT * FROM categories WHERE id = 1", (err, row) => {
    if (!row) {
      const date = moment().format('YYYY-MM-DD HH:mm:ss');
      db.run("INSERT INTO categories (id, name, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)", 
        [1, "random", "Random posts that don't belong anywhere else", "pibble_power3", date]);
    }
  });
});

// Ensure default avatar exists
const defaultAvatarPath = path.join(__dirname, 'secure-uploads', 'default-avatar.png');
if (!fs.existsSync(defaultAvatarPath)) {
  console.log("Creating default avatar image...");
  // Simple 32x32 colored square as default avatar - basic PNG data
  const defaultAvatarData = Buffer.from(
    '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' +
    'AABJRU5ErkJggg==',
    'base64'
  );
  // Make sure the directory exists
  const uploadsDir = path.join(__dirname, 'secure-uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  fs.writeFileSync(defaultAvatarPath, defaultAvatarData);
  console.log("Default avatar created successfully!");
}

// Active users storage
const activeUsers = new Map(); // Map of socket ID to user data

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  socket.on('authenticate', (data) => {
    const { postKey } = data;

    validatePostKey(postKey, (user) => {
      if (!user) {
        socket.emit('auth_response', { success: false, message: 'Invalid post key. Please check for typos and try again.' });
        return;
      }

      // Store user data in socket session
      socket.user = user;
      activeUsers.set(socket.id, user);

      // Join the main chat room
      socket.join('main');
      
      // Send success response with user data
      socket.emit('auth_response', { 
        success: true, 
        user: {
          username: user.username,
          profile_pic: user.profile_pic || 'uploads/default-avatar.png',
          post_key: user.post_key
        }
      });

      // Broadcast user joined message
      socket.to('main').emit('system_message', {
        message: `${user.username} has joined the chat`
      });

      // Update all clients with new users list
      updateUsersList();
    });
  });

  socket.on('chat_message', (data) => {
    if (!socket.user) return;

    const messageData = {
      user: {
        username: socket.user.username,
        profile_pic: socket.user.profile_pic,
        post_key: socket.user.post_key
      },
      message: data.message,
      timestamp: new Date().toISOString()
    };

    // Save message to database and emit to all clients
    const date = moment().format('YYYY-MM-DD HH:mm:ss');
    
    // Store chat message in db (add this table if needed)
    db.run(`INSERT INTO chat_messages (user_key, message, created_at) 
            VALUES (?, ?, ?)`, 
            [socket.user.post_key, data.message, date], function(err) {
      if (err) {
        console.error("Error saving chat message:", err);
        // Still emit the message even if db save fails
      }
      
      // Only emit after database operation completes
      // This prevents duplicate messages
      io.to('main').emit('new_message', messageData);
    });
    
    // Remove the immediate emit that was causing duplicates
    // io.to('main').emit('new_message', messageData);
  });

  // Add private chat handlers
  socket.on('join_private_chat', function(data) {
    const { userKey, friendKey } = data;
    
    // Create a unique room name for this chat (always in the same order to ensure both users join the same room)
    const room1 = `chat_${userKey}_${friendKey}`;
    const room2 = `chat_${friendKey}_${userKey}`;
    
    socket.join(room1);
    socket.join(room2);
  });

  socket.on('send_private_message', function(data) {
    const { sender, receiver, message, gif, localMsgId } = data;
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    
    // Save the message to database
    db.run(`INSERT INTO friend_messages 
            (sender_key, receiver_key, message, gif_url, created_at) 
            VALUES (?, ?, ?, ?, ?)`, 
            [sender, receiver, message || '', gif || null, timestamp], function(err) {
      
      if (err) {
        console.error("Error saving message:", err);
        return;
      }
      
      const messageId = this.lastID;
      
      // Send message to both users
      io.to(`chat_${sender}_${receiver}`).emit('private_message', {
        id: messageId,
        sender,
        receiver,
        message,
        gif,
        timestamp,
        localMsgId // Pass through the original message ID
      });
    });
  });

  // Socket.IO event for validating keys
  socket.on('validate_key', function(data) {
    const { postKey } = data;
    
    validatePostKey(postKey, (user) => {
      socket.emit('key_validated', {
        valid: !!user,
        postKey: user ? user.post_key : null
      });
    });
  });

  socket.on('disconnect', () => {
    if (socket.user) {
      socket.to('main').emit('system_message', {
        message: `${socket.user.username} has left the chat`
      });
      activeUsers.delete(socket.id);
      updateUsersList();
    }
  });

  function updateUsersList() {
    const users = Array.from(activeUsers.values()).map(user => ({
      username: user.username,
      profile_pic: user.profile_pic
    }));
    io.to('main').emit('users_update', { users });
  }
});

// Function to generate a random post key (at least 8 characters)
function generateRandomPostKey(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Secret signup route
app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', upload.single('profilePic'), (req, res) => {
  const { username, role, bio, customPostKey } = req.body;
  
  // Basic validation
  if (!username || username.trim() === '') {
    return res.render('signup', { 
      error: 'Username is required',
      role, 
      bio
    });
  }
  
  // Check if username already exists
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, existingUser) => {
    if (err) {
      return res.render('signup', { 
        error: 'Database error occurred',
        username, 
        role, 
        bio
      });
    }
    
    if (existingUser) {
      return res.render('signup', { 
        error: 'Username already taken',
        username, 
        role, 
        bio
      });
    }
    
    // Generate or use custom post key
    let postKey = customPostKey && customPostKey.trim() ? customPostKey.trim() : generateRandomPostKey();
    
    // Check if post key already exists
    db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, existingKey) => {
      if (err) {
        return res.render('signup', { 
          error: 'Database error occurred',
          username, 
          role, 
          bio
        });
      }
      
      if (existingKey) {
        return res.render('signup', { 
          error: 'Post key already taken. Please choose a different one or leave blank to auto-generate',
          username, 
          role, 
          bio
        });
      }
      
      // Process profile picture
      const profilePic = req.file ? `secure-uploads/${req.file.filename}` : 'secure-uploads/default-avatar.png';
      
      // Insert the new user
      db.run(
        "INSERT INTO users (post_key, username, profile_pic, role, bio) VALUES (?, ?, ?, ?, ?)",
        [postKey, username, profilePic, role || null, bio || null],
        function(err) {
          if (err) {
            return res.render('signup', { 
              error: `Error creating account: ${err.message}`,
              username, 
              role, 
              bio
            });
          }
          
          // Success! Render success message
          res.render('signup', { 
            success: true,
            postKey,
            username
          });
        }
      );
    });
  });
});

// Chat route
app.get('/chat', (req, res) => {
  res.render('chat');
});

// Routes
app.get('/', (req, res) => {
  db.all(`SELECT categories.*, users.username as creator_name
          FROM categories 
          LEFT JOIN users ON categories.created_by = users.post_key
          ORDER BY categories.name`, [], (err, categories) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.render('index', { categories: [] });
    }

    const getCountPromises = categories.map(category => {
      return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM posts WHERE category_id = ?', 
          [category.id], (err, result) => {
            if (err) {
              console.error("Could not get post count:", err.message);
              category.post_count = 0;
            } else {
              category.post_count = result ? result.count : 0;
            }
            resolve();
          });
      });
    });

    Promise.all(getCountPromises)
      .then(() => {
        res.render('index', { categories: categories || [] });
      })
      .catch(error => {
        console.error("Error counting posts:", error);
        res.render('index', { categories: categories || [] });
      });
  });
});

app.get('/category/:id', (req, res) => {
  const categoryId = req.params.id;

  db.get(`SELECT * FROM categories WHERE id = ?`, [categoryId], (err, category) => {
    if (err || !category) {
      return res.redirect('/');
    }

    db.all(`SELECT posts.*, users.username, users.profile_pic,
            (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
            (SELECT COUNT(*) FROM favorites WHERE favorites.post_id = posts.id) AS favorite_count,
            (SELECT COUNT(*) FROM reposts WHERE reposts.original_post_id = posts.id) AS repost_count
            FROM posts 
            JOIN users ON posts.user_key = users.post_key
            WHERE posts.category_id = ?
            ORDER BY like_count DESC, date DESC`, [categoryId], (err, posts) => {
      if (err) {
        console.error(err.message);
        return res.render('category', { category, posts: [] });
      }
      res.render('category', { category, posts });
    });
  });
});

app.get('/create', (req, res) => {
  db.all(`SELECT * FROM categories ORDER BY name`, [], (err, categories) => {
    if (err) {
      return console.error(err.message);
    }
    res.render('create-post', { categories });
  });
});

app.post('/create', upload.single('image'), (req, res) => {
  const { title, content, postKey, categoryId } = req.body;
  const imagePath = req.file ? `secure-uploads/${req.file.filename}` : null;
  const date = moment().format('YYYY-MM-DD HH:mm:ss');
  const category = categoryId || 1;

  validatePostKey(postKey, (user) => {
    if (!user) {
      return db.all(`SELECT * FROM categories ORDER BY name`, [], (err, categories) => {
        return res.render('create-post', { 
          error: 'Invalid post key. Please check for typos and try again.',
          title,
          content,
          categories
        });
      });
    }

    db.run(`INSERT INTO posts (title, content, user_key, category_id, date, image_path) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            [title, content, user.post_key, category, date, imagePath], function(err) {
      if (err) {
        console.error('Database error when creating post:', err.message);
        return db.all(`SELECT * FROM categories ORDER BY name`, [], (err, categories) => {
          return res.render('create-post', { 
            error: `Database error: ${err.message}`,
            title,
            content,
            categories
          });
        });
      }
      return res.redirect('/category/' + category);
    });
  });
});

app.get('/create-category', (req, res) => {
  res.render('create-category');
});

app.post('/create-category', upload.single('image'), (req, res) => {
  const { name, description, postKey } = req.body;
  const date = moment().format('YYYY-MM-DD HH:mm:ss');

  // Log for debugging
  console.log(`Attempting to create category with key: ${postKey}`);
  
  // Check for empty values
  if (!name || name.trim() === '') {
    return res.render('create-category', { 
      error: 'Category name is required',
      name,
      description
    });
  }

  // Special admin keys that always work
  const validKeys = ['pibble_power3', '1pibble'];
  
  // Check if the key is one of our admin keys
  if (validKeys.includes(postKey)) {
    console.log(`Admin key recognized: ${postKey}`);
    
    // Insert the new category
    db.run(`INSERT INTO categories (name, description, created_by, created_at) 
            VALUES (?, ?, ?, ?)`, 
            [name, description, postKey, date], function(err) {
      if (err) {
        console.error(`Database error during category creation: ${err.message}`);
        return res.render('create-category', { 
          error: `Database error: ${err.message}`,
          name,
          description
        });
      }
      
      console.log(`Category created successfully with admin key: ${postKey}`);
      return res.redirect('/');
    });
  } else {
    // For non-admin keys, check the database
    console.log(`Checking database for user with key: ${postKey}`);
    
    db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
      if (err) {
        console.error(`Database error during user lookup: ${err.message}`);
        return res.render('create-category', { 
          error: `Database error during authentication: ${err.message}`,
          name,
          description
        });
      }
      
      if (!user) {
        console.log(`No user found with key: ${postKey}`);
        return res.render('create-category', { 
          error: 'Invalid post key - User not found',
          name,
          description
        });
      }
      
      console.log(`User found: ${user.username}, creating category`);
      
      // Create the category with the validated user
      db.run(`INSERT INTO categories (name, description, created_by, created_at) 
              VALUES (?, ?, ?, ?)`, 
              [name, description, postKey, date], function(err) {
        if (err) {
          console.error(`Database error during category creation: ${err.message}`);
          return res.render('create-category', { 
            error: `Error creating category: ${err.message}`,
            name,
            description
          });
        }
        
        console.log(`Category created successfully by user: ${user.username}`);
        res.redirect('/');
      });
    });
  }
});

app.get('/profile/:username', (req, res) => {
  const username = req.params.username;
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user) {
      return res.status(404).send('User not found');
    }
    
    db.all(`SELECT posts.*, categories.name AS category_name,
            (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count
            FROM posts 
            JOIN categories ON posts.category_id = categories.id 
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

app.post('/delete-post/:id', (req, res) => {
  const postId = req.params.id;
  const { postKey } = req.body;
  
  db.get("SELECT * FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err) {
      console.error("Error finding post:", err.message);
      return res.status(500).send('Database error occurred');
    }
    if (!post) {
      return res.status(404).send('Post not found');
    }
    if (post.user_key !== postKey) {
      return res.status(403).send('Unauthorized: Post key does not match');
    }

    const categoryId = post.category_id;
    db.run("DELETE FROM posts WHERE id = ?", [postId], function(err) {
      if (err) {
        return res.status(500).send('Failed to delete post');
      }
      res.redirect(`/category/${categoryId}`);
    });
  });
});

app.post('/delete-category/:id', (req, res) => {
  const categoryId = parseInt(req.params.id);
  const { postKey } = req.body;
  
  if (!categoryId || isNaN(categoryId)) {
    return res.status(400).send('Invalid category ID');
  }
  if (!postKey || postKey.trim() === '') {
    return res.status(400).send('Post key is required');
  }
  if (categoryId === 1) {
    return res.status(403).send('Cannot delete the default category');
  }

  // Special admin keys can delete any category
  const validAdminKeys = ['pibble_power3', '1pibble'];
  const isAdmin = validAdminKeys.includes(postKey);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.get("SELECT * FROM categories WHERE id = ?", [categoryId], (err, category) => {
      if (err || !category) {
        db.run('ROLLBACK');
        return res.status(404).send('Category not found');
      }
      
      // Admin can delete any category, regular users only their own
      if (!isAdmin && category.created_by !== postKey) {
        db.run('ROLLBACK');
        return res.status(403).send('Unauthorized: Post key does not match');
      }

      db.run("UPDATE posts SET category_id = 1 WHERE category_id = ?", [categoryId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).send('Failed to move posts');
        }

        db.run("DELETE FROM categories WHERE id = ?", [categoryId], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).send('Failed to delete category');
          }

          db.run('COMMIT', function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).send('Transaction error');
            }
            res.redirect('/');
          });
        });
      });
    });
  });
});

// Add routes for social features
// Like a post
app.post('/like-post/:id', (req, res) => {
  const postId = req.params.id;
  const { postKey } = req.body;
  
  validatePostKey(postKey, (user) => {
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid post key. Please check for typos and try again.' });
    }
    
    const date = moment().format('YYYY-MM-DD HH:mm:ss');
    
    // Check if already liked
    db.get("SELECT id FROM likes WHERE post_id = ? AND user_key = ?", [postId, user.post_key], (err, like) => {
      if (like) {
        // Unlike if already liked
        db.run("DELETE FROM likes WHERE id = ?", [like.id], function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Failed to unlike post' });
          }
          
          // Get updated like count
          db.get("SELECT COUNT(*) as count FROM likes WHERE post_id = ?", [postId], (err, result) => {
            return res.json({ 
              success: true, 
              action: 'unliked', 
              count: result ? result.count : 0 
            });
          });
        });
      } else {
        // Like the post
        db.run("INSERT INTO likes (post_id, user_key, created_at) VALUES (?, ?, ?)", 
          [postId, user.post_key, date], function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to like post' });
            }
            
            // Get updated like count
            db.get("SELECT COUNT(*) as count FROM likes WHERE post_id = ?", [postId], (err, result) => {
              return res.json({ 
                success: true, 
                action: 'liked', 
                count: result ? result.count : 0 
              });
            });
        });
      }
    });
  });
});

// Favorite a post
app.post('/favorite-post/:id', (req, res) => {
  const postId = req.params.id;
  const { postKey } = req.body;
  
  validatePostKey(postKey, (user) => {
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid post key. Please check for typos and try again.' });
    }
    
    const date = moment().format('YYYY-MM-DD HH:mm:ss');
    
    // Check if already favorited
    db.get("SELECT id FROM favorites WHERE post_id = ? AND user_key = ?", [postId, user.post_key], (err, favorite) => {
      if (favorite) {
        // Remove from favorites
        db.run("DELETE FROM favorites WHERE id = ?", [favorite.id], function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Failed to unfavorite post' });
          }
          return res.json({ success: true, action: 'unfavorited' });
        });
      } else {
        // Add to favorites
        db.run("INSERT INTO favorites (post_id, user_key, created_at) VALUES (?, ?, ?)", 
          [postId, user.post_key, date], function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to favorite post' });
            }
            return res.json({ success: true, action: 'favorited' });
        });
      }
    });
  });
});

// Repost
app.post('/repost/:id', (req, res) => {
  const postId = req.params.id;
  const { postKey, comment } = req.body;
  
  // Check for admin keys first
  db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ success: false, message: 'Invalid post key' });
    }
    
    const date = moment().format('YYYY-MM-DD HH:mm:ss');
    
    // Create the repost
    db.run("INSERT INTO reposts (original_post_id, user_key, comment, created_at) VALUES (?, ?, ?, ?)", 
      [postId, postKey, comment || null, date], function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to repost' });
        }
        return res.json({ success: true, message: 'Reposted successfully' });
    });
  });
});

// Add friend
app.post('/add-friend/:username', (req, res) => {
  const targetUsername = req.params.username;
  const { postKey } = req.body;
  
  // Check for admin keys first
  const validAdminKeys = ['pibble_power3', '1pibble'];
  if (validAdminKeys.includes(postKey)) {
    // Find target user
    db.get("SELECT * FROM users WHERE username = ?", [targetUsername], (err, targetUser) => {
      if (err || !targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // Check if self
      if (targetUser.post_key === postKey) {
        return res.status(400).json({ success: false, message: 'Cannot add yourself as a friend' });
      }
      
      const date = moment().format('YYYY-MM-DD HH:mm:ss');
      
      // Check if friend request already exists
      db.get(`SELECT * FROM friends 
              WHERE (user_key_1 = ? AND user_key_2 = ?) OR (user_key_1 = ? AND user_key_2 = ?)`,
              [postKey, targetUser.post_key, targetUser.post_key, postKey], (err, friendship) => {
        
        if (friendship) {
          return res.status(400).json({ 
            success: false, 
            message: 'Friend request already exists',
            status: friendship.status 
          });
        }
        
        // Create friend request
        db.run("INSERT INTO friends (user_key_1, user_key_2, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", 
          [postKey, targetUser.post_key, 'pending', date, date], function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to send friend request' });
            }
            return res.json({ success: true, message: 'Friend request sent' });
        });
      });
    });
    return; // Added return to avoid running the next validation
  }
  
  // Regular user validation
  db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, requestingUser) => {
    if (err || !requestingUser) {
      return res.status(401).json({ success: false, message: 'Invalid post key' });
    }
    
    // Find target user
    db.get("SELECT * FROM users WHERE username = ?", [targetUsername], (err, targetUser) => {
      if (err || !targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // Check if self
      if (targetUser.post_key === postKey) {
        return res.status(400).json({ success: false, message: 'Cannot add yourself as a friend' });
      }
      
      const date = moment().format('YYYY-MM-DD HH:mm:ss');
      
      // Check if friend request already exists
      db.get(`SELECT * FROM friends 
              WHERE (user_key_1 = ? AND user_key_2 = ?) OR (user_key_1 = ? AND user_key_2 = ?)`,
              [postKey, targetUser.post_key, targetUser.post_key, postKey], (err, friendship) => {
        
        if (friendship) {
          return res.status(400).json({ 
            success: false, 
            message: 'Friend request already exists',
            status: friendship.status 
          });
        }
        
        // Create friend request
        db.run("INSERT INTO friends (user_key_1, user_key_2, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", 
          [postKey, targetUser.post_key, 'pending', date, date], function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to send friend request' });
            }
            return res.json({ success: true, message: 'Friend request sent' });
        });
      });
    });
  });
});

// Get user favorites
app.get('/favorites', (req, res) => {
  const { postKey } = req.query;
  
  // Check for missing post key
  if (!postKey) {
    return res.render('favorites', { error: 'Post key is required. Please provide your post key.' });
  }
  
  // Validate user
  db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
    if (err) {
      console.error("Database error in favorites route:", err);
      return res.render('favorites', { error: 'A database error occurred. Please try again later.' });
    }
    
    if (!user) {
      return res.render('favorites', { error: 'Invalid post key. Please check for typos and try again.' });
    }
    
    // Get favorited posts with LEFT JOINs to handle missing related records
    db.all(`SELECT posts.*, users.username, users.profile_pic,
            categories.name AS category_name, categories.id AS category_id
            FROM favorites
            LEFT JOIN posts ON favorites.post_id = posts.id
            LEFT JOIN users ON posts.user_key = users.post_key
            LEFT JOIN categories ON posts.category_id = categories.id
            WHERE favorites.user_key = ?
            ORDER BY favorites.created_at DESC`, [postKey], (err, posts) => {
      
      if (err) {
        console.error("Database error fetching favorites:", err);
        return res.render('favorites', { error: 'Failed to load favorites. Please try again later.' });
      }
      
      // Filter out any null records (from deleted posts)
      const validPosts = posts.filter(post => post.id !== null);
      
      res.render('favorites', { posts: validPosts, user });
    });
  });
});

// Get user friends
app.get('/friends', (req, res) => {
  const { postKey } = req.query;
  
  if (!postKey) {
    return res.render('friends', { loggedIn: false });
  }
  
  // Validate user with our helper function
  validatePostKey(postKey, (currentUser) => {
    if (!currentUser) {
      return res.render('friends', { loggedIn: false, error: 'Invalid post key. Please check for typos and try again.' });
    }
    
    // Get accepted friends
    db.all(`SELECT users.username, users.profile_pic, users.role, friends.updated_at as friend_since,
            CASE 
              WHEN friends.user_key_1 = ? THEN friends.user_key_2
              ELSE friends.user_key_1
            END as friend_key
            FROM friends
            JOIN users ON (
              CASE 
                WHEN friends.user_key_1 = ? THEN friends.user_key_2
                ELSE friends.user_key_1
              END = users.post_key
            )
            WHERE (friends.user_key_1 = ? OR friends.user_key_2 = ?) AND friends.status = 'accepted'
            ORDER BY friends.updated_at DESC`, 
            [postKey, postKey, postKey, postKey], (err, friends) => {
      
      if (err) {
        return res.render('friends', { 
          loggedIn: true, 
          currentUser, 
          error: 'Failed to load friends',
          friends: [],
          pendingRequests: []
        });
      }
      
      // Get pending requests
      db.all(`SELECT users.username, users.profile_pic, friends.created_at as request_date,
              CASE 
                WHEN friends.user_key_1 = ? THEN 'outgoing'
                ELSE 'incoming'
              END as direction,
              CASE 
                WHEN friends.user_key_1 = ? THEN friends.user_key_2
                ELSE friends.user_key_1
              END as other_user_key
              FROM friends
              JOIN users ON (
                CASE 
                  WHEN friends.user_key_1 = ? THEN friends.user_key_2
                  ELSE friends.user_key_1
                END = users.post_key
              )
              WHERE (friends.user_key_1 = ? OR friends.user_key_2 = ?) AND friends.status = 'pending'`, 
              [postKey, postKey, postKey, postKey, postKey], (err, pendingRequests) => {
        
        res.render('friends', { 
          loggedIn: true, 
          currentUser, 
          friends, 
          pendingRequests: pendingRequests || []
        });
      });
    });
  });
});

// Friend request response (accept/reject)
app.post('/friend-request/:action', (req, res) => {
  const action = req.params.action; // 'accept' or 'reject'
  const { postKey, friendKey } = req.body;
  
  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }
  
  // Validate user
  db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ success: false, message: 'Invalid post key' });
    }
    
    const date = moment().format('YYYY-MM-DD HH:mm:ss');
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    
    // Update friend request
    db.run(`UPDATE friends SET status = ?, updated_at = ? 
            WHERE user_key_2 = ? AND user_key_1 = ? AND status = 'pending'`, 
            [newStatus, date, postKey, friendKey], function(err) {
      
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: `Failed to ${action} friend request`
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Friend request not found or already processed'
        });
      }
      
      return res.json({ 
        success: true, 
        message: `Friend request ${action}ed`
      });
    });
  });
});

// Chat history endpoint
app.get('/chat-history', (req, res) => {
  const { userKey, friendKey } = req.query;
  
  if (!userKey || !friendKey) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }
  
  // Validate both users
  db.get("SELECT * FROM users WHERE post_key IN (?, ?)", [userKey, friendKey], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check if they are friends
    db.get(`SELECT * FROM friends 
            WHERE ((user_key_1 = ? AND user_key_2 = ?) OR (user_key_1 = ? AND user_key_2 = ?)) 
            AND status = 'accepted'`, 
            [userKey, friendKey, friendKey, userKey], (err, friendship) => {
      
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (!friendship) {
        return res.status(403).json({ success: false, message: 'Not friends' });
      }
      
      // Get messages between the users
      db.all(`SELECT * FROM friend_messages
              WHERE (sender_key = ? AND receiver_key = ?) OR (sender_key = ? AND receiver_key = ?)
              ORDER BY created_at ASC`, 
              [userKey, friendKey, friendKey, userKey], (err, messages) => {
        
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to load messages' });
        }
        
        res.json({ success: true, messages });
        
        // Mark messages as read
        if (messages.some(m => m.sender_key === friendKey && !m.read_at)) {
          const now = moment().format('YYYY-MM-DD HH:mm:ss');
          db.run(`UPDATE friend_messages SET read_at = ? 
                  WHERE sender_key = ? AND receiver_key = ? AND read_at IS NULL`, 
                  [now, friendKey, userKey]);
        }
      });
    });
  });
});

// Rename upload-chat-image to upload-chat-media
app.post('/upload-chat-media', upload.single('media'), (req, res) => {
  try {
    console.log('Upload-chat-media endpoint called');
    
    // Log request details for debugging
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request file:', req.file ? `Received ${req.file.mimetype}, size: ${req.file.size}` : 'No file received');
    
    // If no file in request, return error as JSON
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file was uploaded' });
    }
    
    const { senderKey, receiverKey } = req.body;
    
    if (!senderKey || !receiverKey) {
      console.log('Missing sender or receiver key:', { sender: !!senderKey, receiver: !!receiverKey });
      return res.status(400).json({ success: false, message: 'Missing sender or receiver key' });
    }
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'secure-uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const mediaPath = `secure-uploads/${req.file.filename}`;
    const date = moment().format('YYYY-MM-DD HH:mm:ss');
    
    // Determine if it's video based on file mime type
    const isVideo = req.file.mimetype.startsWith('video/');
    console.log(`Processing ${isVideo ? 'video' : 'image'} upload: ${req.file.filename}`);
    
    // Insert message with media
    db.run(`INSERT INTO friend_messages 
            (sender_key, receiver_key, message, image_path, created_at) 
            VALUES (?, ?, ?, ?, ?)`, 
            [senderKey, receiverKey, '', mediaPath, date], function(err) {
      
      if (err) {
        console.error('Database error in upload-chat-media:', err);
        return res.status(500).json({ success: false, message: 'Failed to save message' });
      }
      
      const messageId = this.lastID;
      
      // Notify users via Socket.IO
      io.to(`chat_${senderKey}_${receiverKey}`).emit('private_message', {
        id: messageId,
        sender: senderKey,
        receiver: receiverKey,
        message: '',
        image: mediaPath,
        timestamp: date
      });
      
      return res.json({ success: true, messageId, mediaPath: mediaPath });
    });
  } catch (error) {
    console.error('Error in upload-chat-media:', error);
    // Ensure we return JSON even on errors
    return res.status(500).json({ success: false, message: 'Server error processing upload' });
  }
});

// Add upload-profile-media endpoint
app.post('/upload-profile-media', upload.single('media'), (req, res) => {
  const { postKey } = req.body;
  
  if (!req.file || !postKey) {
    return res.status(400).json({ success: false, message: 'Missing file or post key' });
  }
  
  // Validate post key
  validatePostKey(postKey, (user) => {
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid post key' });
    }
    
    const mediaPath = `secure-uploads/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      message: 'Media uploaded successfully',
      mediaPath
    });
  });
});

// Helper function to validate post keys
function validatePostKey(postKey, callback) {
  if (!postKey || typeof postKey !== 'string') {
    console.log('Post key validation failed: empty or invalid type');
    return callback(null);
  }
  
  // Trim whitespace and ensure consistent format
  const cleanKey = postKey.trim();
  if (cleanKey === '') {
    console.log('Post key validation failed: empty after trim');
    return callback(null);
  }
  
  // Check for admin keys first (case sensitive special keys)
  const validAdminKeys = ['pibble_power3', '1pibble'];
  if (validAdminKeys.includes(cleanKey)) {
    console.log('Admin key validated');
    // Look up the admin user in the database
    db.get("SELECT * FROM users WHERE post_key = ?", [cleanKey], (err, user) => {
      if (err || !user) {
        // If admin key not found in database, create a default admin user object
        console.log(`Admin key ${cleanKey} not found in database, creating temporary user object`);
        const adminUser = {
          post_key: cleanKey,
          username: cleanKey === 'pibble_power3' ? 'Tulip' : 'Admin',
          profile_pic: 'uploads/default-avatar.png',
          role: 'Admin'
        };
        return callback(adminUser);
      }
      // Admin user found in database
      callback(user);
    });
    return;
  }
  
  // For regular users, do a database lookup
  console.log(`Validating user post key (${cleanKey.length} chars)`);
  db.get("SELECT * FROM users WHERE post_key = ?", [cleanKey], (err, user) => {
    if (err) {
      console.error('Database error during post key validation:', err.message);
      return callback(null);
    }
    if (!user) {
      console.log('Post key not found in database');
      return callback(null);
    }
    callback(user);
  });
}

// Validate if a user owns a profile
app.post('/validate-profile-owner', bodyParser.json(), (req, res) => {
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

// Get edit profile page
app.get('/edit-profile', (req, res) => {
  const { postKey } = req.query;
  
  if (!postKey) {
    return res.status(400).send('Post key is required');
  }

  validatePostKey(postKey, (user) => {
    if (!user) {
      return res.status(401).send('Invalid post key. Please check for typos and try again.');
    }
    
    // Render the edit profile page with user data
    res.render('edit-profile', { user });
  });
});

// Create a secure route to serve files from the secure-uploads directory
app.get('/secure-file/:filename', (req, res) => {
  const { filename } = req.params;
  const { token } = req.query;
  
  // Basic security check - we can add more robust checks here
  if (!filename || !token) {
    return res.status(403).send('Unauthorized access');
  }
  
  // Verify token - this is a simple check, could be enhanced
  // The token should match a hash of the filename or be validated against a session
  const isValidToken = token === 'public' || validateFileToken(token, filename);
  
  if (!isValidToken) {
    return res.status(403).send('Invalid access token');
  }
  
  // Sanitize filename to prevent path traversal
  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(__dirname, 'secure-uploads', sanitizedFilename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  // Serve the file
  res.sendFile(filePath);
});

// Helper function to validate file access tokens
function validateFileToken(token, filename) {
  // Simple implementation - in a real app, this would check against a database
  // or validate a JWT token with proper payload
  // For now, just check if it's a valid post key
  return new Promise((resolve) => {
    db.get("SELECT * FROM users WHERE post_key = ?", [token], (err, user) => {
      resolve(!!user);
    });
  });
}

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});