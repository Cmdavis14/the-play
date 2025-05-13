// scripts/app-navigation.js
(function(window) {
  // Helper function to get base path
  function getBasePath() {
    const path = window.location.pathname;
    
    if (path.includes('/pages/app/')) {
      return '../../';
    } else if (path.includes('/pages/auth/')) {
      return '../../';
    } else {
      return './';
    }
  }
  
  // Helper function to get relative path for app pages
  function getAppPath(page) {
    const path = window.location.pathname;
    
    if (path.includes('/pages/app/')) {
      return page;
    } else if (path.includes('/pages/auth/')) {
      return '../app/' + page;
    } else {
      return 'pages/app/' + page;
    }
  }
  
  // Helper function to get relative path for auth pages
  function getAuthPath(page) {
    const path = window.location.pathname;
    
    if (path.includes('/pages/app/')) {
      return '../auth/' + page;
    } else if (path.includes('/pages/auth/')) {
      return page;
    } else {
      return 'pages/auth/' + page;
    }
  }

  // Navigate to app page
  function navigateToApp(page) {
    window.location.href = getAppPath(page);
  }
  
  // Navigate to auth page
  function navigateToAuth(page) {
    window.location.href = getAuthPath(page);
  }
  
  // Navigate home
  function navigateHome() {
    navigateToApp('index.html');
  }
  
  // Logout user
  function logoutUser() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut()
        .then(() => {
          // Navigate to login page
          navigateToAuth('login.html');
        })
        .catch((error) => {
          console.error("Error signing out:", error);
          alert("Error logging out: " + error.message);
        });
    } else {
      console.error("Firebase Auth not available");
      alert("Firebase is not initialized. Cannot log out.");
      
      // As a fallback, try to navigate to login
      navigateToAuth('login.html');
    }
  }
  
  // Make functions available globally
  window.AppNavigation = {
    navigateToApp,
    navigateToAuth,
    navigateHome,
    logoutUser
  };
  
  console.log("📌 App Navigation initialized!");
})(window);