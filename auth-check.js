// auth-check.js
// Add this script to your existing index.html

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyDEn7ooJJ1zATM5oEnx3ByDiOFTFxr_JiA",
  authDomain: "rco-metrics-d0f3b.firebaseapp.com",
  projectId: "rco-metrics-d0f3b",
  storageBucket: "rco-metrics-d0f3b.firebasestorage.app",
  messagingSenderId: "1021645263850",
  appId: "1:1021645263850:web:dfd5c7cd0bd99762679893",
  measurementId: "G-DR5MLDL5BG"
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
