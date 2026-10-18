/**
 * ============================================================================
 * CAMPUS BONDHON - FIREBASE CONFIGURATION (js/firebase-config.js)
 * Team Name: Bondhon | Project: Campus Bondhon
 * ============================================================================
 * Live Firebase connected: Authentication + Firestore + Storage.
 * Every other file imports Firebase helpers from here.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
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
  where,
  limit,
  onSnapshot,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ============================================================================
// FIREBASE CONFIG (Campus Bondhon project)
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBUszR1VVWp8m6kiSZKjuLRucnvEtow0qM",
  authDomain: "campus-bondhon.firebaseapp.com",
  projectId: "campus-bondhon",
  storageBucket: "campus-bondhon.firebasestorage.app",
  messagingSenderId: "217307689396",
  appId: "1:217307689396:web:d67f85692db227110902e1",
  measurementId: "G-2FHW77NNTF"
};

// Detect if the placeholder config has been replaced
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
  sendPasswordResetEmail,
  updateProfile,
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
  where,
  limit,
  onSnapshot,
  increment,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
};
