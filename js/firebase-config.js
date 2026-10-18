/**
 * ============================================================================
 * CAMPUS BONDHON - FIREBASE CONFIGURATION (js/firebase-config.js)
 * Team Name: Bondhon | Project: Campus Bondhon
 * ============================================================================
 *
 * HOW TO SET UP FIREBASE:
 * 1. Go to https://console.firebase.google.com/ and create a free project.
 * 2. Click the Web icon (</>) to register your app "Campus Bondhon".
 * 3. Copy your firebaseConfig values from Firebase Console and replace the
 *    placeholder strings below.
 * 4. NOTE: Until you replace "YOUR_API_KEY" below, Campus Bondhon automatically
 *    runs in "Local Demo Mode" (using browser storage) so you can test every
 *    feature right away!
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ============================================================================
// EDIT HERE: PASTE YOUR FIREBASE CONFIG CREDENTIALS BELOW
// ============================================================================
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Detect if the student has replaced the placeholder config yet
export const IS_FIREBASE_CONFIGURED =
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  !firebaseConfig.apiKey.includes("YOUR_");

let app = null;
let auth = null;
let db = null;
let storage = null;

if (IS_FIREBASE_CONFIGURED) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Campus Bondhon connected to Firebase successfully.");
  } catch (err) {
    console.warn("Firebase initialization failed, falling back to Local Demo Mode:", err);
  }
} else {
  console.info("Campus Bondhon is running in Local Demo Mode. Update js/firebase-config.js to connect live Firebase.");
}

export {
  app,
  auth,
  db,
  storage,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
};
