document.addEventListener('DOMContentLoaded', function() {
  // The specific arrow key sequence: Up, Left, Right, Down, Down
  const aeroSequence = [38, 37, 39, 40, 40];
  const keyPressed = [];
  let aeroModeActive = false;

  // Event listener for keydown
  document.addEventListener('keydown', function(event) {
    // Get the key code
    const key = event.keyCode || event.which;
    
    // Add the key to our sequence
    keyPressed.push(key);
    
    // Keep only the last 5 keys pressed
    if (keyPressed.length > 5) {
      keyPressed.shift();
    }
    
    // Check if the sequence matches
    if (keyPressed.join(',') === aeroSequence.join(',')) {
      // Toggle aero mode
      aeroModeActive = !aeroModeActive;
      
      // Toggle the stylesheet
      document.body.classList.toggle('aero-mode');
      
      // Reset the sequence
      keyPressed.length = 0;
      
      // Show a message
      const message = document.createElement('div');
      message.className = 'aero-mode-message';
      message.textContent = aeroModeActive ? 'Frutiger Aero Mode Activated' : 'Y2K Mode Restored';
      document.body.appendChild(message);
      
      // Save preference in localStorage
      localStorage.setItem('aeroModeActive', aeroModeActive);
      
      // Remove the message after 2 seconds
      setTimeout(() => {
        document.body.removeChild(message);
      }, 2000);
    }
  });
  
  // Check if aero mode was previously activated
  if (localStorage.getItem('aeroModeActive') === 'true') {
    aeroModeActive = true;
    document.body.classList.add('aero-mode');
  }
});
