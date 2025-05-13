// Create file: scripts/services/attendance-service.js
class AttendanceService {
  constructor() {
    this.db = firebase.firestore();
  }
  
  async getUserAttendingEvents(userId = null) {
    // Use current user if no userId provided
    const user = userId || firebase.auth().currentUser;
    if (!user) return [];
    
    try {
      const now = new Date();
      
      // Get events the user is attending that haven't happened yet
      const snapshot = await this.db.collection('attendees')
        .where('userId', '==', typeof user === 'string' ? user : user.uid)
        .where('eventDate', '>=', now)
        .orderBy('eventDate', 'asc')
        .get();
      
      const eventIds = snapshot.docs.map(doc => doc.data().eventId);
      
      if (eventIds.length === 0) return [];
      
      // Get the actual events
      const eventsSnapshot = await this.db.collection('events')
        .where(firebase.firestore.FieldPath.documentId(), 'in', eventIds)
        .get();
      
      return eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting attending events:', error);
      return [];
    }
  }
  
  async getUserPastEvents(userId = null) {
    // Use current user if no userId provided
    const user = userId || firebase.auth().currentUser;
    if (!user) return [];
    
    try {
      const now = new Date();
      
      // Get events the user attended that have already happened
      const snapshot = await this.db.collection('attendees')
        .where('userId', '==', typeof user === 'string' ? user : user.uid)
        .where('eventDate', '<', now)
        .orderBy('eventDate', 'desc')
        .get();
      
      const eventIds = snapshot.docs.map(doc => doc.data().eventId);
      
      if (eventIds.length === 0) return [];
      
      // Get the actual events
      const eventsSnapshot = await this.db.collection('events')
        .where(firebase.firestore.FieldPath.documentId(), 'in', eventIds)
        .get();
      
      return eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting past events:', error);
      return [];
    }
  }
  
  async checkInToEvent(eventId, checkInCode) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to check in');
    }
    
    try {
      // Verify check-in code
      const eventDoc = await this.db.collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }
      
      const event = eventDoc.data();
      
      // Check if check-in code is valid
      if (!event.checkInCode || event.checkInCode !== checkInCode) {
        throw new Error('Invalid check-in code');
      }
      
      // Check if user is RSVP'd
      const attendeeSnapshot = await this.db.collection('attendees')
        .where('userId', '==', user.uid)
        .where('eventId', '==', eventId)
        .get();
      
      if (attendeeSnapshot.empty) {
        throw new Error('You have not RSVP\'d to this event');
      }
      
      // Update the attendee record to mark as checked in
      const batch = this.db.batch();
      
      attendeeSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          checkedIn: true,
          checkInTime: new Date()
        });
      });
      
      // Commit the batch
      await batch.commit();
      
      return true;
    } catch (error) {
      console.error('Error checking in to event:', error);
      throw error;
    }
  }
  
  async generateCheckInCode(eventId) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to generate check-in code');
    }
    
    try {
      // Check if user is the creator of the event
      const eventDoc = await this.db.collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }
      
      const event = eventDoc.data();
      
      if (event.createdBy !== user.uid) {
        throw new Error('Only the event organizer can generate check-in codes');
      }
      
      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Update the event with the new code
      await this.db.collection('events').doc(eventId).update({
        checkInCode: code,
        checkInCodeExpires: new Date(Date.now() + 3600000) // 1 hour expiration
      });
      
      return code;
    } catch (error) {
      console.error('Error generating check-in code:', error);
      throw error;
    }
  }
  
  async getEventAttendees(eventId) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be logged in to view attendees');
    }
    
    try {
      // Check if user is the creator or RSVP'd
      const eventDoc = await this.db.collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }
      
      const event = eventDoc.data();
      
      // Check if user is the organizer or an attendee
      const isOrganizer = event.createdBy === user.uid;
      
      if (!isOrganizer) {
        const attendeeSnapshot = await this.db.collection('attendees')
          .where('userId', '==', user.uid)
          .where('eventId', '==', eventId)
          .get();
        
        if (attendeeSnapshot.empty) {
          throw new Error('You do not have permission to view the attendees list');
        }
      }
      
      // Get all attendees
      const attendeesSnapshot = await this.db.collection('attendees')
        .where('eventId', '==', eventId)
        .get();
      
      const attendeeUserIds = attendeesSnapshot.docs.map(doc => doc.data().userId);
      
      if (attendeeUserIds.length === 0) return [];
      
      // Get attendee profiles
      const attendeeProfiles = [];
      
      // Batch attendee IDs in groups of 10 (Firestore limitation)
      for (let i = 0; i < attendeeUserIds.length; i += 10) {
        const batch = attendeeUserIds.slice(i, i + 10);
        
        const usersSnapshot = await this.db.collection('users')
          .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        
        usersSnapshot.forEach(doc => {
          attendeeProfiles.push({
            id: doc.id,
            ...doc.data()
          });
        });
      }
      
      return attendeeProfiles;
    } catch (error) {
      console.error('Error getting event attendees:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const attendanceService = new AttendanceService();

export default attendanceService;