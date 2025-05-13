import { validateEmail, validatePassword, validateFormField } from '../utils/validation.js';
import authentication from './authentication.js';
import loadingManager from '../components/loading.js';

function setupFormValidation() {
  // Setup signup form validation
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    const signupEmail = document.getElementById('signup-email');
    const signupPassword = document.getElementById('signup-password');
    const signupError = document.getElementById('signup-error');
    const signupSuccess = document.getElementById('signup-success');
    const signupButton = signupForm.querySelector('button[type="submit"]');
    
    signupForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      // Clear previous messages
      signupError.style.display = 'none';
      signupSuccess.style.display = 'none';
      
      // Validate email
      if (!validateEmail(signupEmail.value)) {
        showError('signup', 'Please enter a valid email address');
        return;
      }
      
      // Validate password
      const passwordValidation = validatePassword(signupPassword.value);
      if (!passwordValidation.valid) {
        showError('signup', passwordValidation.message);
        return;
      }

      // Show Loading State
      loadingManager.createButtonSpinner(signupButton, 'Creating account...');
      
      // Attempt signup
      const result = await authentication.signUp(signupEmail.value, signupPassword.value);

      // Reset Button
      loadingManager.resetButton(signupButton);
      
      if (result.success) {
        showSuccess('signup', 'Account created successfully!');
        
        // Show logged in UI then redirect
        setTimeout(() => {
          showLoggedInUser(result.user);
          
          setTimeout(() => {
            window.location.href = '../../pages/app/index.html?uid=' + result.user.uid;
          }, 1500);
        }, 1000);
      } else {
        showError('signup', result.error);
      }
    });
  }
  
  // Setup login form validation
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    const loginButton = loginForm.querySelector('button[type="submit"]');
    
    loginForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      // Clear previous messages
      loginError.style.display = 'none';
      
      // Validate email
      if (!validateEmail(loginEmail.value)) {
        showError('login', 'Please enter a valid email address');
        return;
      }
      
      // Validate password not empty
      if (!loginPassword.value) {
        showError('login', 'Please enter your password');
        return;
      }
      
      // Show Loading State
      loadingManager.createButtonSpinner(loginButton, 'Logging in...');
      
      // Attempt login
      const result = await authentication.logIn(loginEmail.value, loginPassword.value);
      
      // Reset Button
      loadingManager.resetButton(loginButton);
      
      if (result.success) {
        // Show logged in UI then redirect
        showLoggedInUser(result.user);
        
        setTimeout(() => {
          window.location.href = '../../pages/app/index.html?uid=' + result.user.uid;
        }, 1500);
      } else {
        showError('login', result.error);
      }
    });
  }
  
  // Setup social login buttons
  const googleBtn = document.querySelector('[onclick="signInWithGoogle()"]');
  if (googleBtn) {
    googleBtn.removeAttribute('onclick');
    googleBtn.addEventListener('click', async function() {
      // Show Loading State
      loadingManager.createButtonSpinner(googleBtn, 'Connecting with Google...');
      
      const result = await authentication.signInWithGoogle();
      
      // Reset Button
      loadingManager.resetButton(googleBtn);
      
      if (result.success) {
        // Show logged in UI then redirect
        showLoggedInUser(result.user);
        
        setTimeout(() => {
          window.location.href = '../../pages/app/index.html?uid=' + result.user.uid;
        }, 1500);
      } else {
        showError('login', result.error);
      }
    });
  }
  
  const facebookBtn = document.querySelector('[onclick="signInWithFacebook()"]');
  if (facebookBtn) {
    facebookBtn.removeAttribute('onclick');
    facebookBtn.addEventListener('click', async function() {
      // Show Loading State
      loadingManager.createButtonSpinner(facebookBtn, 'Connecting with Facebook...');
      
      const result = await authentication.signInWithFacebook();
      
      // Reset Button
      loadingManager.resetButton(facebookBtn);
      
      if (result.success) {
        // Show logged in UI then redirect
        showLoggedInUser(result.user);
        
        setTimeout(() => {
          window.location.href = '../../pages/app/index.html?uid=' + result.user.uid;
        }, 1500);
      } else {
        showError('login', result.error);
      }
    });
  }
  
  // Add this call to setupRealtimeValidation
  setupRealtimeValidation();
}

// Add this new function from section 4.2
function setupRealtimeValidation() {
  // Real-time email validation
  const emailInputs = document.querySelectorAll('input[type="email"]');
  emailInputs.forEach(input => {
    const formType = input.id.split('-')[0]; // 'signup' or 'login'
    
    input.addEventListener('blur', function() {
      if (input.value && !validateEmail(input.value)) {
        input.classList.add('border-red-500');
        showFeedback(input, 'Please enter a valid email address', 'error');
      } else {
        input.classList.remove('border-red-500');
        hideFeedback(input);
      }
    });
    
    input.addEventListener('input', function() {
      if (input.value && validateEmail(input.value)) {
        input.classList.remove('border-red-500');
        input.classList.add('border-green-500');
        showFeedback(input, 'Valid email', 'success');
      } else {
        input.classList.remove('border-green-500');
        hideFeedback(input);
      }
    });
  });
  
  // Real-time password validation
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  passwordInputs.forEach(input => {
    const formType = input.id.split('-')[0]; // 'signup' or 'login'
    
    input.addEventListener('input', function() {
      if (formType === 'signup') {
        const validation = validatePassword(input.value);
        if (!validation.valid) {
          input.classList.add('border-red-500');
          input.classList.remove('border-green-500');
          showFeedback(input, validation.message, 'error');
        } else {
          input.classList.remove('border-red-500');
          input.classList.add('border-green-500');
          showFeedback(input, 'Password meets requirements', 'success');
        }
      }
    });
  });
}

// Add these helper functions for real-time validation
function showFeedback(input, message, type) {
  // Check if feedback element already exists
  let feedback = input.parentNode.querySelector('.input-feedback');
  
  if (!feedback) {
    // Create feedback element
    feedback = document.createElement('p');
    feedback.className = 'input-feedback text-xs mt-1';
    input.parentNode.appendChild(feedback);
  }
  
  // Set message and style
  feedback.textContent = message;
  
  if (type === 'error') {
    feedback.className = 'input-feedback text-xs mt-1 text-red-500';
  } else if (type === 'success') {
    feedback.className = 'input-feedback text-xs mt-1 text-green-500';
  }
}

function hideFeedback(input) {
  const feedback = input.parentNode.querySelector('.input-feedback');
  if (feedback) {
    feedback.textContent = '';
  }
}

// Helper functions (these replicate the functions from the original auth.js)
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

export { setupFormValidation };
