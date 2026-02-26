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
    updateDoc,
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

/**
 * Update a specific workout
 * @param {string} workoutId - ID of workout to update
 * @param {Object} updates - Fields to update
 */
export const updateWorkout = async (workoutId, updates) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, workoutId);
        await updateDoc(docRef, updates);
        return true;
    } catch (error) {
        console.error('Error updating workout:', error);
        return false;
    }
};

// --- ALIAS DICTIONARY (Phase 2) ---
const ALIAS_COLLECTION = 'exerciseAliases';

/**
 * Save or update an exercise alias group
 * @param {Object} aliasData - { masterName: 'Name', aliases: ['alias1', 'alias2'], id?: 'optional_id' }
 */
export const saveExerciseAlias = async (aliasData) => {
    try {
        const aliasesRef = collection(db, ALIAS_COLLECTION);
        if (aliasData.id) {
            // Update existing
            const docRef = doc(db, ALIAS_COLLECTION, aliasData.id);
            await updateDoc(docRef, {
                masterName: aliasData.masterName,
                category: aliasData.category || 'Otros',
                aliases: aliasData.aliases,
                updatedAt: serverTimestamp()
            });
            return aliasData.id;
        } else {
            // Create new
            const newDoc = {
                masterName: aliasData.masterName,
                category: aliasData.category || 'Otros',
                aliases: aliasData.aliases,
                createdAt: serverTimestamp()
            };
            const docRef = await addDoc(aliasesRef, newDoc);
            return docRef.id;
        }
    } catch (error) {
        console.error('Error saving alias:', error);
        throw error;
    }
};

/**
 * Get all exercise aliases
 * @returns {Array} Array of alias objects
 */
export const getExerciseAliases = async () => {
    try {
        const aliasesRef = collection(db, ALIAS_COLLECTION);
        const snapshot = await getDocs(aliasesRef);
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
    } catch (error) {
        console.error('Error getting aliases:', error);
        return [];
    }
};

/**
 * Delete a specific alias group
 */
export const deleteExerciseAlias = async (aliasId) => {
    try {
        const docRef = doc(db, ALIAS_COLLECTION, aliasId);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error('Error deleting alias:', error);
        return false;
    }
};
