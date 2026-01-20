// Firebase configuration for Esqueleto
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
    projectId: "esqueleto-gym",
    appId: "1:53330207641:web:9e6a8d88b31f81e3c0a908",
    storageBucket: "esqueleto-gym.firebasestorage.app",
    apiKey: "AIzaSyCRv_o6cD7xpjzeVhOLCzd_lybjA4dv81I",
    authDomain: "esqueleto-gym.firebaseapp.com",
    messagingSenderId: "53330207641"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Anonymous sign-in helper
export const signInAnonymousUser = async () => {
    try {
        const result = await signInAnonymously(auth);
        return result.user;
    } catch (error) {
        console.error('Error signing in anonymously:', error);
        throw error;
    }
};

// Auth state observer
export const onAuthChange = (callback) => {
    return onAuthStateChanged(auth, callback);
};
