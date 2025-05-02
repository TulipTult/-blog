document.addEventListener('DOMContentLoaded', function() {
  // Find all delete forms
  const deleteForms = document.querySelectorAll('form[action^="/delete-"]');
  
  // Add submit handler to each form
  deleteForms.forEach(form => {
    form.addEventListener('submit', function(event) {
      // Don't submit the form if there's no post key
      const postKeyInput = form.querySelector('input[name="postKey"]');
      if (!postKeyInput || !postKeyInput.value.trim()) {
        event.preventDefault();
        alert('Please enter a valid post key');
        return false;
      }
      
      // For category deletion, extra confirmation
      if (form.action.includes('/delete-category/')) {
        if (!confirm('Are you sure you want to delete this category? All posts will be moved to the Random category.')) {
          event.preventDefault();
          return false;
        }
      }
      
      // For post deletion, confirm
      if (form.action.includes('/delete-post/')) {
        if (!confirm('Are you sure you want to delete this post?')) {
          event.preventDefault();
          return false;
        }
      }
      
      return true;
    });
  });
});
