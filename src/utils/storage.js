/**
 * LocalStorage utilities for Esqueleto
 * Prepared for future Firebase migration
 */

const STORAGE_KEY = 'esqueleto_workouts';

/**
 * Save workout to LocalStorage
 * @param {Object} workout - Workout object with title and exercises
 */
export const saveWorkout = (workout) => {
  try {
    const workouts = getWorkouts();
    const newWorkout = {
      ...workout,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    workouts.push(newWorkout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
    return newWorkout;
  } catch (error) {
    console.error('Error saving workout:', error);
    throw error;
  }
};

/**
 * Get all workouts from LocalStorage
 * @returns {Array} Array of workout objects
 */
export const getWorkouts = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting workouts:', error);
    return [];
  }
};

/**
 * Delete a specific workout by ID
 * @param {string} workoutId - ID of workout to delete
 */
export const deleteWorkout = (workoutId) => {
  try {
    const workouts = getWorkouts();
    const filtered = workouts.filter(w => w.id !== workoutId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting workout:', error);
    return false;
  }
};

/**
 * Clear all workouts (for testing)
 */
export const clearWorkouts = () => {
  localStorage.removeItem(STORAGE_KEY);
};
