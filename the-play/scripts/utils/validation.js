// Create file: scripts/utils/validation.js
function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

function validatePassword(password) {
  // At least 6 characters
  if (password.length < 6) {
    return {
      valid: false,
      message: 'Password must be at least 6 characters'
    };
  }
  // Optional: Add more password requirements
  // const hasUpperCase = /[A-Z]/.test(password);
  // const hasLowerCase = /[a-z]/.test(password);
  // const hasNumbers = /\d/.test(password);
  // const hasNonalphas = /\W/.test(password);
  // if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasNonalphas) {
  //   return {
  //     valid: false,
  //     message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  //   };
  // }
  return {
    valid: true
  };
}

function validateFormField(field, value) {
  if (!value || value.trim() === '') {
    return {
      valid: false,
      message: `${field} is required`
    };
  }
  return {
    valid: true
  };
}

export { validateEmail, validatePassword, validateFormField };