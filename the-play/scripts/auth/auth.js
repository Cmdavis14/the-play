// Simple auth.js - Only essential Firebase Authentication for The Play
console.log("Simple auth.js loaded");

// Simple auth.js - Only essential Firebase Authentication for The Play
console.log("Simple auth.js loaded");

// Firebase auth and db are initialized in config.js and available globally
// We assume auth and db are available through the imported config.js script

// ==== MAIN PAGE FUNCTIONS ====

// Function to check if user is authenticated on main page
function checkAuth() {
  auth.onAuthStateChanged(user => {
    if (user) {
      console.log("User is authenticated:", user.email);
      return true;
    } else {
      console.log("No user is authenticated");
      return false;
    }
  });
}

// Log out function for main page
function logOut() {
  console.log("Logout function called");
  auth.signOut().then(() => {
    alert("You have been logged out.");
    window.location.href = "../../pages/auth/login.html";
  }).catch(error => {
    alert("Error logging out: " + error.message);
  });
}

// ==== LOGIN PAGE FUNCTIONS ====

// Sign up function
function signUp() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  
  document.getElementById('signup-error').style.display = 'none';
  document.getElementById('signup-success').style.display = 'none';
  
  if (password.length < 6) {
    showError('signup', 'Password must be at least 6 characters');
    return;
  }
  
  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      showSuccess('signup', 'Account created successfully!');
      
      // Create user profile in Firestore if available
      if (db) {
        db.collection('users').doc(userCredential.user.uid).set({
          email: email,
          createdAt: new Date(),
          lastLogin: new Date()
        }).catch(error => console.error("Error creating user profile:", error));
      }
      
      // After success, show logged in UI then redirect
      setTimeout(() => {
        showLoggedInUser(userCredential.user);
        
        setTimeout(() => {
          window.location.href = '../../pages/app/index.html?uid=' + userCredential.user.uid;
        }, 1500);
      }, 1000);
    })
    .catch(error => {
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
      showError('signup', errorMessage);
    });
}

// Log in function
function logIn() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  document.getElementById('login-error').style.display = 'none';
  
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      console.log("Login successful:", userCredential.user.email);
      
      // Update last login time if Firestore is available
      if (db) {
        db.collection('users').doc(userCredential.user.uid).update({
          lastLogin: new Date()
        }).catch(error => console.error("Error updating last login:", error));
      }
      
      // Show logged in UI
      showLoggedInUser(userCredential.user);
      
      // Redirect to main page
      setTimeout(() => {
        window.location.href = '../../pages/app/index.html?uid=' + userCredential.user.uid;
      }, 1500);
    })
    .catch(error => {
      console.error("Login error:", error.code, error.message);
      
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
      showError('login', errorMessage);
    });
}

// Sign in with Google
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(result => {
      console.log("Google sign-in successful:", result.user.email);
      
      // Create/update user profile in Firestore
      if (db) {
        db.collection('users').doc(result.user.uid).set({
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          lastLogin: new Date()
        }, { merge: true })
        .catch(error => console.error("Error updating user profile:", error));
      }
      
      // Show logged in UI
      showLoggedInUser(result.user);
      
      // Redirect to main page
      setTimeout(() => {
        window.location.href = '../../pages/app/index.html?uid=' + result.user.uid;
      }, 1500);
    })
    .catch(error => {
      console.error('Google sign-in error:', error);
      showError('login', 'Google sign-in failed. Please try again.');
    });
}

// Sign in with Facebook
function signInWithFacebook() {
  const provider = new firebase.auth.FacebookAuthProvider();
  auth.signInWithPopup(provider)
    .then(result => {
      console.log("Facebook sign-in successful:", result.user.email);
      
      // Create/update user profile in Firestore
      if (db) {
        db.collection('users').doc(result.user.uid).set({
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          lastLogin: new Date()
        }, { merge: true })
        .catch(error => console.error("Error updating user profile:", error));
      }
      
      // Show logged in UI
      showLoggedInUser(result.user);
      
      // Redirect to main page
      setTimeout(() => {
        window.location.href = '../../pages/app/index.html?uid=' + result.user.uid;
      }, 1500);
    })
    .catch(error => {
      console.error('Facebook sign-in error:', error);
      showError('login', 'Facebook sign-in failed. Please try again.');
    });
}

// UI Helper Functions
function showError(formType, message) {
  const errorElement = document.getElementById(`${formType}-error`);
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

function showSuccess(formType, message) {
  const successElement = document.getElementById(`${formType}-success`);
  successElement.textContent = message;
  successElement.style.display = 'block';
}

function showLoggedInUser(user) {
  // Hide forms if they exist
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  
  if (signupForm) signupForm.classList.add('hidden');
  if (loginForm) loginForm.classList.add('hidden');
  
  // Update user info elements
  const userLoggedIn = document.getElementById('user-logged-in');
  if (userLoggedIn) {
    const userDisplayName = document.getElementById('user-display-name');
    const userEmail = document.getElementById('user-email');
    const userProfilePic = document.getElementById('user-profile-pic');
    
    if (userDisplayName) userDisplayName.textContent = user.displayName || 'User';
    if (userEmail) userEmail.textContent = user.email;
    if (userProfilePic && user.photoURL) userProfilePic.src = user.photoURL;
    
    // Show logged in section
    userLoggedIn.classList.remove('hidden');
  }
}