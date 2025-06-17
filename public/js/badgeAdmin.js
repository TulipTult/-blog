document.addEventListener('DOMContentLoaded', function() {
  // Admin badge key sequence: down arrow 5 times, then right arrow once
  const badgeAdminSequence = [40, 40, 40, 40, 40, 39]; // Down, Down, Down, Down, Down, Right
  const keyPressed = [];
  
  // Event listener for keydown
  document.addEventListener('keydown', function(event) {
    // Get the key code
    const key = event.keyCode || event.which;
    
    // Add the key to our sequence
    keyPressed.push(key);
    
    // Keep only the last 6 keys pressed (max length of our sequences)
    if (keyPressed.length > 6) {
      keyPressed.shift();
    }
    
    // Check if the admin badge sequence matches
    if (keyPressed.join(',') === badgeAdminSequence.join(',')) {
      // Reset the sequence
      keyPressed.length = 0;
      
      // Prompt for admin key
      const adminKey = prompt('Enter admin key:');
      if (!adminKey) return;
      
      // Prompt for badge name
      const badgeName = prompt('Enter badge name to add (joinedTP, contributerTP, coolTP):');
      if (!badgeName) return;
      
      // Get current page username
      const currentPath = window.location.pathname;
      const username = currentPath.split('/profile/')[1];
      
      if (!username) {
        alert('This feature can only be used on profile pages.');
        return;
      }
      
      // Send request to add badge
      fetch('/api/add-badge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          adminKey,
          username,
          badgeName
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showAdminMessage(data.message, 'success');
          // Reload the page after 2 seconds to show new badge
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          showAdminMessage(data.message, 'error');
        }
      })
      .catch(error => {
        console.error('Error adding badge:', error);
        showAdminMessage('Error adding badge. Please try again.', 'error');
      });
    }
  });
  
  // Helper function to show admin message
  function showAdminMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `admin-message ${type}`;
    message.textContent = text;
    document.body.appendChild(message);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
      if (document.body.contains(message)) {
        document.body.removeChild(message);
      }
    }, 3000);
  }
  
  // Add admin message styles
  const style = document.createElement('style');
  style.textContent = `
    .admin-message {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      animation: fadeInOut 3s ease-in-out;
    }
    .admin-message.success {
      background-color: rgba(0, 255, 0, 0.8);
    }
    .admin-message.error {
      background-color: rgba(255, 0, 0, 0.8);
    }
    .admin-message.info {
      background-color: rgba(0, 0, 255, 0.8);
    }
    @keyframes fadeInOut {
      0% { opacity: 0; }
      15% { opacity: 1; }
      85% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
});
