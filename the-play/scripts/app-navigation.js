// Replace the entire contents of scripts/app-navigation.js with this:

(function(window) {
  // Function to navigate to a specific page
  function navigateTo(page) {
    console.log("Navigating to:", page);
    
    // Handle absolute URLs
    if (page.startsWith('http://') || page.startsWith('https://')) {
      window.location.href = page;
      return;
    }
    
    // Get the current location
    const path = window.location.pathname;
    console.log("Current path:", path);
    
    // Determine the base URL
    let basePath = '';
    
    if (path.includes('/pages/app/')) {
      // In app directory
      basePath = '../../';  // Go back to root
    } else if (path.includes('/pages/auth/')) {
      // In auth directory
      basePath = '../../';  // Go back to root
    } else {
      // Likely at root or unknown location
      basePath = './';
    }
    
    // Build the target URL
    let targetUrl;
    
    // If the page starts with "pages/", it's a full path from root
    if (page.startsWith('pages/')) {
      targetUrl = basePath + page;
    } 
    // If we're in app directory and the target doesn't specify directory
    else if (path.includes('/pages/app/') && !page.includes('/')) {
      targetUrl = page;  // Stay in same directory
    }
    // If we're in auth directory and target is for app
    else if (path.includes('/pages/auth/')) {
      targetUrl = '../app/' + page;
    }
    // Default case - assume going to app directory
    else {
      targetUrl = basePath + 'pages/app/' + page;
    }
    
    console.log("Full target URL:", targetUrl);
    window.location.href = targetUrl;
  }
  
  // Function to logout user
  function logoutUser() {
    console.log("Logging out user...");
    
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut()
        .then(() => {
          console.log("Successfully logged out!");
          
          // Navigate to login page based on current location
          const path = window.location.pathname;
          let loginPath;
          
          if (path.includes('/pages/app/')) {
            loginPath = '../auth/login.html';
          } else if (path.includes('/pages/auth/')) {
            loginPath = 'login.html';
          } else {
            loginPath = './pages/auth/login.html';
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
  
  // Make functions available globally with clear console message
  window.AppNavigation = {
    navigateTo: navigateTo,
    logoutUser: logoutUser
  };
  
  console.log("📌 App Navigation initialized!");
})(window);