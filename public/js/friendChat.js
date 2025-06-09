document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const messageArea = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-text');
  const sendButton = document.getElementById('send-message');
  const attachMediaBtn = document.getElementById('attach-media');
  const mediaUpload = document.getElementById('media-upload');
  
  // Set up media upload handlers
  attachMediaBtn.addEventListener('click', function() {
    if (!authenticated) {
      chatAuthModal.style.display = 'block';
      return;
    }
    if (currentChatFriend) {
      // Show menu to choose between image/video upload or GIF
      const menu = document.createElement('div');
      menu.className = 'media-upload-menu';
      menu.innerHTML = `
        <button class="upload-option" id="upload-media"><i class="fas fa-file-upload"></i> Upload Image/Video</button>
        <button class="upload-option" id="insert-gif"><i class="fas fa-film"></i> Insert GIF</button>
      `;
      
      document.querySelector('.chat-input-area').appendChild(menu);
      
      document.getElementById('upload-media').addEventListener('click', function() {
        menu.remove();
        mediaUpload.click();
      });
      
      document.getElementById('insert-gif').addEventListener('click', function() {
        menu.remove();
        showGifPicker();
      });
      
      // Auto remove menu when clicking elsewhere
      setTimeout(() => {
        document.addEventListener('click', function removeMenu(e) {
          if (!menu.contains(e.target) && e.target !== attachMediaBtn) {
            menu.remove();
            document.removeEventListener('click', removeMenu);
          }
        });
      }, 10);
    } else {
      alert('Please select a friend to chat with first');
    }
  });
  
  mediaUpload.addEventListener('change', function() {
    if (!authenticated || !currentChatFriend || !this.files.length) return;
    
    const file = this.files[0];
    const isVideo = file.type.startsWith('video/');
    const formData = new FormData();
    
    formData.append('media', file);
    // Make sure we're using the correct property name
    formData.append('senderKey', currentUserKey); 
    formData.append('receiverKey', currentChatFriend.key);
    
    // Show uploading indicator
    const tempId = 'upload-' + Date.now();
    addMessageToChat(`Uploading ${isVideo ? 'video' : 'image'}...`, false, new Date().toISOString(), null, null, tempId);
    
    // Add file size check
    if (file.size > 50 * 1024 * 1024) {
      const uploadingElement = document.getElementById(tempId);
      if (uploadingElement) {
        uploadingElement.innerHTML = '<div class="message-text error">Error: File size exceeds 50MB limit</div>';
      }
      this.value = '';
      return;
    }
    
    fetch('/upload-chat-media', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (!response.ok) {
        console.error('Upload response error:', response.status);
        return response.text().then(text => {
          try {
            // Try to parse as JSON first
            return JSON.parse(text);
          } catch (e) {
            // Check if response contains "File too large" text
            if (text.includes('File too large')) {
              return { 
                success: false, 
                message: 'File size exceeds the 50MB limit. Please choose a smaller file.'
              };
            }
            // If not valid JSON, return a formatted error object
            return { 
              success: false, 
              message: `Server returned an error (${response.status}). Please try again.` 
            };
          }
        });
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Replace uploading indicator with successful upload
        const uploadingElement = document.getElementById(tempId);
        if (uploadingElement) {
          uploadingElement.remove();
        }
        
        // The message will be displayed via socket event
        console.log(`${isVideo ? 'Video' : 'Image'} uploaded successfully`);
      } else {
        // Show error in place of uploading indicator
        const uploadingElement = document.getElementById(tempId);
        if (uploadingElement) {
          uploadingElement.innerHTML = `<div class="message-text error">Failed to upload: ${data.message || 'Unknown error'}</div>`;
        }
      }
    })
    .catch(err => {
      console.error("Error uploading media:", err);
      // Show error in place of uploading indicator
      const uploadingElement = document.getElementById(tempId);
      if (uploadingElement) {
        uploadingElement.innerHTML = '<div class="message-text error">Error uploading media: ' + (err.message || 'Unknown error') + '</div>';
      }
    });
    
    this.value = '';
  });
  
  // Socket connection
  const socket = io();
  let currentChatFriend = null;
  let authenticated = false;
  let currentUserKey = null;
  
  // Initialize GIF picker
  let gifPickerVisible = false;
  const gifCategories = ['trending', 'reactions', 'memes', 'anime'];
  
  // Friend selection
  friendItems.forEach(item => {
    item.addEventListener('click', function() {
      if (!authenticated) {
        currentChatFriend = { 
          key: this.dataset.friendKey, 
          name: this.querySelector('.friend-name').textContent 
        };
        document.getElementById('chat-auth-modal').style.display = 'block';
      } else {
        friendItems.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        loadChatHistory(this.dataset.friendKey, this.querySelector('.friend-name').textContent);
      }
    });
  });
  
  // Chat authentication
  document.querySelector('#chat-auth-modal .close-modal').addEventListener('click', () => {
    document.getElementById('chat-auth-modal').style.display = 'none';
  });
  
  document.getElementById('auth-chat').addEventListener('click', function() {
    const postKey = document.getElementById('chat-post-key').value.trim();
    if (!postKey) {
      document.getElementById('chat-auth-message').textContent = 'Please enter your post key';
      document.getElementById('chat-auth-message').className = 'request-message error';
      return;
    }
    
    // Validate post key
    socket.emit('validate_key', { postKey });
  });
  
  // Socket event handlers
  socket.on('key_validated', function(data) {
    if (data.valid) {
      authenticated = true;
      currentUserKey = data.postKey;
      document.getElementById('chat-auth-modal').style.display = 'none';
      
      // Enable chat interface
      messageInput.disabled = false;
      sendButton.disabled = false;
      
      // Initialize chat with selected friend
      if (currentChatFriend) {
        // Find and highlight the friend in the sidebar
        friendItems.forEach(item => {
          if (item.dataset.friendKey === currentChatFriend.key) {
            item.classList.add('active');
          }
        });
        
        loadChatHistory(currentChatFriend.key, currentChatFriend.name);
        
        // Join private chat room
        socket.emit('join_private_chat', { 
          userKey: currentUserKey,
          friendKey: currentChatFriend.key
        });
      }
    } else {
      document.getElementById('chat-auth-message').textContent = 'Invalid post key';
      document.getElementById('chat-auth-message').className = 'request-message error';
    }
  });
  
  // Receive message
  socket.on('private_message', function(data) {
    if (currentChatFriend && (data.sender === currentChatFriend.key || data.receiver === currentChatFriend.key)) {
      addMessageToChat(data.message, data.sender !== currentUserKey, data.timestamp, data.image, data.gif);
    }
  });
  
  // Send message
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  function sendMessage() {
    if (!authenticated || !currentChatFriend) return;
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Send message to server
    socket.emit('send_private_message', {
      sender: currentUserKey,
      receiver: currentChatFriend.key,
      message: message,
      timestamp: new Date().toISOString()
    });
    
    // Add message locally
    addMessageToChat(message, false, new Date().toISOString());
    
    // Clear input
    messageInput.value = '';
  }
  
  function showGifPicker() {
    if (gifPickerVisible) return;
    
    const gifPicker = document.createElement('div');
    gifPicker.className = 'gif-picker';
    gifPicker.innerHTML = `
      <div class="gif-search">
        <input type="text" placeholder="Search GIFs..." id="gif-search">
        <div class="gif-categories">
          ${gifCategories.map(cat => `<button class="gif-cat-btn" data-category="${cat}">${cat}</button>`).join('')}
        </div>
      </div>
      <div class="gif-results"></div>
    `;
    
    document.querySelector('.chat-area').appendChild(gifPicker);
    gifPickerVisible = true;
    
    // Load trending GIFs by default
    loadGifs('trending');
    
    // Search functionality
    document.getElementById('gif-search').addEventListener('input', function() {
      const query = this.value.trim();
      if (query) {
        loadGifs('search', query);
      } else {
        loadGifs('trending');
      }
    });
    
    // Category buttons
    document.querySelectorAll('.gif-cat-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        loadGifs(this.dataset.category);
      });
    });
    
    // Close when clicking outside
    document.addEventListener('click', function closeGifPicker(e) {
      if (!gifPicker.contains(e.target) && !attachMediaBtn.contains(e.target)) {
        gifPicker.remove();
        gifPickerVisible = false;
        document.removeEventListener('click', closeGifPicker);
      }
    });
  }
  
  function loadGifs(category, query = '') {
    // In a real app, this would call a GIF API like GIPHY or Tenor
    // For this demo, we'll use placeholder GIFs
    const results = document.querySelector('.gif-results');
    results.innerHTML = '<div class="loading-gifs">Loading GIFs...</div>';
    
    // In a real implementation, this would be an API call
    setTimeout(() => {
      results.innerHTML = '';
      // Create sample GIFs (in a real app, these would come from the API)
      const gifUrls = [
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNDQyYXFzMm51Nm04MXFneWx1MGFrdmR0ajkwM2R5dmFzczA2aXpyZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlHFRbmaZtBRhXG/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWEweDF6bm5odW93cXA5eWhtdHY2Y2ZudjJoMGZjb251NjU5YnVydSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hTh9bKbT8lE6OVXJNo/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXRpMWNrbnY4Z3F4emRrdzM3NWpqdWdxaTNnNnVhM2JpN3Z5ajhsdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/kaq6GnxDlJaBq/giphy.gif'
      ];
      
      gifUrls.forEach(url => {
        const gifWrapper = document.createElement('div');
        gifWrapper.className = 'gif-item';
        
        const gif = document.createElement('img');
        gif.src = url;
        gif.alt = 'GIF';
        
        gif.addEventListener('click', function() {
          if (!authenticated || !currentChatFriend) return;
          
          // Send GIF message
          socket.emit('send_private_message', {
            sender: currentUserKey,
            receiver: currentChatFriend.key,
            message: '',
            gif: url,
            timestamp: new Date().toISOString()
          });
          
          // Add GIF locally
          addMessageToChat('', false, new Date().toISOString(), null, url);
          
          // Close gif picker
          document.querySelector('.gif-picker').remove();
          gifPickerVisible = false;
        });
        
        gifWrapper.appendChild(gif);
        results.appendChild(gifWrapper);
      });
    }, 500);
  }
  
  function loadChatHistory(friendKey, friendName) {
    if (!authenticated) return;
    
    currentChatFriend = { key: friendKey, name: friendName };
    messageArea.innerHTML = `<div class="chat-header-info">Chat with ${friendName}</div>`;
    
    // Fetch chat history
    fetch(`/chat-history?userKey=${encodeURIComponent(currentUserKey)}&friendKey=${encodeURIComponent(friendKey)}`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.messages.length > 0) {
          data.messages.forEach(msg => {
            const isReceived = msg.sender_key !== currentUserKey;
            addMessageToChat(msg.message, isReceived, msg.created_at, msg.image_path, msg.gif_url);
          });
          messageArea.scrollTop = messageArea.scrollHeight;
        } else {
          const placeholderMessage = document.createElement('div');
          placeholderMessage.className = 'chat-info-message';
          placeholderMessage.textContent = `Start chatting with ${friendName}`;
          messageArea.appendChild(placeholderMessage);
        }
      })
      .catch(err => {
        console.error("Error loading chat history:", err);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'chat-error-message';
        errorMessage.textContent = "Couldn't load chat history";
        messageArea.appendChild(errorMessage);
      });
  }
  
  function addMessageToChat(message, isReceived, timestamp, mediaPath = null, gifUrl = null, id = null) {
    const messageEl = document.createElement('div');
    messageEl.className = isReceived ? 'message-bubble received' : 'message-bubble sent';
    if (id) messageEl.id = id;
    
    let contentHtml = '';
    
    if (message) {
      contentHtml += `<div class="message-text">${message}</div>`;
    }
    
    if (mediaPath) {
      // Check if it's a video or an image based on file extension
      const fileExtension = mediaPath.split('.').pop().toLowerCase();
      const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'wmv', 'flv', 'mkv'].includes(fileExtension);
      
      // Extract just the filename
      const filename = mediaPath.split('/').pop();
      
      if (isVideo) {
        contentHtml += `<div class="message-video">
          <video controls width="100%">
            <source src="/secure-file/${filename}?token=public" type="video/${fileExtension}">
            Your browser does not support the video tag.
          </video>
        </div>`;
      } else {
        contentHtml += `<div class="message-image"><img src="/secure-file/${filename}?token=public" alt="Shared image" /></div>`;
      }
    }
    
    if (gifUrl) {
      contentHtml += `<div class="message-gif"><img src="${gifUrl}" alt="GIF" /></div>`;
    }
    
    contentHtml += `<div class="message-time">${formatTime(timestamp)}</div>`;
    
    messageEl.innerHTML = contentHtml;
    messageArea.appendChild(messageEl);
    messageArea.scrollTop = messageArea.scrollHeight;
  }
  
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
});
