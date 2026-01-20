/**
 * Firestore-based storage utilities for Esqueleto
 * Uses shared collection for cross-device sync
 */
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// Shared collection for all workouts (no user separation)
const COLLECTION_NAME = 'workouts';

/**
 * Get the shared workouts collection reference
 */
const getWorkoutsCollection = () => {
    return collection(db, COLLECTION_NAME);
};

/**
 * Save workout to Firestore
 * @param {Object} workout - Workout object
 */
export const saveWorkout = async (workout) => {
    try {
        const workoutsRef = getWorkoutsCollection();
        const newWorkout = {
            ...workout,
            createdAt: serverTimestamp(),
            timestamp: new Date().toISOString(),
        };
        const docRef = await addDoc(workoutsRef, newWorkout);
        return { ...newWorkout, id: docRef.id };
    } catch (error) {
        console.error('Error saving workout:', error);
        throw error;
    }
};

/**
 * Get all workouts from Firestore
 * @returns {Array} Array of workout objects
 */
export const getWorkouts = async () => {
    try {
        const workoutsRef = getWorkoutsCollection();
        const q = query(workoutsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
    } catch (error) {
        console.error('Error getting workouts:', error);
        return [];
    }
};

/**
 * Delete a specific workout by ID
 * @param {string} workoutId - ID of workout to delete
 */
export const deleteWorkout = async (workoutId) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, workoutId);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error('Error deleting workout:', error);
        return false;
    }
};
