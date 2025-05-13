// Create file: scripts/components/nearby-events.js
import locationService from '../services/location-service.js';
import { formatEventDate } from '../utils/date-format.js';
import errorHandler from '../utils/error-handler.js';

class NearbyEventsComponent {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.options = {
      radius: 10, // km
      limit: 6,
      showDistance: true,
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
      
      // Load nearby events
      const events = await this.loadNearbyEvents();
      
      // Update UI
      this.updateUI(events);
    } catch (error) {
      console.error('Error initializing nearby events component:', error);
      if (error.code === 1) {
        // Permission denied
        this.showGeolocationError('Location permission denied. Please enable location services to see nearby events.');
      } else {
        this.showError('Failed to load nearby events');
      }
    }
  }
  
  async loadNearbyEvents() {
    try {
      const events = await locationService.findNearbyEvents(this.options.radius);
      
      // Limit number of events
      return events.slice(0, this.options.limit);
    } catch (error) {
      console.error('Error loading nearby events:', error);
      throw error;
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
    heading.textContent = 'Events Near You';
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
    
    // Add "View All" button if we have more events than the limit
    if (events.length >= this.options.limit) {
      const viewAllBtn = document.createElement('div');
      viewAllBtn.className = 'text-center mt-6';
      viewAllBtn.innerHTML = `
        <a href="map.html" class="btn-primary inline-block">
          View All Nearby Events
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
    
    // Format distance
    let distanceStr = '';
    if (this.options.showDistance && event.distance) {
      distanceStr = `<span class="ml-2 text-xs bg-gray-100 rounded-full px-2 py-1">${event.distance.toFixed(1)} km</span>`;
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
        <p class="text-xs text-gray-600 flex items-center mb-1">
          <i class="fas fa-calendar-alt mr-1"></i> ${dateStr}${distanceStr}
        </p>
        <p class="text-xs text-gray-600 truncate">
          <i class="fas fa-map-marker-alt mr-1"></i> ${event.location || 'Location TBD'}
        </p>
      </div>
    `;
    
    // Add click event
    element.addEventListener('click', () => {
      window.location.href = `event-detail.html?id=${event.id}`;
    });
    
    return element;
  }
  
  showLoading() {
    this.container.innerHTML = `
      <div class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-2"></div>
        <p class="text-gray-600">Finding events near you...</p>
      </div>
    `;
  }
  
  showNoEvents() {
    this.container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-gray-600 mb-4">No events found within ${this.options.radius} km of your location.</p>
        <a href="map.html" class="btn-primary inline-block">
          Explore Events Map
        </a>
      </div>
    `;
  }
  
  showGeolocationError(message) {
    this.container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-gray-600 mb-4">${message}</p>
        <a href="map.html" class="btn-primary inline-block">
          View Events Map
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

export default NearbyEventsComponent;