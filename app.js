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

// Create HTTP server for Socket.IO
const server = http.createServer(app);
const io = socketIO(server);

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

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
        ["pibble_power3", "Tulip", "uploads/default-avatar.png", 
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
const defaultAvatarPath = path.join(__dirname, 'public', 'uploads', 'default-avatar.png');
if (!fs.existsSync(defaultAvatarPath)) {
  console.log("Creating default avatar image...");
  // Simple 32x32 colored square as default avatar - basic PNG data
  const defaultAvatarData = Buffer.from(
    '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' +
    'AABJRU5ErkJggg==',
    'base64'
  );
  // Make sure the directory exists
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
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

    // Validate post key against database
    db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
      if (err) {
        console.error("Database error during chat authentication:", err.message);
        socket.emit('auth_response', { success: false, message: 'Authentication error' });
        return;
      }

      if (!user) {
        socket.emit('auth_response', { success: false, message: 'Invalid post key' });
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

    io.to('main').emit('new_message', messageData);
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
      const profilePic = req.file ? `uploads/${req.file.filename}` : 'uploads/default-avatar.png';
      
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

    db.all(`SELECT posts.*, users.username, users.profile_pic 
            FROM posts 
            JOIN users ON posts.user_key = users.post_key
            WHERE posts.category_id = ?
            ORDER BY date DESC`, [categoryId], (err, posts) => {
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
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const date = moment().format('YYYY-MM-DD HH:mm:ss');
  const category = categoryId || 1;

  // Modified section: Check for admin post keys as well
  const validKeys = ['pibble_power3', '1pibble'];
  if (validKeys.includes(postKey)) {
    // Directly allow these admin keys to create posts
    db.run(`INSERT INTO posts (title, content, user_key, category_id, date, image_path) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            [title, content, postKey, category, date, imagePath], function(err) {
      if (err) {
        console.error(err.message);
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
  } else {
    // Check regular users via the database
    db.get("SELECT * FROM users WHERE post_key = ?", [postKey], (err, user) => {
      if (err || !user) {
        return db.all(`SELECT * FROM categories ORDER BY name`, [], (err, categories) => {
          return res.render('create-post', { 
            error: 'Invalid post key',
            title,
            content,
            categories
          });
        });
      }

      db.run(`INSERT INTO posts (title, content, user_key, category_id, date, image_path) 
              VALUES (?, ?, ?, ?, ?, ?)`, 
              [title, content, postKey, category, date, imagePath], function(err) {
        if (err) {
          return console.error(err.message);
        }
        res.redirect('/category/' + category);
      });
    });
  }
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
    
    db.all(`SELECT posts.*, categories.name AS category_name 
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

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
