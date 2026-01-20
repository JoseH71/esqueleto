/**
 * Firestore storage utilities for Weekly Plans
 * Manages the weeklyPlans collection
 */
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    doc,
    query,
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot,
    getDoc
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION_NAME = 'weeklyPlans';

/**
 * Get the weekly plans collection reference
 */
const getWeeklyPlansCollection = () => {
    return collection(db, COLLECTION_NAME);
};

/**
 * Save weekly plan to Firestore
 * @param {Object} weeklyPlan - Weekly plan object
 */
export const saveWeeklyPlan = async (weeklyPlan) => {
    try {
        const plansRef = getWeeklyPlansCollection();
        const newPlan = {
            ...weeklyPlan,
            createdAt: serverTimestamp(),
            timestamp: new Date().toISOString(),
        };
        const docRef = await addDoc(plansRef, newPlan);

        // Also save to localStorage as the active week plan
        localStorage.setItem('activeWeeklyPlan', JSON.stringify({
            ...newPlan,
            id: docRef.id
        }));

        return { ...newPlan, id: docRef.id };
    } catch (error) {
        console.error('Error saving weekly plan:', error);
        throw error;
    }
};

/**
 * Get all weekly plans from Firestore
 * @returns {Array} Array of weekly plan objects
 */
export const getWeeklyPlans = async () => {
    try {
        const plansRef = getWeeklyPlansCollection();
        const q = query(plansRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
    } catch (error) {
        console.error('Error getting weekly plans:', error);
        return [];
    }
};

/**
 * Get the most recent weekly plan
 * @returns {Object|null} Latest weekly plan or null
 */
export const getLatestWeeklyPlan = async () => {
    try {
        const plansRef = getWeeklyPlansCollection();
        const q = query(plansRef, orderBy('createdAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { ...doc.data(), id: doc.id };
    } catch (error) {
        console.error('Error getting latest weekly plan:', error);
        return null;
    }
};

/**
 * Delete a specific weekly plan by ID
 * @param {string} planId - ID of plan to delete
 */
export const deleteWeeklyPlan = async (planId) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, planId);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error('Error deleting weekly plan:', error);
        return false;
    }
};

/**
 * Update an existing weekly plan
 * @param {Object} weeklyPlan - Updated weekly plan object
 */
export const updateWeeklyPlan = async (weeklyPlan) => {
    try {
        if (!weeklyPlan.id) throw new Error('Plan must have an ID to update');

        const docRef = doc(db, COLLECTION_NAME, weeklyPlan.id);
        const { id, ...data } = weeklyPlan; // Exclude ID from data

        await updateDoc(docRef, {
            ...data,
            timestamp: new Date().toISOString()
        });

        // Update localStorage if it's the active plan
        const activeStored = localStorage.getItem('activeWeeklyPlan');
        if (activeStored) {
            const active = JSON.parse(activeStored);
            if (active.id === weeklyPlan.id) {
                localStorage.setItem('activeWeeklyPlan', JSON.stringify(weeklyPlan));
            }
        }

        return true;
    } catch (error) {
        console.error('Error updating weekly plan:', error);
        throw error;
    }
};

/**
 * Get the active weekly plan from localStorage
 * Falls back to Firebase if not in localStorage
 */
export const getActiveWeeklyPlan = async () => {
    try {
        // Always try to fetch fresh from Firebase first if we have an ID stored
        const stored = localStorage.getItem('activeWeeklyPlan');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.id) {
                // Fetch fresh
                const docRef = doc(db, COLLECTION_NAME, parsed.id);
                const snapshot = await import('firebase/firestore').then(mod => mod.getDoc(docRef));
                if (snapshot.exists()) {
                    const freshPlan = { ...snapshot.data(), id: snapshot.id };
                    localStorage.setItem('activeWeeklyPlan', JSON.stringify(freshPlan));
                    return freshPlan;
                }
            }
            return parsed;
        }
        // Fallback to latest from Firebase
        return await getLatestWeeklyPlan();
    } catch (error) {
        console.error('Error getting active weekly plan:', error);
        return null;
    }
};

/**
 * Subscribe to real-time updates for a specific weekly plan
 * @param {string} planId - ID of the plan to listen to
 * @param {function} onUpdate - Callback function with updated plan data
 * @returns {function} Unsubscribe function
 */
export const subscribeToWeeklyPlan = (planId, onUpdate) => {
    if (!planId) return () => { };

    // Dynamic import to avoid circular dependency issues if any
    // Use imported onSnapshot
    // const { onSnapshot } = require('firebase/firestore'); // Removed dynamic require error

    const docRef = doc(db, COLLECTION_NAME, planId);
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const updatedPlan = { ...doc.data(), id: doc.id };
            // Update local storage to keep it in sync
            const stored = localStorage.getItem('activeWeeklyPlan');
            if (stored) {
                const current = JSON.parse(stored);
                if (current.id === planId) {
                    localStorage.setItem('activeWeeklyPlan', JSON.stringify(updatedPlan));
                }
            }
            onUpdate(updatedPlan);
        }
    }, (error) => {
        console.error("Error listening to plan updates:", error);
    });
};
