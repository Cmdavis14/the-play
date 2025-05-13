// Component loader script that needs to be added to all pages
// This ensures navigation works properly no matter where you are in the app
// Create file: scripts/app-navigation.js

/**
 * Helper functions for navigating within the application
 */
(function(window) {
  // Function to determine current location within the app
  function getCurrentLocation() {
    const path = window.location.pathname;
    console.log("Current path:", path);
    
    if (path.includes('/pages/app/')) {
      return 'app';
    } else if (path.includes('/pages/auth/')) {
      return 'auth';
    } else {
      return 'root';
    }
  }
  
  // Function to navigate to a specific page
  function navigateTo(page) {
    const currentLocation = getCurrentLocation();
    let targetPath;
    
    console.log("Navigating to:", page, "from", currentLocation);
    
    switch(currentLocation) {
      case 'app':
        // Already in app directory, just go to the page
        targetPath = page;
        break;
      case 'auth':
        // In auth directory, navigate to app
        targetPath = '../app/' + page;
        break;
      case 'root':
        // In root directory, navigate to app
        targetPath = 'pages/app/' + page;
        break;
      default:
        // Fallback
        targetPath = 'pages/app/' + page;
    }
    
    console.log("Target path:", targetPath);
    window.location.href = targetPath;
  }
  
  // Function to logout user
  function logoutUser() {
    console.log("Logging out user...");
    
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut()
        .then(() => {
          console.log("Successfully logged out!");
          
          // Navigate to login page
          const currentLocation = getCurrentLocation();
          let loginPath;
          
          switch(currentLocation) {
            case 'app':
              loginPath = '../auth/login.html';
              break;
            case 'auth':
              loginPath = 'login.html';
              break;
            case 'root':
              loginPath = 'pages/auth/login.html';
              break;
            default:
              loginPath = 'pages/auth/login.html';
          }
          
          console.log("Redirecting to:", loginPath);
          window.location.href = loginPath;
        })
        .catch((error) => {
          console.error("Error signing out:", error);
          alert("Error logging out: " + error.message);
        });
    } else {
      console.error("Firebase Auth not available");
      alert("Firebase is not initialized. Cannot log out.");
    }
  }
  
  // Make functions available globally
  window.AppNavigation = {
    navigateTo: navigateTo,
    logoutUser: logoutUser
  };
})(window);