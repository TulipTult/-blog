const express = require('express');
const router = express.Router();
const db = require('../db');

// Home page route
router.get('/', async (req, res) => {
  try {
    // Get recent blog posts
    const posts = await db.getRecentPosts();
    res.render('index', { posts });
  } catch (error) {
    console.error('Error fetching home page:', error);
    res.status(500).send('Server error');
  }
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
