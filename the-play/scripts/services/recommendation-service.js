// Create file: scripts/services/recommendation-service.js
class RecommendationService {
  constructor() {
    this.db = firebase.firestore();
  }
  
  async getUserPreferences() {
    const user = firebase.auth().currentUser;
    if (!user) return null;
    
    try {
      const userDoc = await this.db.collection('users').doc(user.uid).get();
      
      if (!userDoc.exists) {
        return null;
      }
      
      const userData = userDoc.data();
      
      return userData.preferences || {};
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }
  
  async updateUserPreferences(preferences) {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    
    try {
      await this.db.collection('users').doc(user.uid).update({
        'preferences': preferences,
        updatedAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return false;
    }
  }
  
  async getRecommendedEvents(limit = 6) {
    const user = firebase.auth().currentUser;
    if (!user) return [];
    
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences();
      
      // Get user's bookmarked events to build interests
      const bookmarksSnapshot = await this.db.collection('bookmarks')
        .where('userId', '==', user.uid)
        .get();
      
      const bookmarkedEventIds = bookmarksSnapshot.docs.map(doc => doc.data().eventId);
      
      // Get user's attended events
      const attendanceSnapshot = await this.db.collection('attendees')
        .where('userId', '==', user.uid)
        .get();
      
      const attendedEventIds = attendanceSnapshot.docs.map(doc => doc.data().eventId);
      
      // Combine all event IDs to analyze
      const allEventIds = [...new Set([...bookmarkedEventIds, ...attendedEventIds])];
      
      if (allEventIds.length === 0) {
        // User has no history, return trending events
        return this.getTrendingEvents(limit);
      }
      
      // Get event details in batches (Firestore limitation)
      const eventDetails = [];
      
      for (let i = 0; i < allEventIds.length; i += 10) {
        const batch = allEventIds.slice(i, i + 10);
        
        const eventsSnapshot = await this.db.collection('events')
          .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        
        eventsSnapshot.forEach(doc => {
          eventDetails.push({
            id: doc.id,
            ...doc.data()
          });
        });
      }
      
      // Build category preferences
      const categoryCount = {};
      
      eventDetails.forEach(event => {
        if (event.category) {
          categoryCount[event.category] = (categoryCount[event.category] || 0) + 1;
        }
      });
      
      // Sort categories by count
      const sortedCategories = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      
      // If user has explicit preferences, prioritize those
      let preferredCategories = sortedCategories;
      
      if (preferences && preferences.eventTypes && preferences.eventTypes.length > 0) {
        // Combine explicit preferences with inferred ones, prioritizing explicit
        preferredCategories = [
          ...preferences.eventTypes,
          ...sortedCategories.filter(cat => !preferences.eventTypes.includes(cat))
        ];
      }
      
      // Get upcoming events in preferred categories
      const now = new Date();
      
      let recommendedEvents = [];
      
      // Try each preferred category
      for (const category of preferredCategories) {
        const categoryEventsSnapshot = await this.db.collection('events')
          .where('category', '==', category)
          .where('dateTime', '>=', now)
          .limit(limit - recommendedEvents.length)
          .get();
        
        categoryEventsSnapshot.forEach(doc => {
          // Skip events user has already bookmarked or attended
          if (!allEventIds.includes(doc.id)) {
            recommendedEvents.push({
              id: doc.id,
              ...doc.data()
            });
          }
        });
        
        // If we have enough events, stop querying
        if (recommendedEvents.length >= limit) {
          break;
        }
      }
      
      // If we still need more events, get trending events
      if (recommendedEvents.length < limit) {
        const trendingEvents = await this.getTrendingEvents(limit - recommendedEvents.length);
        
        // Add trending events, avoiding duplicates
        trendingEvents.forEach(event => {
          if (!recommendedEvents.some(recEvent => recEvent.id === event.id)) {
            recommendedEvents.push(event);
          }
        });
      }
      
      return recommendedEvents.slice(0, limit);
    } catch (error) {
      console.error('Error getting recommended events:', error);
      return this.getTrendingEvents(limit);
    }
  }
  
  async getTrendingEvents(limit = 6) {
    try {
      // Get events with high attendance
      const eventsSnapshot = await this.db.collection('events')
        .where('dateTime', '>=', new Date())
        .orderBy('dateTime', 'asc')
        .orderBy('attendees', 'desc')
        .limit(limit)
        .get();
      
      const events = [];
      
      eventsSnapshot.forEach(doc => {
        events.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return events;
    } catch (error) {
      console.error('Error getting trending events:', error);
      return [];
    }
  }
  
  async getEventsForYou(limit = 10) {
    try {
      // Get recommended events
      const recommendedEvents = await this.getRecommendedEvents(limit / 2);
      
      // Get nearby events (we'll implement this in a future update)
      const nearbyEvents = [];
      
      // Get trending events to fill in if needed
      const numMoreNeeded = limit - recommendedEvents.length - nearbyEvents.length;
      
      let trendingEvents = [];
      
      if (numMoreNeeded > 0) {
        trendingEvents = await this.getTrendingEvents(numMoreNeeded);
      }
      
      // Combine all events, removing duplicates
      const allEvents = [...recommendedEvents];
      
      // Add nearby events, avoiding duplicates
      nearbyEvents.forEach(event => {
        if (!allEvents.some(e => e.id === event.id)) {
          allEvents.push(event);
        }
      });
      
      // Add trending events, avoiding duplicates
      trendingEvents.forEach(event => {
        if (!allEvents.some(e => e.id === event.id)) {
          allEvents.push(event);
        }
      });
      
      return allEvents.slice(0, limit);
    } catch (error) {
      console.error('Error getting events for you:', error);
      return [];
    }
  }
  
  async saveEventInteraction(eventId, interactionType) {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    
    try {
      // Save interaction to Firestore
      await this.db.collection('userInteractions').add({
        userId: user.uid,
        eventId: eventId,
        type: interactionType,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error saving event interaction:', error);
      return false;
    }
  }
}

// Create a singleton instance
const recommendationService = new RecommendationService();

export default recommendationService;