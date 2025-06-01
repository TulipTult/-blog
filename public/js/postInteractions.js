document.addEventListener('DOMContentLoaded', function() {
  // Like button click handler
  document.querySelectorAll('.like-btn').forEach(button => {
    button.addEventListener('click', function() {
      const postId = this.dataset.postId;
      const likeCount = this.querySelector('.like-count');
      
      // Prompt for post key
      const postKey = prompt('Enter your post key to like this post:');
      if (!postKey) return;
      
      fetch(`/like-post/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ postKey })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Update the like count with the value from the server
          likeCount.textContent = data.count;
          
          // Toggle heart icon
          const heartIcon = this.querySelector('i');
          if (data.action === 'liked') {
            heartIcon.classList.remove('far');
            heartIcon.classList.add('fas');
            
            // If we're in the category view, this might affect sorting
            if (window.location.pathname.includes('/category/')) {
              // Optional: We could reload the page to reflect new sorting
              // setTimeout(() => window.location.reload(), 1000);
            }
          } else {
            heartIcon.classList.remove('fas');
            heartIcon.classList.add('far');
          }
        } else {
          alert(data.message);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
      });
    });
  });

  // Favorite button click handler
  document.querySelectorAll('.favorite-btn').forEach(button => {
    button.addEventListener('click', function() {
      const postId = this.dataset.postId;
      
      const postKey = prompt('Enter your post key to favorite this post:');
      if (!postKey) return;
      
      fetch(`/favorite-post/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ postKey })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Toggle star icon
          const starIcon = this.querySelector('i');
          if (data.action === 'favorited') {
            starIcon.classList.remove('far');
            starIcon.classList.add('fas');
          } else {
            starIcon.classList.remove('fas');
            starIcon.classList.add('far');
          }
        } else {
          alert(data.message);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
      });
    });
  });

  // Repost button click handler
  document.querySelectorAll('.repost-btn').forEach(button => {
    button.addEventListener('click', function() {
      const postId = this.dataset.postId;
      
      // Show repost modal if it exists
      const repostModal = document.getElementById('repost-modal');
      if (repostModal) {
        // Set the post ID as a data attribute on the modal
        repostModal.dataset.postId = postId;
        repostModal.style.display = 'block';
      } else {
        // Simple prompt flow if no modal exists
        const postKey = prompt('Enter your post key to repost:');
        if (!postKey) return;
        
        const comment = prompt('Add a comment (optional):');
        
        fetch(`/repost/${postId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            postKey,
            comment
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert('Post has been reposted!');
          } else {
            alert(data.message);
          }
        })
        .catch(error => {
          console.error('Error:', error);
          alert('An error occurred. Please try again.');
        });
      }
    });
  });
});
