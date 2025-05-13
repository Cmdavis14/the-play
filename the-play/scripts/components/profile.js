// Fixed file: scripts/components/profile.js
class UserProfile {
  constructor() {
    this.currentUser = null;
    this.userData = null;
    this.isInitialized = false;
    this.profileListeners = [];
  }
  
  async initialize() {
    if (this.isInitialized) return;
    
    // Wait for Firebase Auth to initialize
    await new Promise(resolve => {
      const unsubscribe = firebase.auth().onAuthStateChanged(user => {
        this.currentUser = user;
        unsubscribe();
        resolve();
      });
    });

    // Get current user if available
    this.currentUser = firebase.auth().currentUser;

    if (this.currentUser) {
      await this.loadUserData();
      this.setupRealTimeUpdates();
    }
    
    this.isInitialized = true;
    return this.userData;
  }

  setupRealTimeUpdates() {
    // Check if user exists before setting up listeners
    if (!this.currentUser) return;
    
    // Remove any existing listeners
    this.profileListeners.forEach(unsubscribe => unsubscribe());
    this.profileListeners = [];
    
    // Set up listener for user profile changes
    const db = firebase.firestore();
    const userDocRef = db.collection('users').doc(this.currentUser.uid);
    
    const unsubscribe = userDocRef.onSnapshot(doc => {
      if (doc.exists) {
        this.userData = doc.data();
        // Notify UI components that might need updating
        this.notifyProfileUpdate();
      }
    }, error => {
      console.error('Error in user profile snapshot listener:', error);
    });
    
    this.profileListeners.push(unsubscribe);
  }

  notifyProfileUpdate() {
    // Custom event to notify UI components of profile updates
    const event = new CustomEvent('user-profile-updated', {
        detail: {
            userData: this.userData
        }
    });
    document.dispatchEvent(event);
  }
  
  async loadUserData() {
    if (!this.currentUser) return null;
    
    try {
      const db = firebase.firestore();
      const doc = await db.collection('users').doc(this.currentUser.uid).get();
      
      if (doc.exists) {
        this.userData = doc.data();
        return this.userData;
      } else {
        // Create user profile if it doesn't exist
        const userData = {
          email: this.currentUser.email,
          displayName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
          photoURL: this.currentUser.photoURL || null,
          createdAt: new Date(),
          lastLogin: new Date()
        };
        
        await db.collection('users').doc(this.currentUser.uid).set(userData);
        this.userData = userData;
        return userData;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      return null;
    }
  }
  
  getDisplayName() {
    if (this.userData && this.userData.displayName) {
      return this.userData.displayName;
    }
    
    if (this.currentUser) {
      return this.currentUser.displayName || this.currentUser.email.split('@')[0];
    }
    
    return 'User';
  }
  
  getPhotoURL() {
    if (this.userData && this.userData.photoURL) {
      return this.userData.photoURL;
    }
    
    if (this.currentUser && this.currentUser.photoURL) {
      return this.currentUser.photoURL;
    }
    
    return '/api/placeholder/100/100';
  }
  
  async updateProfile(data) {
    if (!this.currentUser) return false;
    
    try {
      const db = firebase.firestore();
      await db.collection('users').doc(this.currentUser.uid).update({
        ...data,
        updatedAt: new Date()
      });
      
      // Refresh user data
      await this.loadUserData();
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  }
  
  async getBookmarkedEvents() {
    if (!this.currentUser) return [];
    
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection('bookmarks')
        .where('userId', '==', this.currentUser.uid)
        .get();
      
      const bookmarkIds = snapshot.docs.map(doc => doc.data().eventId);
      
      if (bookmarkIds.length === 0) return [];
      
      // Get the actual events
      const eventsSnapshot = await db.collection('events')
        .where(firebase.firestore.FieldPath.documentId(), 'in', bookmarkIds)
        .get();
      
      return eventsSnapshot.docs.map(doc => {
        return {
          id: doc.id,
          ...doc.data()
        };
      });
    } catch (error) {
      console.error('Error getting bookmarked events:', error);
      return [];
    }
  }
}

// Create a singleton instance
const userProfile = new UserProfile();

export default userProfile;