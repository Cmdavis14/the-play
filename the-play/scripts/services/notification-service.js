// Create file: scripts/services/notification-service.js
class NotificationService {
  constructor() {
    this.db = firebase.firestore();
    this.messaging = null;
    this.initialized = false;
    this.permission = 'default';
  }
  
  async initialize() {
    if (this.initialized) return this.permission;
    
    try {
      // Check if Firebase Messaging is available
      if (!firebase.messaging) {
        console.warn('Firebase Messaging is not available');
        return 'not-supported';
      }
      
      this.messaging = firebase.messaging();
      
      // Get permission status
      this.permission = Notification.permission;
      
      // Set up service worker if permission granted
      if (this.permission === 'granted') {
        await this.setupServiceWorker();
      }
      
      this.initialized = true;
      return this.permission;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return 'error';
    }
  }
  
  async requestPermission() {
    try {
      // Initialize if not already
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check if messaging is available
      if (!this.messaging) {
        return 'not-supported';
      }
      
      // Request permission
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      // If permission granted, set up service worker
      if (permission === 'granted') {
        await this.setupServiceWorker();
      }
      
      return permission;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return 'error';
    }
  }
  
  async setupServiceWorker() {
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      // Set up messaging
      this.messaging.useServiceWorker(registration);
      
      // Get token
      const token = await this.messaging.getToken();
      
      // Save token to Firestore
      await this.saveToken(token);
      
      // Handle token refresh
      this.messaging.onTokenRefresh(async () => {
        const refreshedToken = await this.messaging.getToken();
        await this.saveToken(refreshedToken);
      });
      
      // Handle foreground messages
      this.messaging.onMessage((payload) => {
        console.log('Message received in foreground:', payload);
        
        // Show notification
        const notification = new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: payload.notification.icon || '/icon.png'
        });
        
        // Handle notification click
        notification.onclick = () => {
          if (payload.data && payload.data.url) {
            window.open(payload.data.url, '_blank');
          }
          notification.close();
        };
      });
      
      return 'success';
    } catch (error) {
      console.error('Error setting up service worker:', error);
      return 'error';
    }
  }
  
  async saveToken(token) {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    
    try {
      // Save token to Firestore
      await this.db.collection('userNotifications').doc(user.uid).set({
        token: token,
        updatedAt: new Date(),
        enabled: true,
        platform: 'web'
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error('Error saving token:', error);
      return false;
    }
  }
  
  async updateNotificationPreferences(preferences) {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    
    try {
      // Update preferences in Firestore
      await this.db.collection('userNotifications').doc(user.uid).update({
        preferences: preferences,
        updatedAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
  }
  
  async getNotificationPreferences() {
    const user = firebase.auth().currentUser;
    if (!user) return null;
    
    try {
      // Get preferences from Firestore
      const doc = await this.db.collection('userNotifications').doc(user.uid).get();
      
      if (!doc.exists) {
        return {
          enabled: true,
          eventReminders: true,
          vibeUpdates: true,
          newEvents: true
        };
      }
      
      const data = doc.data();
      
      // Return preferences
      return {
        enabled: data.enabled ?? true,
        eventReminders: data.preferences?.eventReminders ?? true,
        vibeUpdates: data.preferences?.vibeUpdates ?? true,
        newEvents: data.preferences?.newEvents ?? true
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }
  
  async sendEventReminder(eventId, userId, reminderType) {
    // This would typically be done on the server, but we'll define the interface here
    // In a real app, you would create a Cloud Function to handle this
    
    try {
      // Create a reminder document
      await this.db.collection('notifications').add({
        eventId: eventId,
        userId: userId,
        type: 'event-reminder',
        reminderType: reminderType, // 'day' or 'hour'
        status: 'pending',
        createdAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error scheduling event reminder:', error);
      return false;
    }
  }
}

// Create a singleton instance
const notificationService = new NotificationService();

export default notificationService;