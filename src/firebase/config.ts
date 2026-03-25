import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Konfigurasi Firebase - GANTI DENGAN KONFIGURASI ANDA SENDIRI
// Buat project di https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: "AIzaSyDECWw2-w_HdtmIFp5eJB1es_h8lpT0Gt4",
  authDomain: "doominiks-niks.firebaseapp.com",
  databaseURL: "https://doominiks-niks-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "doominiks-niks",
  storageBucket: "doominiks-niks.firebasestorage.app",
  messagingSenderId: "504521349704",
  appId: "1:504521349704:web:15f0305b8cf9da746f567d",
  measurementId: "G-1K0XJ24LBL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
