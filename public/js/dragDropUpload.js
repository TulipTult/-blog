document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('image');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImage = document.getElementById('image-preview');
  const removeButton = document.getElementById('remove-image');
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  // Handle dropped files
  dropArea.addEventListener('drop', handleDrop, false);
  
  // Handle file input change
  fileInput.addEventListener('change', handleFileSelect, false);
  
  // Handle click on drop area
  dropArea.addEventListener('click', function() {
    fileInput.click();
  });
  
  // Handle remove button click
  removeButton.addEventListener('click', removeImage);
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  function highlight() {
    dropArea.classList.add('highlight');
  }
  
  function unhighlight() {
    dropArea.classList.remove('highlight');
  }
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      handleFiles(files);
    }
  }
  
  function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }
  
  function handleFiles(files) {
    const file = files[0]; // Only handle the first file
    
    // Check if file is an image or video
    if (!file.type.match('image.*') && !file.type.match('video.*')) {
      alert('Please select an image or video file.');
      return;
    }
    
    // Update the file input
    // Create a new FileList containing the dropped file
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    
    // Show preview
    showPreview(file);
  }
  
  function showPreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      previewImage.src = e.target.result;
      previewContainer.style.display = 'block';
      dropArea.style.display = 'none';
    }
    reader.readAsDataURL(file);
  }
  
  function removeImage() {
    // Clear file input
    fileInput.value = '';
    
    // Hide preview
    previewContainer.style.display = 'none';
    dropArea.style.display = 'block';
    previewImage.src = '#';
  }
});
