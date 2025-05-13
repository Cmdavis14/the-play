// Create file: scripts/services/event-service.js
import errorHandler from '../utils/error-handler.js';

class EventService {
  constructor() {
    this.db = firebase.firestore();
    this.storage = firebase.storage();
  }
  
  async getEventById(eventId) {
    try {
      const doc = await this.db.collection('events').doc(eventId).get();
      
      if (!doc.exists) {
        throw new Error('Event not found');
      }
      
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  }
  
  async getEvents(filters = {}, limit = 10) {
    try {
      let query = this.db.collection('events');
      
      // Apply filters
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }
      
      if (filters.dateRange) {
        const { start, end } = filters.dateRange;
        if (start) {
          query = query.where('dateTime', '>=', start);
        }
        if (end) {
          query = query.where('dateTime', '<=', end);
        }
      }
      
      // Apply sorting
      query = query.orderBy(filters.orderBy || 'dateTime', filters.orderDirection || 'asc');
      
      // Apply limit
      query = query.limit(limit);
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }
  
  async searchEvents(searchTerm, limit = 10) {
    try {
      // Basic search implementation - will be enhanced in the future
      const snapshot = await this.db.collection('events')
        .orderBy('title')
        .startAt(searchTerm)
        .endAt(searchTerm + '\uf8ff')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error searching events:', error);
      throw error;
    }
  }
  
  async createEvent(eventData, imageFile = null) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to create an event');
    }
    
    try {
      // Upload image if provided
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await this.uploadEventImage(imageFile);
      }
      
      // Create event document
      const eventDoc = {
        ...eventData,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        attendees: 0,
        imageUrl: imageUrl
      };
      
      // Add to Firestore
      const docRef = await this.db.collection('events').add(eventDoc);
      
