// Create file: scripts/services/location-service.js
class LocationService {
  constructor() {
    this.geocodeCache = {};
    this.userLocation = null;
  }

  async getUserLocation() {
    // Return cached location if available
    if (this.userLocation) {
      return this.userLocation;
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          // Cache the location
          this.userLocation = location;
          resolve(location);
        },
        error => {
          console.error('Geolocation error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });
  }

  async geocodeAddress(address) {
    // Check cache first
    if (this.geocodeCache[address]) {
      return this.geocodeCache[address];
    }

    try {
      // Use Nominatim for geocoding (free and open-source)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (data.length === 0) {
        throw new Error('Location not found');
      }
      
      const result = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
      
      // Cache the result
      this.geocodeCache[address] = result;
      return result;
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  async reverseGeocode(latitude, longitude) {
    const cacheKey = `${latitude},${longitude}`;
    
    // Check cache first
    if (this.geocodeCache[cacheKey]) {
      return this.geocodeCache[cacheKey];
    }

    try {
      // Use Nominatim for reverse geocoding
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      const data = await response.json();
      
      if (!data || data.error) {
        throw new Error('Unable to reverse geocode coordinates');
      }
      
      const result = {
        address: data.display_name,
        city: data.address.city || data.address.town || data.address.village || '',
        state: data.address.state || '',
        country: data.address.country || '',
        postcode: data.address.postcode || ''
      };
      
      // Cache the result
      this.geocodeCache[cacheKey] = result;
      return result;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula to calculate distance between two points on Earth
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in km
    return distance;
  }

  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  async findNearbyEvents(radius = 10) {
    try {
      // Get user location
      const userLocation = await this.getUserLocation();
      
      // Get all events
      const db = firebase.firestore();
      const eventsSnapshot = await db.collection('events').get();
      
      // Filter events by distance
      const nearbyEvents = [];
      eventsSnapshot.forEach(doc => {
        const event = {
          id: doc.id,
          ...doc.data()
        };
        
        // Skip events without coordinates
        if (!event.coordinates) return;
        
        // Calculate distance
        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          event.coordinates.lat,
          event.coordinates.lng
        );
        
        // Add distance to event
        event.distance = distance;
        
        // Add to nearby events if within radius
        if (distance <= radius) {
          nearbyEvents.push(event);
        }
      });
      
      // Sort by distance
      nearbyEvents.sort((a, b) => a.distance - b.distance);
      return nearbyEvents;
    } catch (error) {
      console.error('Error finding nearby events:', error);
      throw error;
    }
  }

  getDirectionsUrl(destination, mode = 'driving') {
    // Generate a Google Maps directions URL
    let destinationParam = '';
    
    if (typeof destination === 'string') {
      // If destination is an address
      destinationParam = encodeURIComponent(destination);
    } else if (destination.lat && destination.lng) {
      // If destination is coordinates
      destinationParam = `${destination.lat},${destination.lng}`;
    } else {
      throw new Error('Invalid destination format');
    }
    
    // Get travel mode
    let travelMode = '';
    switch (mode.toLowerCase()) {
      case 'driving':
        travelMode = '&dirflg=d';
        break;
      case 'walking':
        travelMode = '&dirflg=w';
        break;
      case 'transit':
        travelMode = '&dirflg=r';
        break;
      case 'bicycling':
        travelMode = '&dirflg=b';
        break;
    }
    
    return `https://www.google.com/maps/dir/?api=1&destination=${destinationParam}${travelMode}`;
  }
}

// Create a singleton instance
const locationService = new LocationService();
export default locationService;