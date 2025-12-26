/* eslint-disable @typescript-eslint/no-explicit-any */
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCsxkmz9dZzvielbMYCVM_48NlHKT2O880",
  authDomain: "studdybuddy-7f83c.firebaseapp.com",
  projectId: "studdybuddy-7f83c",
  storageBucket: "studdybuddy-7f83c.firebasestorage.app",
  messagingSenderId: "576670619034",
  appId: "1:576670619034:web:37968ba33d05dc4680d623",
  measurementId: "G-1SY61SECZX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

export { firestore };
