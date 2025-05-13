// Create file: scripts/components/event-creation.js
import loadingManager from './loading.js';
import errorHandler from '../utils/error-handler.js';

class EventCreator {
  constructor() {
    this.imageFile = null;
    this.form = null;
    this.cancelBtn = null;
    this.submitBtn = null;
    
    this.imageUploadContainer = null;
    this.imagePreview = null;
    this.removeImageBtn = null;
  }
  
  initialize() {
    // Find form elements
    this.form = document.getElementById('event-form');
    this.cancelBtn = document.getElementById('cancel-event');
    this.submitBtn = document.getElementById('submit-event');
    
    this.imageUploadContainer = document.getElementById('image-upload-container');
    this.imageInput = document.getElementById('event-image');
    this.imagePreview = document.getElementById('image-preview');
    this.removeImageBtn = document.getElementById('remove-image');
    
    if (!this.form) return;
    
    // Set up event listeners
    this.setupImageUpload();
    this.setupFormSubmission();
    
    // Cancel button
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel? Your event data will be lost.')) {
          window.location.href = '../../pages/app/index.html';
        }
      });
    }
  }
  
  setupImageUpload() {
    if (!this.imageUploadContainer || !this.imageInput) return;
    
    // Click on container triggers file input
    this.imageUploadContainer.addEventListener('click', () => {
      this.imageInput.click();
    });
    
    // Handle file selection
    this.imageInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        errorHandler.showToast('Please select an image file', 'error');
        return;
      }
      
      // Save file for later upload
      this.imageFile = file;
      
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewImg = this.imagePreview.querySelector('img');
        previewImg.src = e.target.result;
        this.imagePreview.classList.remove('hidden');
        this.imageUploadContainer.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    });
    
    // Remove image button
    if (this.removeImageBtn) {
      this.removeImageBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent triggering container click
        
        // Clear file input
        this.imageInput.value = '';
        this.imageFile = null;
        
        // Hide preview, show upload container
        this.imagePreview.classList.add('hidden');
        this.imageUploadContainer.classList.remove('hidden');
      });
    }
  }
  
  setupFormSubmission() {
    if (!this.form) return;
    
    this.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      // Validate form
      const isValid = this.validateForm();
      if (!isValid) return;
      
      // Show loading state
      loadingManager.createButtonSpinner(this.submitBtn, 'Creating event...');
      
      try {
        // Get form data
        const formData = this.getFormData();
        
        // Upload image if exists
        if (this.imageFile) {
          const imageUrl = await this.uploadImage(this.imageFile);
          formData.imageUrl = imageUrl;
        }
        
        // Create event in Firestore
        await this.createEvent(formData);
        
        // Show success and redirect
        errorHandler.showSuccess('Event created successfully!');
        setTimeout(() => {
          window.location.href = '../../pages/app/index.html';
        }, 1500);
      } catch (error) {
        // Log error
        errorHandler.logError(error, { method: 'createEvent' });
        
        // Show error
        const errorElement = document.getElementById('event-form-error');
        errorElement.textContent = error.message || 'Failed to create event. Please try again.';
        errorElement.classList.remove('hidden');
        
        // Reset button
        loadingManager.resetButton(this.submitBtn);
      }
    });
  }
  
  validateForm() {
    const title = document.getElementById('event-title').value.trim();
    const description = document.getElementById('event-description').value.trim();
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value.trim();
    const category = document.getElementById('event-category').value;
    
    const errorElement = document.getElementById('event-form-error');
    
    if (!title) {
      errorElement.textContent = 'Please enter an event title';
      errorElement.classList.remove('hidden');
      return false;
    }
    
    if (!description) {
      errorElement.textContent = 'Please enter an event description';
      errorElement.classList.remove('hidden');
      return false;
    }
    
    if (!date) {
      errorElement.textContent = 'Please select an event date';
      errorElement.classList.remove('hidden');
      return false;
    }
    
    if (!time) {
      errorElement.textContent = 'Please select an event time';
      errorElement.classList.remove('hidden');
      return false;
    }
    
    if (!location) {
      errorElement.textContent = 'Please enter an event location';
      errorElement.classList.remove('hidden');
      return false;
    }
    
    if (!category) {
      errorElement.textContent = 'Please select an event category';
      errorElement.classList.remove('hidden');
      return false;
    }
    
    // Hide error if all is valid
    errorElement.classList.add('hidden');
    return true;
  }
  
  getFormData() {
    const title = document.getElementById('event-title').value.trim();
    const description = document.getElementById('event-description').value.trim();
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value.trim();
    const price = document.getElementById('event-price').value.trim();
    const category = document.getElementById('event-category').value;
    
    // Combine date and time
    const dateTime = new Date(`${date}T${time}`);
    
    // Get current user
    const user = firebase.auth().currentUser;
    
    return {
      title,
      description,
      dateTime,
      location,
      price: price || 'Free',
      category,
      createdBy: user.uid,
      createdAt: new Date(),
      attendees: 0,
      score: Math.floor(Math.random() * 3) + 7, // Random score between 7-9 for now
    };
  }
  
  async uploadImage(file) {
    // Create a storage reference
    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(`event-images/${Date.now()}_${file.name}`);
    
    // Upload file
    const snapshot = await fileRef.put(file);
    
    // Get download URL
    const downloadURL = await snapshot.ref.getDownloadURL();
    
    return downloadURL;
  }
  
  async createEvent(eventData) {
    // Add to Firestore
    const db = firebase.firestore();
    const docRef = await db.collection('events').add(eventData);
    
    return docRef.id;
  }
}

// Create instance
const eventCreator = new EventCreator();

export default eventCreator;