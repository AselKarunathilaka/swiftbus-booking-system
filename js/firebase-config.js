// public/js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDqvhrw6xltqpH29WSaBHrYYFkoUqWxmeY",
  authDomain: "bus-seat-booking-2f6fa.firebaseapp.com",
  projectId: "bus-seat-booking-2f6fa",
  storageBucket: "bus-seat-booking-2f6fa.firebasestorage.app",
  messagingSenderId: "354143929413",
  appId: "1:354143929413:web:2d108f789e13b63d0b4f2c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
