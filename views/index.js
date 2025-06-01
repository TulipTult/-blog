const express = require('express');
const router = express.Router();
const db = require('../db');

// Home page route
router.get('/', (req, res) => {
  // Query to get all categories with post counts and creator names
  db.all(`SELECT categories.*, 
          COUNT(posts.id) AS post_count, 
          users.username AS creator_name
          FROM categories
          LEFT JOIN posts ON categories.id = posts.category_id
          LEFT JOIN users ON categories.created_by = users.post_key
          GROUP BY categories.id
          ORDER BY categories.name`, [], (err, categories) => {
    
    if (err) {
      console.error('Error fetching categories:', err);
      return res.render('index', { categories: [] });
    }
    
    // Render index with categories data
    res.render('index', { categories });
  });
});

// Category view route
router.get('/category/:id', (req, res) => {
  const categoryId = req.params.id;
  
  // Query to get category details
  db.get('SELECT * FROM categories WHERE id = ?', [categoryId], (err, category) => {
    if (err) {
      console.error('Error fetching category:', err);
      return res.status(500).send('Server error');
    }
    
    if (!category) {
      return res.status(404).render('404', { message: 'Category not found' });
    }
    
    // Query to get all posts in this category
    db.all(`SELECT posts.*, users.username AS author 
            FROM posts 
            LEFT JOIN users ON posts.user_key = users.post_key 
            WHERE posts.category_id = ? 
            ORDER BY posts.date DESC`, [categoryId], (err, posts) => {
      if (err) {
        console.error('Error fetching posts:', err);
        return res.status(500).send('Server error');
      }
      
      // Render the category template with category and posts data
      res.render('category', { category, posts });
    });
  });
});

// Single post view
router.get('/post/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await db.getPostById(postId);
    
    if (!post) {
      return res.status(404).render('404', { message: 'Post not found' });
    }
    
    res.render('post', { post });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).send('Server error');
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about');
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact');
});

module.exports = router;
