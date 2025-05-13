// scripts/firebase/config.js
// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOPjdRIDVst4uZg6oqNPLhlqgj0XwqPH8",
  authDomain: "the-play-8f454.firebaseapp.com",
  projectId: "the-play-8f454",
  storageBucket: "the-play-8f454.firebasestorage.app",
  messagingSenderId: "919736772232",
  appId: "1:919736772232:web:5d52b627785e5569a7e13d",
  measurementId: "G-KYB0MJ4VKS",
  databaseURL: "https://the-play-8f454-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const firestore = firebase.firestore();
const storage = firebase.storage();
let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.log("Messaging not available");
}
const database = firebase.database();
const realtimeDB = firebase.database();

// Export the Firebase services
export { auth, firestore, storage, messaging, database, realtimeDB };

// Also export Firebase - in many files you're using firebase directly
export const firebase = window.firebase;

console.log("Firebase config loaded successfully");