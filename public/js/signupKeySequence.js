document.addEventListener('DOMContentLoaded', function() {
  // Special key sequence for accessing signup page: ↑ ↑ ↑ ↑ ↑ ↓ (five ups, one down)
  const signupSequence = [38, 38, 38, 38, 38, 40]; // Arrow key codes
  // Special key sequence for accessing profile editor: ↓ ← ← (down, left, left)
  const profileEditorSequence = [40, 37, 37]; // Down, Left, Left
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
    
    // Check if the signup sequence matches
    if (keyPressed.join(',') === signupSequence.join(',')) {
      // Reset the sequence
      keyPressed.length = 0;
      
      // Redirect to the signup page
      window.location.href = '/signup';
      
      // Show a message briefly
      showKeySequenceMessage('Secret signup page unlocked!');
    }
    
    // Check if the profile editor sequence matches
    if (keyPressed.slice(-3).join(',') === profileEditorSequence.join(',')) {
      // Reset the sequence
      keyPressed.length = 0;
      
      // Prompt for post key
      const postKey = prompt('Enter your post key to access profile editor:');
      if (postKey) {
        // Redirect to the edit profile page with the post key
        window.location.href = `/edit-profile?postKey=${encodeURIComponent(postKey)}`;
        
        // Show a message briefly
        showKeySequenceMessage('Accessing profile editor...');
      }
    }
  });
  
  // Helper function to show message
  function showKeySequenceMessage(text) {
    const message = document.createElement('div');
    message.className = 'key-sequence-message';
    message.textContent = text;
    document.body.appendChild(message);
    
    // Remove the message after 2 seconds
    setTimeout(() => {
      if (document.body.contains(message)) {
        document.body.removeChild(message);
      }
    }, 2000);
  }
});
