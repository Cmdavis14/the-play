// Create file: scripts/components/events.js
import errorHandler from '../utils/error-handler.js';

function createEventCard(eventData, containerId) {
  try {
    // Get the template
    const template = document.getElementById('event-card-template');
    if (!template) {
      console.error('Event card template not found');
      return;
    }
    
    // Clone the template
    const clone = template.content.cloneNode(true);
    
    // Populate the card with data
    clone.querySelector('.event-title').textContent = eventData.title;
    clone.querySelector('.event-score').textContent = eventData.score || '8.5';
    clone.querySelector('.event-time').textContent = eventData.time || 'Tonight • 9PM';
    clone.querySelector('.event-location').textContent = eventData.location;
    clone.querySelector('.event-attendees').textContent = eventData.attendees || '0';
    clone.querySelector('.event-description').textContent = eventData.description;
    clone.querySelector('.event-price').textContent = eventData.price || 'Free';
    
    // Set image if provided
    if (eventData.imageUrl) {
      const imgElement = clone.querySelector('img');
      if (imgElement) {
        imgElement.src = eventData.imageUrl;
        imgElement.alt = eventData.title;
      }
    }
    
    // Set button text
    const actionBtn = clone.querySelector('.event-action-btn');
    if (actionBtn) {
      actionBtn.textContent = eventData.actionText || 'Get Tickets';
    }
    
    // Add event handlers
    const bookmarkBtn = clone.querySelector('.bookmark-btn');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent card click
        toggleBookmark(eventData.id, bookmarkBtn);
      });
    }
    
    if (actionBtn) {
      actionBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent card click
        eventAction(eventData.id, eventData.actionType || 'tickets');
      });
    }
    
    // Make the whole card clickable
    const card = clone.querySelector('.event-card');
    if (card) {
      card.addEventListener('click', function() {
        window.location.href = `event-details.html?id=${eventData.id}`;
      });
      
      // Add hover style
      card.style.cursor = 'pointer';
    }
    
    // Append to container
    const container = document.getElementById(containerId);
    if (container) {
      container.appendChild(clone);
    } else {
      console.error(`Container with ID ${containerId} not found`);
    }
  } catch (error) {
    console.error('Error creating event card:', error);
    errorHandler.logError(error, { method: 'createEventCard', eventData });
  }
}

function toggleBookmark(eventId, buttonElement) {
  try {
    // Check if user is logged in
    const user = firebase.auth().currentUser;
    if (!user) {
      errorHandler.showToast('Please login to bookmark events', 'warning');
      return;
    }
    
    // Toggle icon style
    const icon = buttonElement.querySelector('i');
    const isBookmarked = icon.classList.contains('text-yellow-500');
    
    if (isBookmarked) {
      // Remove bookmark
      icon.classList.remove('text-yellow-500');
      icon.classList.add('text-gray-400');
      
      // Show toast
      errorHandler.showToast('Event removed from bookmarks', 'info');
      
      // Remove from Firestore
      if (firebase.firestore) {
        firebase.firestore().collection('bookmarks')
          .where('userId', '==', user.uid)
          .where('eventId', '==', eventId)
          .get()
          .then(snapshot => {
            snapshot.forEach(doc => {
              doc.ref.delete();
            });
          })
          .catch(error => {
            console.error('Error removing bookmark:', error);
          });
      }
    } else {
      // Add bookmark
      icon.classList.remove('text-gray-400');
      icon.classList.add('text-yellow-500');
      
      // Show toast
      errorHandler.showToast('Event bookmarked!', 'success');
      
      // Add to Firestore
      if (firebase.firestore) {
        firebase.firestore().collection('bookmarks').add({
          userId: user.uid,
          eventId: eventId,
          createdAt: new Date()
        })
        .catch(error => {
          console.error('Error adding bookmark:', error);
        });
      }
    }
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    errorHandler.logError(error, { method: 'toggleBookmark', eventId });
  }
}

