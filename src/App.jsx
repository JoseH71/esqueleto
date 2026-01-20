import { useState, useEffect } from 'react';
import Importer from './components/Importer';
import WorkoutView from './components/WorkoutView';
import TodayView from './components/TodayView';
import HistoryView from './components/HistoryView';
import WeeklyPlanView from './components/WeeklyPlanView';
import WeeklyPlanModal from './components/WeeklyPlanModal';
import { saveWorkout } from './utils/firestoreStorage';
import { saveActiveWorkout } from './utils/weeklyPlanStorage';
import './App.css';

/**
 * Main App Component
 * Manages navigation - no auth required for shared storage
 */
function App() {
  const [currentView, setCurrentView] = useState('importer');
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  // Listen for navigation events from other components
  useEffect(() => {
    const handleNavigateToToday = () => {
      setCurrentView('today');
    };

    window.addEventListener('navigateToToday', handleNavigateToToday);
    return () => window.removeEventListener('navigateToToday', handleNavigateToToday);
  }, []);

  const handleImport = (workout) => {
    setCurrentWorkout(workout);
    setCurrentView('workout');
    setSavedMessage('');
  };

  const handleWeeklyPlanImport = (weeklyPlan) => {
    setSavedMessage(`✓ Plan semanal "${weeklyPlan.weekRange}" importado`);
    setCurrentView('weeklyPlan');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const handleSave = async (workout) => {
    try {
      const saved = await saveWorkout(workout);
      console.log('Workout saved:', saved);

      // Save as active workout for "Hoy" tab (Global sync)
      await saveActiveWorkout(workout);

      const workoutTitle = workout.title || workout.session || 'Entrenamiento';
      setSavedMessage(`✓ "${workoutTitle}" guardado exitosamente`);
      setCurrentWorkout(null);
      setCurrentView('today');

      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Save error:', error);
      alert('Error al guardar: ' + error.message);
    }
  };

  const handleCancel = () => {
    setCurrentWorkout(null);
    setCurrentView('importer');
    setSavedMessage('');
  };

  const showToday = () => {
    setCurrentView('today');
    setSavedMessage('');
  };

  const showHistory = () => {
    setCurrentView('history');
    setSavedMessage('');
  };

  const showImporter = () => {
    setCurrentView('importer');
    setCurrentWorkout(null);
    setSavedMessage('');
  };

  const showWeeklyPlan = () => {
    setCurrentView('weeklyPlan');
    setSavedMessage('');
  };

  return (
    <div className="app">
      {/* Floating Weekly Plan Button */}
      {currentView !== 'workout' && currentView !== 'weeklyPlan' && (
        <button
          className="floating-btn"
          onClick={() => setShowWeeklyModal(true)}
          title="Ver plan semanal"
        >
          📅
        </button>
      )}

      {/* Navigation Tabs */}
      {currentView !== 'workout' && (
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${currentView === 'importer' ? 'active' : ''}`}
            onClick={showImporter}
          >
            ➕ Nuevo
          </button>
          <button
            className={`nav-tab ${currentView === 'today' ? 'active' : ''}`}
            onClick={showToday}
          >
            💪 Hoy
          </button>
          <button
            className={`nav-tab ${currentView === 'weeklyPlan' ? 'active' : ''}`}
            onClick={showWeeklyPlan}
          >
            📅 Plan
          </button>
          <button
            className={`nav-tab ${currentView === 'history' ? 'active' : ''}`}
            onClick={showHistory}
          >
            📋 Historial
          </button>
        </nav>
      )}

      {/* Success Toast */}
      {savedMessage && (
        <div className="success-toast">
          {savedMessage}
        </div>
      )}

      {/* View Rendering */}
      {currentView === 'importer' && (
        <Importer
          onImport={handleImport}
          onWeeklyPlanImport={handleWeeklyPlanImport}
        />
      )}

      {currentView === 'workout' && (
        <WorkoutView
          workout={currentWorkout}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {currentView === 'today' && (
        <TodayView />
      )}

      {currentView === 'weeklyPlan' && (
        <WeeklyPlanView />
      )}

      {currentView === 'history' && (
        <HistoryView />
      )}

      {/* Weekly Plan Modal */}
      <WeeklyPlanModal
        isOpen={showWeeklyModal}
        onClose={() => setShowWeeklyModal(false)}
      />
    </div>
  );
}

export default App;

