// Create file: scripts/components/recommended-events.js
import recommendationService from '../services/recommendation-service.js';
import { formatEventDate } from '../utils/date-format.js';
import errorHandler from '../utils/error-handler.js';

class RecommendedEventsComponent {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.options = {
      limit: 6,
      title: 'Recommended For You',
      showViewAll: true,
      viewAllURL: 'index.html',
      ...options
    };
    
    if (!this.container) {
      console.error(`Container with ID ${containerId} not found`);
      return;
    }
    
    this.initialize();
  }
  
  async initialize() {
    try {
      // Show loading state
      this.showLoading();
      
      // Load recommended events
      const events = await recommendationService.getRecommendedEvents(this.options.limit);
      
      // Update UI
      this.updateUI(events);
    } catch (error) {
      console.error('Error initializing recommended events component:', error);
      this.showError('Failed to load recommended events');
    }
  }
  
  updateUI(events) {
    // Clear container
    this.container.innerHTML = '';
    
    // Check if we have events
    if (events.length === 0) {
      this.showNoEvents();
      return;
    }
    
    // Add heading
    const heading = document.createElement('h2');
    heading.className = 'text-xl font-bold mb-4';
    heading.textContent = this.options.title;
    this.container.appendChild(heading);
    
    // Create events grid
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    
    // Add events to grid
    events.forEach(event => {
      const eventElement = this.createEventElement(event);
      grid.appendChild(eventElement);
    });
    
    // Add grid to container
    this.container.appendChild(grid);
    
    // Add "View All" button if requested
    if (this.options.showViewAll) {
      const viewAllBtn = document.createElement('div');
      viewAllBtn.className = 'text-center mt-6';
      viewAllBtn.innerHTML = `
        <a href="${this.options.viewAllURL}" class="btn-primary inline-block">
          View All
        </a>
      `;
      this.container.appendChild(viewAllBtn);
    }
  }
  
  createEventElement(event) {
    const element = document.createElement('div');
    element.className = 'bg-white rounded-lg shadow-sm overflow-hidden';
    
    // Format date
    let dateStr = 'Date TBD';
    if (event.dateTime) {
      const dateTime = new Date(event.dateTime.seconds * 1000);
      dateStr = formatEventDate(dateTime);
    }
    
    element.innerHTML = `
      <div class="h-36 bg-gray-200 relative">
        <img src="${event.imageUrl || '/api/placeholder/400/250'}" alt="${event.title}" class="w-full h-full object-cover">
        <div class="absolute top-2 right-2 vibe-score text-xs">
          <i class="fas fa-fire mr-1"></i> ${event.score || '8.5'}
        </div>
      </div>
      <div class="p-3">
        <h3 class="font-bold text-sm mb-1">${event.title}</h3>
        <p class="text-xs text-gray-600 mb-1">
          <i class="fas fa-calendar-alt mr-1"></i> ${dateStr}
        </p>
        <p class="text-xs text-gray-600 truncate">
          <i class="fas fa-map-marker-alt mr-1"></i> ${event.location || 'Location TBD'}
        </p>
      </div>
    `;
    
    // Add click event
    element.addEventListener('click', () => {
      // Record the click for better recommendations
      recommendationService.saveEventInteraction(event.id, 'click');
      
      // Navigate to event detail page
      window.location.href = `event-detail.html?id=${event.id}`;
    });
    
    return element;
  }
  
  showLoading() {
    this.container.innerHTML = `
      <div class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-2"></div>
        <p class="text-gray-600">Finding events for you...</p>
      </div>
    `;
  }
  
  showNoEvents() {
    this.container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-gray-600 mb-4">No recommended events found.</p>
        <a href="map.html" class="btn-primary inline-block">
          Explore All Events
        </a>
      </div>
    `;
  }
  
  showError(message) {
    this.container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-gray-600 mb-4">${message}</p>
        <button class="btn-primary inline-block" onclick="location.reload()">
          Try Again
        </button>
      </div>
    `;
  }
}

export default RecommendedEventsComponent;