function eventAction(eventId, actionType) {
  try {
    switch (actionType) {
      case 'tickets':
        window.location.href = `tickets.html?event=${eventId}`;
        break;
      case 'rsvp':
        // Show RSVP confirmation dialog
        if (confirm('RSVP to this event?')) {
          // Handle RSVP logic here
          errorHandler.showToast('RSVP successful!', 'success');
        }
        break;
      default:
        window.location.href = `event-details.html?id=${eventId}`;
    }
  } catch (error) {
    console.error('Error performing event action:', error);
    errorHandler.logError(error, { method: 'eventAction', eventId, actionType });
  }
}

function loadEvents() {
  try {
    console.log('Loading events...');
    
    // Check if Firestore is available
    if (firebase && firebase.firestore) {
      console.log('Firestore is available, loading from database');
      
      const db = firebase.firestore();
      db.collection('events')
        .orderBy('createdAt', 'desc')
        .limit(6)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            console.log('No events found in Firestore, loading sample data');
            loadSampleEvents();
          } else {
            console.log(`Found ${snapshot.size} events in Firestore`);
            snapshot.forEach(doc => {
              const eventData = doc.data();
              eventData.id = doc.id;
              createEventCard(eventData, 'events-container');
            });
          }
        })
        .catch(error => {
          console.error('Error loading events from Firestore:', error);
          errorHandler.logError(error, { method: 'loadEvents' });
          loadSampleEvents();
        });
    } else {
      console.log('Firestore not available, loading sample data');
      loadSampleEvents();
    }
  } catch (error) {
    console.error('Error in loadEvents:', error);
    errorHandler.logError(error, { method: 'loadEvents' });
    loadSampleEvents();
  }
}

function loadSampleEvents() {
  console.log('Loading sample events');
  
  sampleEvents.forEach(eventData => {
    createEventCard(eventData, 'events-container');
  });
}

// Sample data for testing
const sampleEvents = [
  {
    id: '1',
    title: 'Neon Nights: 80s Revival',
    score: '9.2',
    time: 'Tonight • 9PM',
    location: 'The Aztec Theatre',
    attendees: '243',
    description: 'Experience the ultimate 80s dance party with live DJs, themed cocktails, and retro vibes.',
    price: '$25 - $45',
    actionText: 'Get Tickets',
    actionType: 'tickets'
  },
  {
    id: '2',
    title: 'Sunday Jazz Brunch',
    score: '8.7',
    time: 'Sunday • 11AM',
    location: 'Jazz, TX',
    attendees: '78',
    description: 'Enjoy a relaxing Sunday with live jazz music and delicious brunch offerings at this Pearl favorite.',
    price: '$35',
    actionText: 'Reserve',
    actionType: 'rsvp'
  },
  {
    id: '3',
    title: 'Food Truck Festival',
    score: '9.5',
    time: 'Saturday • 12PM',
    location: 'Main Plaza',
    attendees: '512',
    description: 'Sample the best food trucks in San Antonio all in one place with live music and family activities.',
    price: 'Free Entry',
    actionText: 'Details',
    actionType: 'details'
  },
  {
    id: '4',
    title: 'Rooftop Yoga & Mimosas',
    score: '8.9',
    time: 'Sunday • 9AM',
    location: 'Hotel Valencia',
    attendees: '45',
    description: 'Start your Sunday with relaxing yoga and mimosas while enjoying the city skyline view.',
    price: '$25',
    actionText: 'Join',
    actionType: 'rsvp'
  },
  {
    id: '5',
    title: 'Craft Beer Festival',
    score: '9.3',
    time: 'Saturday • 3PM',
    location: 'Hemisfair Park',
    attendees: '325',
    description: 'Sample over 50 craft beers from Texas breweries with food pairings and live music.',
    price: '$40',
    actionText: 'Get Tickets',
    actionType: 'tickets'
  },
  {
    id: '6',
    title: 'Art Gallery Opening',
    score: '8.5',
    time: 'Friday • 7PM',
    location: 'Blue Star Arts Complex',
    attendees: '120',
    description: 'Be among the first to see the new exhibition featuring works from emerging local artists.',
    price: 'Free',
    actionText: 'RSVP',
    actionType: 'rsvp'
  }
];

export { createEventCard, loadEvents, toggleBookmark, eventAction };