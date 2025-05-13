// Create file: scripts/utils/date-format.js
function formatEventDate(date) {
  const now = new Date();
  const eventDate = new Date(date);
  
  // Check if date is today
  if (eventDate.toDateString() === now.toDateString()) {
    return 'Today • ' + formatTime(eventDate);
  }
  
  // Check if date is tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (eventDate.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow • ' + formatTime(eventDate);
  }
  
  // If date is within the next 7 days, show day of week
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  if (eventDate < nextWeek) {
    const dayOptions = { weekday: 'short' };
    return eventDate.toLocaleDateString('en-US', dayOptions) + ' • ' + formatTime(eventDate);
  }
  
  // For dates further in the future, show month and day
  const options = { month: 'short', day: 'numeric' };
  return eventDate.toLocaleDateString('en-US', options) + ' • ' + formatTime(eventDate);
}

function formatTime(date) {
  // Get hours and minutes
  let hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Convert to 12-hour format
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Handle midnight (0 hours)
  
  // Add leading zero to minutes if needed
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  
  // Return formatted time
  return minutes === 0 ? `${hours}${ampm}` : `${hours}:${minutesStr}${ampm}`;
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000); // Difference in seconds
  
  if (diff < 60) {
    return 'just now';
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    // For older dates, show the actual date
    const options = { month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
  }
}

export { formatEventDate, formatTime, formatRelativeTime };