import { useState, useEffect } from 'react';
import { getWorkouts, deleteWorkout } from '../utils/firestoreStorage';
import './HistoryView.css';

/**
 * HistoryView Component
 * Displays saved workout history from Firestore
 */
export default function HistoryView() {
    const [workouts, setWorkouts] = useState([]);
    const [expandedWorkouts, setExpandedWorkouts] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadWorkouts();
    }, []);

    const loadWorkouts = async () => {
        setIsLoading(true);
        try {
            const saved = await getWorkouts();
            setWorkouts(saved);
        } catch (error) {
            console.error('Error loading workouts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e, workoutId) => {
        e.stopPropagation();
        if (confirm('¿Eliminar este entrenamiento?')) {
            await deleteWorkout(workoutId);
            loadWorkouts();
        }
    };

    const toggleExpand = (workoutId) => {
        setExpandedWorkouts(prev => ({
            ...prev,
            [workoutId]: !prev[workoutId]
        }));
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getWorkoutTitle = (workout) => {
        return workout.title || workout.session || 'Entrenamiento';
    };

    const getWorkoutDate = (workout) => {
        return workout.date || formatDate(workout.timestamp);
    };

    if (isLoading) {
        return (
            <div className="history-view">
                <h1>Historial</h1>
                <div className="loading-state">
                    <div className="loading-spinner">⏳</div>
                    <p>Cargando entrenamientos...</p>
                </div>
            </div>
        );
    }

    if (workouts.length === 0) {
        return (
            <div className="history-view">
                <h1>Historial</h1>
                <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <p>No hay entrenamientos guardados</p>
                    <p className="empty-hint">Importa y completa un entrenamiento para verlo aquí</p>
                </div>
            </div>
        );
    }

    return (
        <div className="history-view">
            <h1>Historial</h1>
            <p className="history-subtitle">{workouts.length} entrenamientos guardados</p>

            <div className="workout-cards">
                {workouts.map((workout) => {
                    const isExpanded = expandedWorkouts[workout.id];

                    return (
                        <div
                            key={workout.id}
                            className={`workout-card ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleExpand(workout.id)}
                        >
                            <div className="workout-card-header">
                                <div className="workout-info">
                                    <h3>
                                        {getWorkoutDate(workout)} {getWorkoutTitle(workout)}
                                    </h3>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, workout.id)}
                                    className="btn-delete-workout"
                                    title="Eliminar"
                                >
                                    🗑️
                                </button>
                            </div>

                            {isExpanded && (
                                <div className="workout-card-body">
                                    {workout.warm_up && (
                                        <div className="workout-warmup">
                                            🔥 {workout.warm_up.exercise}
                                            {workout.warm_up.duration_minutes && ` (${workout.warm_up.duration_minutes} min)`}
                                        </div>
                                    )}

                                    <div className="exercise-list">
                                        {workout.exercises.map((ex, idx) => {
                                            const name = ex.name || ex.exercise;
                                            const load = ex.load || (ex.weight ? `${ex.weight} kg` : '');
                                            return (
                                                <div key={idx} className="exercise-item">
                                                    <span className="exercise-name">{name}</span>
                                                    <span className="exercise-details">
                                                        {ex.sets}×{ex.reps} {load && `• ${load}`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {workout.duration_minutes && (
                                        <div className="workout-duration">
                                            ⏱️ Duración: {workout.duration_minutes} min
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
