// Create file: scripts/components/modals.js
import { loadComponent } from '../utils/component-loader.js';
import errorHandler from '../utils/error-handler.js';
import loadingManager from './loading.js';

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    console.log(`Modal ${modalId} opened`);
  } else {
    console.error(`Modal with ID ${modalId} not found`);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto'; // Allow scrolling
    console.log(`Modal ${modalId} closed`);
  } else {
    console.error(`Modal with ID ${modalId} not found`);
  }
}

function initializeVibeCheckModal() {
  try {
    console.log('Initializing vibe check modal');
    
    // Load the modal if it's not already in the DOM
    if (!document.getElementById('vibeCheckModal')) {
      return loadComponent('modal-container', '../../components/modals/vibe-check-modal.html')
        .then(success => {
          if (success) {
            console.log('Vibe check modal loaded');
            setupModalEvents();
            return true;
          } else {
            console.error('Failed to load vibe check modal');
            return false;
          }
        })
        .catch(error => {
          console.error('Error loading vibe check modal:', error);
          errorHandler.logError(error, { method: 'initializeVibeCheckModal' });
          return false;
        });
    } else {
      console.log('Vibe check modal already loaded');
      setupModalEvents();
      return Promise.resolve(true);
    }
  } catch (error) {
    console.error('Error initializing vibe check modal:', error);
    errorHandler.logError(error, { method: 'initializeVibeCheckModal' });
    return Promise.resolve(false);
  }
}

function setupModalEvents() {
  try {
    console.log('Setting up modal events');
    
    // Close button
    const closeBtn = document.querySelector('#vibeCheckModal .close-modal-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('Close button clicked');
        closeModal('vibeCheckModal');
      });
    } else {
      console.warn('Close button not found in modal');
    }
    
    // Click outside to close
    const modal = document.getElementById('vibeCheckModal');
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          console.log('Clicked outside modal content, closing');
          closeModal('vibeCheckModal');
        }
      });
    }
    
    // Upload container
    const uploadContainer = document.querySelector('#vibeCheckModal .upload-container');
    if (uploadContainer) {
      uploadContainer.addEventListener('click', () => {
        console.log('Upload container clicked');
        // Create a file input and trigger it
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,video/*';
        fileInput.multiple = true;
        
        fileInput.addEventListener('change', (event) => {
          handleFileUpload(event.target.files);
        });
        
        fileInput.click();
      });
    } else {
      console.warn('Upload container not found in modal');
    }
    
    // Post button
    const postBtn = document.querySelector('#vibeCheckModal .post-vibe-btn');
    if (postBtn) {
      postBtn.addEventListener('click', postVibeCheck);
    } else {
      console.warn('Post button not found in modal');
    }
  } catch (error) {
    console.error('Error setting up modal events:', error);
    errorHandler.logError(error, { method: 'setupModalEvents' });
  }
}

function handleFileUpload(files) {
  try {
    // Display thumbnails of selected files
    const uploadContainer = document.querySelector('#vibeCheckModal .upload-container');
    
    if (files.length > 0) {
      uploadContainer.innerHTML = '';
      uploadContainer.classList.add('grid', 'grid-cols-3', 'gap-2');
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        
        reader.onload = function(e) {
          const thumbnail = document.createElement('div');
          thumbnail.className = 'relative';
          
          if (file.type.startsWith('image/')) {
            thumbnail.innerHTML = `
              <img src="${e.target.result}" alt="Uploaded" class="w-full h-16 object-cover rounded">
              <button class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center remove-file">×</button>
            `;
          } else if (file.type.startsWith('video/')) {
            thumbnail.innerHTML = `
              <video class="w-full h-16 object-cover rounded">
                <source src="${e.target.result}" type="${file.type}">
              </video>
              <button class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center remove-file">×</button>
            `;
          }
          
          uploadContainer.appendChild(thumbnail);
          
          // Add remove functionality
          const removeBtn = thumbnail.querySelector('.remove-file');
          if (removeBtn) {
            removeBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              thumbnail.remove();
              
              // If no thumbnails left, reset the container
              if (uploadContainer.children.length === 0) {
                resetUploadContainer(uploadContainer);
              }
            });
          }
        };
        
        reader.readAsDataURL(file);
      }
    }
  } catch (error) {
    console.error('Error handling file upload:', error);
    errorHandler.logError(error, { method: 'handleFileUpload' });
  }
}

function resetUploadContainer(container) {
  container.classList.remove('grid', 'grid-cols-3', 'gap-2');
  container.innerHTML = `
    <i class="fas fa-camera text-4xl text-gray-400 mb-2"></i>
    <p class="text-gray-500">Tap to add photos or videos</p>
  `;
}

function postVibeCheck() {
  try {
    // Show loading
    loadingManager.createButtonSpinner(document.querySelector('#vibeCheckModal .post-vibe-btn'), 'Posting...');
    
    const eventInput = document.querySelector('#vibeCheckModal .event-input');
    const vibeDescription = document.querySelector('#vibeCheckModal .vibe-description');
    
    if (!eventInput || !eventInput.value.trim()) {
      errorHandler.showToast('Please specify which event you are at', 'warning');
      loadingManager.resetButton(document.querySelector('#vibeCheckModal .post-vibe-btn'));
      return;
    }
    
    // Get current user
    const user = firebase.auth().currentUser;
    if (!user) {
      errorHandler.showToast('You must be logged in to post a vibe check', 'error');
      loadingManager.resetButton(document.querySelector('#vibeCheckModal .post-vibe-btn'));
      return;
    }
    
    // Create vibe check data
    const vibeData = {
      event: eventInput.value.trim(),
      description: vibeDescription ? vibeDescription.value.trim() : '',
      userId: user.uid,
      userDisplayName: user.displayName || user.email.split('@')[0],
      userPhotoURL: user.photoURL || null,
      timestamp: new Date(),
      // Media files would be handled separately
    };
    
    // Save to Firestore
    if (firebase && firebase.firestore) {
      firebase.firestore().collection('vibeChecks')
        .add(vibeData)
        .then((docRef) => {
          console.log('Vibe check posted with ID:', docRef.id);
          errorHandler.showToast('Your vibe check has been posted!', 'success');
          closeModal('vibeCheckModal');
          
          // Reset form
          if (eventInput) eventInput.value = '';
          if (vibeDescription) vibeDescription.value = '';
          
          // Reset button
          loadingManager.resetButton(document.querySelector('#vibeCheckModal .post-vibe-btn'));
          
          // Reset upload container
          const uploadContainer = document.querySelector('#vibeCheckModal .upload-container');
          if (uploadContainer) {
            resetUploadContainer(uploadContainer);
          }
          
          // Handle media upload separately
          // This would involve Firebase Storage
        })
        .catch((error) => {
          console.error('Error posting vibe check:', error);
          errorHandler.showToast('Failed to post vibe check. Please try again.', 'error');
          loadingManager.resetButton(document.querySelector('#vibeCheckModal .post-vibe-btn'));
        });
    } else {
      console.error('Firestore not available');
      errorHandler.showToast('Unable to post vibe check at this time.', 'error');
      loadingManager.resetButton(document.querySelector('#vibeCheckModal .post-vibe-btn'));
    }
  } catch (error) {
    console.error('Error posting vibe check:', error);
    errorHandler.logError(error, { method: 'postVibeCheck' });
    errorHandler.showToast('An error occurred. Please try again.', 'error');
    loadingManager.resetButton(document.querySelector('#vibeCheckModal .post-vibe-btn'));
  }
}

export { openModal, closeModal, initializeVibeCheckModal };