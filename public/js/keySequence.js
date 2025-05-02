document.addEventListener('DOMContentLoaded', function() {
  // Variables to track the key sequence
  const requiredSequence = [38, 38, 40]; // Up, Up, Down arrow key codes
  const keyPressed = [];
  let deleteControlsVisible = false;

  // Event listener for keydown
  document.addEventListener('keydown', function(event) {
    // Get the key code
    const key = event.keyCode || event.which;
    
    // Add the key to our sequence
    keyPressed.push(key);
    
    // Keep only the last 3 keys pressed
    if (keyPressed.length > 3) {
      keyPressed.shift();
    }
    
    // Check if the sequence matches
    if (keyPressed.join(',') === requiredSequence.join(',')) {
      // Toggle visibility of delete controls
      deleteControlsVisible = !deleteControlsVisible;
      
      // Get all delete controls
      const deleteControls = document.querySelectorAll('.delete-control');
      
      // Toggle their visibility
      deleteControls.forEach(control => {
        control.style.display = deleteControlsVisible ? 'block' : 'none';
      });
      
      // Reset the sequence
      keyPressed.length = 0;
      
      // Show a message
      const message = document.createElement('div');
      message.className = 'key-sequence-message';
      message.textContent = deleteControlsVisible ? 'Delete controls enabled' : 'Delete controls disabled';
      document.body.appendChild(message);
      
      // Remove the message after 2 seconds
      setTimeout(() => {
        document.body.removeChild(message);
      }, 2000);
    }
  });
});
