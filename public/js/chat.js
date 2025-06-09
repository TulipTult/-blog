document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const postKeyInput = document.getElementById('postKey');
  const loginError = document.getElementById('login-error');
  const chatInterface = document.getElementById('chat-interface');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const messagesContainer = document.getElementById('messages');
  const usersList = document.getElementById('users-list');
  const userAvatar = document.getElementById('user-avatar');
  const usernameDisplay = document.getElementById('username');
  
  // Connect to Socket.IO
  const socket = io();
  let currentUser = null;
  
  // Login with post key
  loginBtn.addEventListener('click', function() {
    const postKey = postKeyInput.value.trim();
    
    if (!postKey) {
      loginError.textContent = 'Please enter your post key';
      return;
    }
    
    // Authenticate with the server
    socket.emit('authenticate', { postKey });
  });
  
  // Update the profile picture display function
  function displayProfilePic(picPath) {
    if (!picPath) return '/secure-file/default-avatar.png?token=public';
    
    // Get just the filename
    const filename = picPath.split('/').pop();
    return `/secure-file/${filename}?token=public`;
  }

  // Handle authentication response
  socket.on('auth_response', function(data) {
    if (data.success) {
      // Store user data
      currentUser = data.user;
      
      // Show chat interface and hide login form
      loginForm.style.display = 'none';
      chatInterface.style.display = 'block';
      
      // Update user info display
      userAvatar.src = displayProfilePic(currentUser.profile_pic);
      usernameDisplay.textContent = currentUser.username;
      
      // Focus on message input
      messageInput.focus();
      
      // Scroll to the bottom of messages
      scrollToBottom();
    } else {
      // Show error message
      loginError.textContent = data.message || 'Authentication failed. Check your post key.';
    }
  });
  
  // Send message when clicking send button
  sendBtn.addEventListener('click', sendMessage);
  
  // Send message when pressing Enter in the input field
  messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  
  // Function to send a message
  function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Send the message to the server
    socket.emit('chat_message', { message });
    
    // Clear the input field
    messageInput.value = '';
    messageInput.focus();
  }
  
  // Track messages to prevent duplicates
  const processedMessages = new Set();
  
  // Display a new message
  socket.on('new_message', function(data) {
    // Generate a unique ID for this message to prevent duplicates
    const messageId = `${data.user.post_key}_${data.timestamp}_${data.message.substring(0, 10)}`;
    
    // Skip if we've already processed this message
    if (processedMessages.has(messageId)) {
      return;
    }
    
    // Mark as processed
    processedMessages.add(messageId);
    
    // Limit the size of our tracking set to prevent memory issues
    if (processedMessages.size > 100) {
      // Remove the oldest entry (first in the set)
      processedMessages.delete(processedMessages.values().next().value);
    }
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    
    // Add 'own-message' class if this user sent the message
    if (currentUser && data.user.post_key === currentUser.post_key) {
      messageEl.classList.add('own-message');
    }
    
    // Create message content
    messageEl.innerHTML = `
      <div class="message-header">
        <a href="/profile/${data.user.username}">
          <img class="avatar" src="${displayProfilePic(data.user.profile_pic)}" alt="${data.user.username}">
        </a>
        <a href="/profile/${data.user.username}" class="username">${data.user.username}</a>
        <small class="date">${formatTime(data.timestamp)}</small>
      </div>
      <div class="message-content">${escapeHTML(data.message)}</div>
    `;
    
    // Add to messages container
    messagesContainer.appendChild(messageEl);
    
    // Scroll to the bottom
    scrollToBottom();
  });
  
  // Update users list
  socket.on('users_update', function(data) {
    usersList.innerHTML = '';
    
    data.users.forEach(user => {
      const userEl = document.createElement('li');
      userEl.innerHTML = `
        <a href="/profile/${user.username}" class="user-link">
          <img src="${displayProfilePic(user.profile_pic)}" alt="${user.username}">
          <span>${user.username}</span>
        </a>
      `;
      usersList.appendChild(userEl);
    });
  });
  
  // Handle system messages
  socket.on('system_message', function(data) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message system-message';
    messageEl.innerHTML = `
      <div class="message-content system">${data.message}</div>
    `;
    messagesContainer.appendChild(messageEl);
    scrollToBottom();
  });
  
  // Scroll messages to bottom
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Format time as HH:MM
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  // Escape HTML to prevent XSS
  function escapeHTML(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
