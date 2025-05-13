// Create file: scripts/utils/error-handler.js
class ErrorHandler {
  constructor() {
    this.errorContainer = null;
    this.toastContainer = null;
    this.setupErrorContainer();
  }
  
  setupErrorContainer() {
    // Check if the container already exists
    let container = document.getElementById('error-container');
    if (!container) {
      // Create the container
      container = document.createElement('div');
      container.id = 'error-container';
      container.className = 'fixed top-0 left-0 right-0 flex flex-col items-center z-50 p-4';
      document.body.appendChild(container);
    }
    this.errorContainer = container;
    
    // Create toast container
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'fixed bottom-20 right-4 flex flex-col items-end z-50';
      document.body.appendChild(toastContainer);
    }
    this.toastContainer = toastContainer;
  }
  
  showError(message, duration = 5000) {
    // Create error element
    const errorElement = document.createElement('div');
    errorElement.className = 'bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg mb-2 flex items-center';
    errorElement.innerHTML = `
      <i class="fas fa-exclamation-circle mr-2"></i>
      <span>${message}</span>
      <button class="ml-4 text-white hover:text-red-200">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add to container
    this.errorContainer.appendChild(errorElement);
    
    // Add close button event
    const closeButton = errorElement.querySelector('button');
    closeButton.addEventListener('click', () => {
      this.errorContainer.removeChild(errorElement);
    });
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        if (errorElement.parentNode === this.errorContainer) {
          this.errorContainer.removeChild(errorElement);
        }
      }, duration);
    }
    
    return errorElement;
  }
  
  showSuccess(message, duration = 3000) {
    // Create success element
    const successElement = document.createElement('div');
    successElement.className = 'bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg mb-2 flex items-center';
    successElement.innerHTML = `
      <i class="fas fa-check-circle mr-2"></i>
      <span>${message}</span>
      <button class="ml-4 text-white hover:text-green-200">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add to container
    this.errorContainer.appendChild(successElement);
    
    // Add close button event
    const closeButton = successElement.querySelector('button');
    closeButton.addEventListener('click', () => {
      this.errorContainer.removeChild(successElement);
    });
    
    // Auto-remove after duration
    setTimeout(() => {
      if (successElement.parentNode === this.errorContainer) {
        this.errorContainer.removeChild(successElement);
      }
    }, duration);
    
    return successElement;
  }
  
  showToast(message, type = 'info', duration = 3000) {
    // Create toast element
    const toastElement = document.createElement('div');
    let bgColor = 'bg-gray-800';
    let icon = 'fas fa-info-circle';
    
    if (type === 'success') {
      bgColor = 'bg-green-500';
      icon = 'fas fa-check-circle';
    } else if (type === 'error') {
      bgColor = 'bg-red-500';
      icon = 'fas fa-exclamation-circle';
    } else if (type === 'warning') {
      bgColor = 'bg-yellow-500';
      icon = 'fas fa-exclamation-triangle';
    }
    
    toastElement.className = `${bgColor} text-white px-4 py-2 rounded-lg shadow-lg mb-2 flex items-center transform translate-x-full opacity-0 transition-all duration-300`;
    toastElement.innerHTML = `
      <i class="${icon} mr-2"></i>
      <span>${message}</span>
    `;
    
    // Add to container
    this.toastContainer.appendChild(toastElement);
    
    // Animate in
    setTimeout(() => {
      toastElement.classList.remove('translate-x-full', 'opacity-0');
    }, 10);
    
    // Auto-remove after duration
    setTimeout(() => {
      toastElement.classList.add('translate-x-full', 'opacity-0');
      
      setTimeout(() => {
        if (toastElement.parentNode === this.toastContainer) {
          this.toastContainer.removeChild(toastElement);
        }
      }, 300);
    }, duration);
    
    return toastElement;
  }
  
  logError(error, context = {}) {
    // Log to console
    console.error('Error:', error);
    console.error('Context:', context);
    
    // In a production environment, you'd send this to your error tracking service
    // Example: Sentry.captureException(error, { extra: context });
    
    return {
      error,
      context,
      timestamp: new Date()
    };
  }
}

// Create a singleton instance
const errorHandler = new ErrorHandler();

export default errorHandler;// Create file: scripts/utils/error-handler.js