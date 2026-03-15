import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import Importer from './components/Importer';
import WorkoutView from './components/WorkoutView';
import TodayView from './components/TodayView';
import HistoryView from './components/HistoryView';
import WeeklyPlanView from './components/WeeklyPlanView';
import WeeklyPlanModal from './components/WeeklyPlanModal';
import EvolutionView from './components/EvolutionView';
import PhotoProgress from './components/PhotoProgress';
import CoachAIView from './components/CoachAIView';
import { saveWorkout } from './utils/firestoreStorage';
import { saveActiveWorkout } from './utils/weeklyPlanStorage';
import { onAuthChange, signInAnonymousUser } from './firebase';
import './App.css';

/**
 * Main App Component
 * Manages navigation and Firebase Authentication
 */
function App() {
  const [currentView, setCurrentView] = useState('today');
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Initialize Firebase Authentication
  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      if (u) {
        console.log('App: User authenticated:', u.uid);
        setUser(u);
        setIsAuthLoading(false);
      } else {
        console.log('App: No user, signing in anonymously...');
        signInAnonymousUser()
          .then(() => setIsAuthLoading(false))
          .catch(err => {
            console.error('App: Auth error:', err);
            setIsAuthLoading(false);
          });
      }
    });

    return () => unsubscribe();
  }, []);

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

      // 🎉 Launch Confetti!
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#667eea', '#764ba2', '#10b981', '#f1f5f9']
      });

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

  const showEvolution = () => {
    setCurrentView('evolution');
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

  const showPhotos = () => {
    setCurrentView('photos');
    setSavedMessage('');
  };

  const showCoachAI = () => {
    setCurrentView('ai');
    setSavedMessage('');
  };

  if (isAuthLoading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Sincronizando con la nube...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Floating Weekly Plan Button */}
      {currentView !== 'workout' && currentView !== 'weeklyPlan' && (
        <button
          id="btn-weekly-plan-float"
          className="floating-btn"
          onClick={() => setShowWeeklyModal(true)}
          title="Ver plan semanal"
          aria-label="Ver plan semanal"
        >
          📅
        </button>
      )}

      {/* Navigation Tabs */}
      {currentView !== 'workout' && (
        <nav className="nav-tabs" role="tablist" aria-label="Navegación principal">
          <button
            id="tab-importer"
            role="tab"
            aria-selected={currentView === 'importer'}
            className={`nav-tab ${currentView === 'importer' ? 'active' : ''}`}
            onClick={showImporter}
          >
            ➕ Nuevo
          </button>
          <button
            id="tab-today"
            role="tab"
            aria-selected={currentView === 'today'}
            className={`nav-tab ${currentView === 'today' ? 'active' : ''}`}
            onClick={showToday}
          >
            💪 Hoy
          </button>
          <button
            id="tab-weekly"
            role="tab"
            aria-selected={currentView === 'weeklyPlan'}
            className={`nav-tab ${currentView === 'weeklyPlan' ? 'active' : ''}`}
            onClick={showWeeklyPlan}
          >
            📅 Plan
          </button>
          <button
            id="tab-history"
            role="tab"
            aria-selected={currentView === 'history'}
            className={`nav-tab ${currentView === 'history' ? 'active' : ''}`}
            onClick={showHistory}
          >
            📋 Historial
          </button>
          <button
            id="tab-evolution"
            role="tab"
            aria-selected={currentView === 'evolution'}
            className={`nav-tab ${currentView === 'evolution' ? 'active' : ''}`}
            onClick={showEvolution}
          >
            📉 Evolución
          </button>
          <button
            id="tab-photos"
            role="tab"
            aria-selected={currentView === 'photos'}
            className={`nav-tab ${currentView === 'photos' ? 'active' : ''}`}
            onClick={showPhotos}
          >
            📸 Fotos
          </button>
          <button
            id="tab-ai"
            role="tab"
            aria-selected={currentView === 'ai'}
            className={`nav-tab ${currentView === 'ai' ? 'active' : ''}`}
            onClick={showCoachAI}
          >
            🤖 IA
          </button>
        </nav>
      )}

      {/* Success Toast */}
      {savedMessage && (
        <div className="success-toast" role="status" aria-live="polite">
          {savedMessage}
        </div>
      )}

      {/* View Rendering */}
      {currentView === 'importer' && (
        <div className="view-enter" role="tabpanel" aria-labelledby="tab-importer">
          <Importer
            onImport={handleImport}
            onWeeklyPlanImport={handleWeeklyPlanImport}
          />
        </div>
      )}

      {currentView === 'workout' && (
        <div className="view-enter">
          <WorkoutView
            workout={currentWorkout}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      {currentView === 'today' && (
        <div className="view-enter" role="tabpanel" aria-labelledby="tab-today">
          <TodayView />
        </div>
      )}

      {currentView === 'weeklyPlan' && (
        <div className="view-enter" role="tabpanel" aria-labelledby="tab-weekly">
          <WeeklyPlanView />
        </div>
      )}

      {currentView === 'history' && (
        <div className="view-enter" role="tabpanel" aria-labelledby="tab-history">
          <HistoryView />
        </div>
      )}

      {currentView === 'evolution' && (
        <div className="view-enter" role="tabpanel" aria-labelledby="tab-evolution">
          <EvolutionView />
        </div>
      )}

      {currentView === 'photos' && (
        <div className="view-enter" role="tabpanel" aria-labelledby="tab-photos">
          <PhotoProgress />
        </div>
      )}

      {currentView === 'ai' && (
        <div className="view-enter" role="tabpanel" aria-labelledby="tab-ai">
          <CoachAIView />
        </div>
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

