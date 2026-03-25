import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Konfigurasi Firebase - GANTI DENGAN KONFIGURASI ANDA SENDIRI
// Buat project di https://console.firebase.google.com/
const firebaseConfig = {
 const firebaseConfig = {
  apiKey: "AIzaSyAuZLwwomxlNUjcPp4JYILdSz4EAWtoRxY",
  authDomain: "dooniniks-paradise.firebaseapp.com",
  databaseURL: "https://dooniniks-paradise-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dooniniks-paradise",
  storageBucket: "dooniniks-paradise.firebasestorage.app",
  messagingSenderId: "140802324914",
  appId: "1:140802324914:web:f2e4f4f4656b75b240ccab",
  measurementId: "G-Z001R5J8NR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
