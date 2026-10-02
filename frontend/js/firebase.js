// Firebase App
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// Firebase Analytics
import {
    getAnalytics,
    logEvent
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";

// Firebase Firestore
import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Firebase Auth
import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBXoozxOvgIe2CcdYkQJ2zjDYBnjnWhE-Q",
    authDomain: "scceclub-5681e.firebaseapp.com",
    projectId: "scceclub-5681e",
    storageBucket: "scceclub-5681e.firebasestorage.app",
    messagingSenderId: "1051543887567",
    appId: "1:1051543887567:web:16271ac9ddc59510ac61ba",
    measurementId: "G-MWFKFMBHX1"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Analytics
export const analytics = getAnalytics(app);


// Firestore
export const db = getFirestore(app);


// Authentication
export const auth = getAuth(app);

export { signInAnonymously };


// Export Analytics helper
export { logEvent };