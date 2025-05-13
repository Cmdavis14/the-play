const increment = firebase.database.FieldValue.increment;
export { auth, firestore, storage, messaging, database, increment };


// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOPjdRIDVst4uZg6oqNPLhlqgj0XwqPH8",
  authDomain: "the-play-8f454.firebaseapp.com",
  projectId: "the-play-8f454",
  storageBucket: "the-play-8f454.firebasestorage.app",
  messagingSenderId: "919736772232",
  appId: "1:919736772232:web:5d52b627785e5569a7e13d",
  measurementId: "G-KYB0MJ4VKS",
  databaseURL: "https://the-play-8f454-default-rtdb.firebaseio.com" // Add Realtime Database URL
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const firestore = firebase.firestore();
const storage = firebase.storage();
const messaging = firebase.messaging();
const database = firebase.database(); // Initialize Realtime Database

export { auth, firestore, storage, messaging, database };