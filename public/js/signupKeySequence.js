document.addEventListener('DOMContentLoaded', function() {
  // Special key sequence for accessing signup page: ↑ ↑ ↑ ↑ ↑ ↓ (five ups, one down)
  const signupSequence = [38, 38, 38, 38, 38, 40]; // Arrow key codes
  const keyPressed = [];
  
  // Event listener for keydown
  document.addEventListener('keydown', function(event) {
    // Get the key code
    const key = event.keyCode || event.which;
    
    // Add the key to our sequence
    keyPressed.push(key);
    
    // Keep only the last 6 keys pressed
    if (keyPressed.length > 6) {
      keyPressed.shift();
    }
    
    // Check if the sequence matches
    if (keyPressed.join(',') === signupSequence.join(',')) {
      // Reset the sequence
      keyPressed.length = 0;
      
      // Redirect to the signup page
      window.location.href = '/signup';
      
      // Show a message briefly
      const message = document.createElement('div');
      message.className = 'key-sequence-message';
      message.textContent = 'Secret signup page unlocked!';
      document.body.appendChild(message);
      
      // Remove the message after 2 seconds
      setTimeout(() => {
        if (document.body.contains(message)) {
          document.body.removeChild(message);
        }
      }, 2000);
    }
  });
});
