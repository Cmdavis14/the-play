// Create file: scripts/components/loading.js
class LoadingManager {
  constructor() {
    this.loadingOverlay = null;
    this.spinnerSize = 'md';
    this.spinnerColor = 'primary';
    this.setupLoadingOverlay();
  }
  
  setupLoadingOverlay() {
    // Check if the overlay already exists
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      // Create the overlay
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
      
      // Create the spinner
      const spinner = document.createElement('div');
      spinner.className = 'spinner-container';
      spinner.innerHTML = `
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p class="text-white mt-4 font-medium">Loading...</p>
      `;
      
      overlay.appendChild(spinner);
      document.body.appendChild(overlay);
    }
    
    this.loadingOverlay = overlay;
  }
  
  showLoading(message = 'Loading...') {
    // Update message
    const messageElement = this.loadingOverlay.querySelector('p');
    if (messageElement) {
      messageElement.textContent = message;
    }
    
    // Show the overlay
    this.loadingOverlay.classList.remove('hidden');
    
    // Disable scrolling on body
    document.body.style.overflow = 'hidden';
  }
  
  hideLoading() {
    // Hide the overlay
    this.loadingOverlay.classList.add('hidden');
    
    // Re-enable scrolling
    document.body.style.overflow = 'auto';
  }
  
  createButtonSpinner(button, text = 'Loading...') {
    // Store original button content
    button.dataset.originalContent = button.innerHTML;
    
    // Replace with spinner
    button.innerHTML = `
      <div class="inline-block align-middle mr-2">
        <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
      </div>
      <span>${text}</span>
    `;
    
    // Disable the button
    button.disabled = true;
    button.classList.add('opacity-75', 'cursor-not-allowed');
  }
  
  resetButton(button) {
    // Restore original content
    if (button.dataset.originalContent) {
      button.innerHTML = button.dataset.originalContent;
    }
    
    // Enable the button
    button.disabled = false;
    button.classList.remove('opacity-75', 'cursor-not-allowed');
  }
  
  createInlineLoader(selector) {
    const element = document.querySelector(selector);
    if (!element) return null;
    
    // Create loader element
    const loader = document.createElement('div');
    loader.className = 'inline-loader flex items-center justify-center py-8';
    loader.innerHTML = `
      <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      <p class="ml-3 text-gray-600">Loading...</p>
    `;
    
    // Insert loader into element
    element.appendChild(loader);
    
    return loader;
  }
  
  removeInlineLoader(selector) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    const loader = element.querySelector('.inline-loader');
    if (loader) {
      element.removeChild(loader);
    }
  }
}

// Create a singleton instance
const loadingManager = new LoadingManager();

export default loadingManager;