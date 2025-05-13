// Create file: public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBOPjdRIDVst4uZg6oqNPLhlqgj0XwqPH8",
  authDomain: "the-play-8f454.firebaseapp.com",
  projectId: "the-play-8f454",
  storageBucket: "the-play-8f454.firebasestorage.app",
  messagingSenderId: "919736772232",
  appId: "1:919736772232:web:5d52b627785e5569a7e13d",
  measurementId: "G-KYB0MJ4VKS"
});

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  // Customize notification here
  const notification = payload.notification;
  const notificationTitle = notification.title;
  const notificationOptions = {
    body: notification.body,
    icon: notification.icon || '/icon.png'
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click:', event);
  event.notification.close();
  
  // This looks to see if the current is already open and focuses if it is
  event.waitUntil(
    clients.matchAll({
      type: 'window'
    })
    .then((clientList) => {
      // Check if there is already a window/tab open with the target URL
      const url = event.notification.data?.url || '/';
      const hadWindowToFocus = clientList.some((client) => {
        if (client.url === url && 'focus' in client) {
          client.focus();
          return true;
        }
        return false;
      });
      
      // If no existing window, open a new one
      if (!hadWindowToFocus) {
        clients.openWindow(url).catch(err => console.error('Failed to open window:', err));
      }
    })
  );
});