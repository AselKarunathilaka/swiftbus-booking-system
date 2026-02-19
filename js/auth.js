// public/js/auth.js
import { auth, db } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail // <-- NEW: Import the Firebase reset function
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { 
  doc, setDoc, getDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Validation Helpers
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePhoneLK(phone) {
  return /^(\+94|0)\d{9}$/.test(phone.trim());
}

export function validateName(name) {
  return name && name.trim().length >= 2;
}

// Authentication Functions
export async function signupUser({email, password, name, phone}, errorEl) {
  if(!validateEmail(email)) throw new Error("Invalid email address.");
  if(password.length < 6) throw new Error("Password must be at least 6 characters.");
  if(!validateName(name)) throw new Error("Name is too short.");
  if(!validatePhoneLK(phone)) throw new Error("Invalid Sri Lankan phone number.");

  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;

  // Create User Profile in Firestore
  await setDoc(doc(db, "users", uid), {
    name: name.trim(),
    phone: phone.trim(),
    role: "user", // Default role
    createdAt: serverTimestamp()
  });

  return uid;
}

export async function login({email, password}, errorEl) {
  if(!validateEmail(email)) throw new Error("Invalid email format.");
  if(!password) throw new Error("Password is required.");

  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user.uid;
}

export async function logout() {
  await signOut(auth);
}

// --- NEW: Password Reset Function ---
export async function resetPassword(email) {
  if(!validateEmail(email)) throw new Error("Please enter a valid email to reset your password.");
  await sendPasswordResetEmail(auth, email.trim());
}

export async function getMyProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function requireAuth({onUser}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if(!user) {
        resolve(null); 
        return;
      }
      
      const profile = await getMyProfile(user.uid);
      if(onUser) onUser(user, profile);
      
      resolve({user, profile});
    });
  });
}