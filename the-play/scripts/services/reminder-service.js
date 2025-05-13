// Create file: scripts/services/reminder-service.js
class ReminderService {
  constructor() {
    this.db = firebase.firestore();
  }
  
  async scheduleEventReminder(eventId, reminderType = 'day') {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    
    try {
      // Get event details
      const eventDoc = await this.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) {
        console.error('Event not found');
        return false;
      }
      
      const eventData = eventDoc.data();
      const eventDate = eventData.dateTime ? new Date(eventData.dateTime.seconds * 1000) : null;
      
      if (!eventDate) {
        console.error('Event has no date');
        return false;
      }
      
      // Calculate reminder time
      let reminderTime;
      if (reminderType === 'day') {
        // 24 hours before the event
        reminderTime = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
      } else if (reminderType === 'hour') {
        // 1 hour before the event
        reminderTime = new Date(eventDate.getTime() - 60 * 60 * 1000);
      } else {
        console.error('Invalid reminder type');
        return false;
      }
      
      // Create reminder document
      await this.db.collection('reminders').add({
        userId: user.uid,
        eventId: eventId,
        eventTitle: eventData.title,
        eventDate: eventData.dateTime,
        reminderType: reminderType,
        reminderTime: reminderTime,
        sent: false,
        createdAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error scheduling reminder:', error);
      return false;
    }
  }
  
  async cancelEventReminder(eventId) {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    
    try {
      // Find existing reminders
      const remindersSnapshot = await this.db.collection('reminders')
        .where('userId', '==', user.uid)
        .where('eventId', '==', eventId)
        .get();
      
      if (remindersSnapshot.empty) {
        return true; // No reminders to cancel
      }
      
      // Delete each reminder
      const batch = this.db.batch();
      remindersSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error canceling reminder:', error);
      return false;
    }
  }
  
  async getUserReminders() {
    const user = firebase.auth().currentUser;
    if (!user) return [];
    
    try {
      // Get upcoming reminders
      const now = new Date();
      const remindersSnapshot = await this.db.collection('reminders')
        .where('userId', '==', user.uid)
        .where('reminderTime', '>', now)
        .orderBy('reminderTime', 'asc')
        .get();
      
      const reminders = [];
      remindersSnapshot.forEach(doc => {
        reminders.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return reminders;
    } catch (error) {
      console.error('Error getting reminders:', error);
      return [];
    }
  }
}

// Create a singleton instance
const reminderService = new ReminderService();

export default reminderService;