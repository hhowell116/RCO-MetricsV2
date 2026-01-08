// auth-check.js
// Add this script to your existing index.html

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// TODO: Replace with your Firebase config (same as login.html)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Check authentication status
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Not signed in, redirect to login page
    window.location.href = 'login.html';
  } else {
    // User is signed in, show their info if you want
    console.log('Signed in as:', user.email);
    
    // Optional: Display user avatar if you add it to your UI
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
      userAvatar.src = user.photoURL || '';
    }
  }
});

// Sign out function (call this from a sign-out button)
window.signOutUser = async function() {
  try {
    await firebaseSignOut(auth);
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Sign out error:', error);
    alert('Failed to sign out. Please try again.');
  }
};