      return {
        id: docRef.id,
        ...eventDoc
      };
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }
  
  async updateEvent(eventId, eventData, imageFile = null) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to update an event');
    }
    
    try {
      // Check if user is the creator of the event
      const eventDoc = await this.db.collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }
      
      const eventCreator = eventDoc.data().createdBy;
      
      if (eventCreator !== user.uid) {
        throw new Error('You do not have permission to edit this event');
      }
      
      // Upload image if provided
      let imageUrl = eventDoc.data().imageUrl;
      if (imageFile) {
        imageUrl = await this.uploadEventImage(imageFile);
      }
      
      // Update event document
      const updateData = {
        ...eventData,
        updatedAt: new Date(),
        imageUrl: imageUrl
      };
      
      // Update in Firestore
      await this.db.collection('events').doc(eventId).update(updateData);
      
      return {
        id: eventId,
        ...updateData
      };
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }
  
  async deleteEvent(eventId) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to delete an event');
    }
    
    try {
      // Check if user is the creator of the event
      const eventDoc = await this.db.collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }
      
      const eventCreator = eventDoc.data().createdBy;
      
      if (eventCreator !== user.uid) {
        throw new Error('You do not have permission to delete this event');
      }
      
      // Delete the event
      await this.db.collection('events').doc(eventId).delete();
      
      // TODO: Also delete related data (RSVPs, vibe checks, etc.)
      
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }
  
  async uploadEventImage(file) {
    try {
      // Create a storage reference
      const storageRef = this.storage.ref();
      const fileRef = storageRef.child(`event-images/${Date.now()}_${file.name}`);
      
      // Upload the file
      const snapshot = await fileRef.put(file);
      
      // Get the download URL
      const downloadURL = await snapshot.ref.getDownloadURL();
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }
  
  async toggleBookmark(eventId) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to bookmark events');
    }
    
    try {
      // Check if the event is already bookmarked
      const snapshot = await this.db.collection('bookmarks')
        .where('userId', '==', user.uid)
        .where('eventId', '==', eventId)
        .get();
      
      if (snapshot.empty) {
        // Add bookmark
        await this.db.collection('bookmarks').add({
          userId: user.uid,
          eventId: eventId,
          createdAt: new Date()
        });
        
        return true; // Bookmark added
      } else {
        // Remove bookmark
        const batch = this.db.batch();
        
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        return false; // Bookmark removed
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      throw error;
    }
  }
  
  async isBookmarked(eventId) {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    
    try {
      const snapshot = await this.db.collection('bookmarks')
        .where('userId', '==', user.uid)
        .where('eventId', '==', eventId)
        .get();
      
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking bookmark status:', error);
      return false;
    }
  }
  
  async getBookmarkedEvents() {
    const user = firebase.auth().currentUser;
    if (!user) return [];
    
    try {
      const snapshot = await this.db.collection('bookmarks')
        .where('userId', '==', user.uid)
        .get();
      
      const bookmarkIds = snapshot.docs.map(doc => doc.data().eventId);
      
      if (bookmarkIds.length === 0) return [];
      
      // Get the actual events
      const eventsSnapshot = await this.db.collection('events')
        .where(firebase.firestore.FieldPath.documentId(), 'in', bookmarkIds)
        .get();
      
      return eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting bookmarked events:', error);
      return [];
    }
  }
  
  async rsvpToEvent(eventId, reminderSetting = 'day') {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to RSVP');
    }
    
    try {
      // Check if already RSVP'd
      const attendeeSnapshot = await this.db.collection('attendees')
        .where('userId', '==', user.uid)
        .where('eventId', '==', eventId)
        .get();
      
      if (!attendeeSnapshot.empty) {
        throw new Error('You have already RSVP\'d to this event');
      }
      
      // Get event details
      const eventDoc = await this.db.collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }
      
      const eventData = eventDoc.data();
      
      // Begin a batch write
      const batch = this.db.batch();
      
      // Add attendee record
      const attendeeRef = this.db.collection('attendees').doc();
      batch.set(attendeeRef, {
        userId: user.uid,
        eventId: eventId,
        eventTitle: eventData.title,
        createdAt: new Date(),
        eventDate: eventData.dateTime || new Date(),
        reminderSetting: reminderSetting,
        reminderSent: false
      });
      
      // Increment attendee count
      const eventRef = this.db.collection('events').doc(eventId);
      batch.update(eventRef, {
        attendees: firebase.firestore.FieldValue.increment(1)
      });
      
      // Commit the batch
      await batch.commit();
      
      return true;
    } catch (error) {
      console.error('Error RSVPing to event:', error);
      throw error;
    }
  }
  
  async cancelRsvp(eventId) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to cancel RSVP');
    }
    
    try {
      // Find the attendee record
      const attendeeSnapshot = await this.db.collection('attendees')
        .where('userId', '==', user.uid)
        .where('eventId', '==', eventId)
        .get();
      
      if (attendeeSnapshot.empty) {
        throw new Error('You have not RSVP\'d to this event');
      }
      
      // Begin a batch write
      const batch = this.db.batch();
      
      // Delete attendee records
      attendeeSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Decrement attendee count
      const eventRef = this.db.collection('events').doc(eventId);
      batch.update(eventRef, {
        attendees: firebase.firestore.FieldValue.increment(-1)
      });
      
      // Commit the batch
      await batch.commit();
      
      return true;
    } catch (error) {
      console.error('Error canceling RSVP:', error);
      throw error;
    }
  }
  
  async getEventAttendees(eventId, limit = 20) {
    try {
      const snapshot = await this.db.collection('attendees')
        .where('eventId', '==', eventId)
        .limit(limit)
        .get();
      
      const userIds = snapshot.docs.map(doc => doc.data().userId);
      
      if (userIds.length === 0) return [];
      
      // Get user profiles
      const userDocs = await Promise.all(
        userIds.map(userId => this.db.collection('users').doc(userId).get())
      );
      
      return userDocs
        .filter(doc => doc.exists)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
    } catch (error) {
      console.error('Error getting event attendees:', error);
      return [];
    }
  }
}

// Create a singleton instance
const eventService = new EventService();

export default eventService;