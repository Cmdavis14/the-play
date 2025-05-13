// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBOPjdRIDVst4uZg6oqNPLhlqgj0XwqPH8",
  authDomain: "the-play-8f454.firebaseapp.com",
  projectId: "the-play-8f454",
  storageBucket: "the-play-8f454.appspot.com", // Fixed typo in URL
  messagingSenderId: "919736772232",
  appId: "1:919736772232:web:5d52b627785e5569a7e13d",
  measurementId: "G-KYB0MJ4VKS"
});

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  // Customize notification here
  const notification = payload.notification || {};
  const notificationTitle = notification.title || 'New Notification';
  const notificationOptions = {
    body: notification.body || '',
    icon: notification.icon || '/assets/images/icons/notification-icon.png',
    badge: '/assets/images/icons/badge-icon.png',
    data: payload.data || {}
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  event.notification.close();
  
  // This looks to see if the current is already open and focuses if it is
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      // Extract URL from notification data or use default
      const url = event.notification.data?.url || '/';
      
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no existing window found, open a new one
      return clients.openWindow(url);
    })
    .catch(err => console.error('[firebase-messaging-sw.js] Failed to handle notification click:', err))
  );
});