// Create file: scripts/auth/authentication.js
import userProfile from '../components/profile.js';
import errorHandler from '../utils/error-handler.js';
import loadingManager from '../components/loading.js';


class Authentication {
  constructor() {
    this.auth = firebase.auth();
    this.db = firebase.firestore();
  }
  
  async signUp(email, password) {
    try {
      // Show loading
      loadingManager.showLoading('Creating your account...');
      
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
      
      // Create user profile in Firestore
      await this.db.collection('users').doc(userCredential.user.uid).set({
        email: email,
        createdAt: new Date(),
        lastLogin: new Date()
      });

      // Hide Loading 
      loadingManager.hideLoading();
      
      return {
        success: true,
        user: userCredential.user
      };
    } catch (error) {
      // Hide Loading
      loadingManager.hideLoading();
      
      // Log the error
      errorHandler.logError(error, { method: 'signup', email});
      
      let errorMessage;
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Try logging in instead.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        default:
          errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  async logIn(email, password) {
    try {
      // Show loading
      loadingManager.showLoading('Logging in...');
      
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      
      // Update last login time
      await this.db.collection('users').doc(userCredential.user.uid).update({
        lastLogin: new Date()
      });

      // Hide Loading
      loadingManager.hideLoading();

      return {
        success: true,
        user: userCredential.user
      };
    } catch (error) {
      // Hide Loading
      loadingManager.hideLoading();
      
      // Log the error
      errorHandler.logError(error, { method: 'login', email});  
      
      let errorMessage;
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed login attempts. Please try again later.';
          break;
        default:
          errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  async signInWithGoogle() {
    try {
      // Show loading
      loadingManager.showLoading('Signing in with Google...');
      
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.auth.signInWithPopup(provider);
      
      // Create/update user profile in Firestore
      await this.db.collection('users').doc(result.user.uid).set({
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        lastLogin: new Date()
      }, { merge: true });
      
      // Hide Loading
      loadingManager.hideLoading();

      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      // Hide Loading
      loadingManager.hideLoading();
      
      // Log the error
      errorHandler.logError(error, { method: 'googleSignIn' });

      return {
        success: false,
        error: 'Google sign-in failed. Please try again.'
      };
    }
  }
  
  async signInWithFacebook() {
    try {
      // Show loading
      loadingManager.showLoading('Signing in with Facebook...');
      
      const provider = new firebase.auth.FacebookAuthProvider();
      const result = await this.auth.signInWithPopup(provider);
      
      // Create/update user profile in Firestore
      await this.db.collection('users').doc(result.user.uid).set({
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        lastLogin: new Date()
      }, { merge: true });
      
      // Hide Loading
      loadingManager.hideLoading();
      
      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      // Hide Loading
      loadingManager.hideLoading();
      
      // Log the error
      errorHandler.logError(error, { method: 'facebookSignIn' });
      
      return {
        success: false,
        error: 'Facebook sign-in failed. Please try again.'
      };
    }
  }
  
  async logOut() {
    try {
      // Show loading
      loadingManager.showLoading('Logging out...');
      
      await this.auth.signOut();
      
      // Hide Loading
      loadingManager.hideLoading();
      
      return { success: true };
    } catch (error) {
      // Hide Loading
      loadingManager.hideLoading();
      
      // Log the error
      errorHandler.logError(error, { method: 'logout' });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  getCurrentUser() {
    return this.auth.currentUser;
  }
  
  onAuthStateChanged(callback) {
    return this.auth.onAuthStateChanged(callback);
  }
}

// Create a singleton instance
const authentication = new Authentication();

export default authentication;