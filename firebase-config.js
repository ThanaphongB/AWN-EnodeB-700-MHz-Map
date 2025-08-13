// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAjeEjeZsYDHBROCUPdt2jJ0gQ9JAfhW8k",
  authDomain: "login-mnoc-700-mhz.firebaseapp.com",
  databaseURL: "https://login-mnoc-700-mhz-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "login-mnoc-700-mhz",
  storageBucket: "login-mnoc-700-mhz.firebasestorage.app",
  messagingSenderId: "568660367970",
  appId: "1:568660367970:web:6a344679a6867b23a58f3b",
  measurementId: "G-PPSQ9LQ8E0"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
