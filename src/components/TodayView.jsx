import { useState, useEffect } from 'react';
import { getActiveWeeklyPlan, updateWeeklyPlan, subscribeToWeeklyPlan, saveActiveWorkout, subscribeToActiveWorkout } from '../utils/weeklyPlanStorage';
import { saveWorkout } from '../utils/firestoreStorage';
import WeeklyPlanCard from './WeeklyPlanCard';
import './TodayView.css';

/**
 * TodayView Component
 * Displays the active workout for today - optimized for gym use
 */
export default function TodayView() {
    const [activeWorkout, setActiveWorkout] = useState(null);
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const [expandedDays, setExpandedDays] = useState({});
    const [savedMessage, setSavedMessage] = useState('');

    useEffect(() => {
        loadActiveWorkout();
        loadWeeklyPlan();

        // Subscribe to Cross-Device Active Workout changes
        const unsubscribeActive = subscribeToActiveWorkout((workout) => {
            console.log('Sync: Global active workout updated');
            setActiveWorkout(workout);
        });

        return () => unsubscribeActive();
    }, []);

    const loadActiveWorkout = () => {
        try {
            const stored = localStorage.getItem('activeWorkout');
            if (stored) {
                setActiveWorkout(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading active workout:', error);
        }
    };

    // 1. Subscription Logic (Safe Version - NutriMinerals Pattern)
    useEffect(() => {
        let unsubscribe = () => { };

        // Only subscribe if we have valid stable IDs
        if (activeWorkout?.planId && activeWorkout?.dayId) {
            unsubscribe = subscribeToWeeklyPlan(activeWorkout.planId, (updatedPlan) => {
                const updatedDay = updatedPlan.days.find(d => d.id === activeWorkout.dayId);

                if (updatedDay) {
                    // Create potential new state
                    const newActiveWorkout = {
                        ...activeWorkout,
                        ...updatedDay,
                        planId: updatedPlan.id,
                        dayId: updatedDay.id
                    };

                    // DEEP CHECK: Only update state if content ACTUALLY changed
                    const currentStr = JSON.stringify(activeWorkout);
                    const newStr = JSON.stringify(newActiveWorkout);

                    if (currentStr !== newStr) {
                        console.log('Sync: Updating active workout from cloud');
                        setActiveWorkout(newActiveWorkout);
                        localStorage.setItem('activeWorkout', newStr);
                    }
                }
            });
        }
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkout?.planId, activeWorkout?.dayId]);

    // 2. Auto-Healing Logic - MOVED TO LOAD TIME (Safe)
    useEffect(() => {
        if (!weeklyPlan || !activeWorkout) return;

        // If already has IDs, stop
        if (activeWorkout.planId && activeWorkout.dayId) return;

        // Try to heal matching day
        const matchingDay = weeklyPlan.days?.find(d =>
            (d.date && d.date === activeWorkout.date) ||
            (d.title && d.title === activeWorkout.title)
        );

        if (matchingDay) {
            console.log('Sync: One-time heal for active workout');
            const healedWorkout = {
                ...activeWorkout,
                planId: weeklyPlan.id,
                dayId: matchingDay.id
            };
            // Update and persis
            setActiveWorkout(healedWorkout);
            localStorage.setItem('activeWorkout', JSON.stringify(healedWorkout));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weeklyPlan?.id]); // Only run when a new plan is loaded, NOT when activeWorkout changeswhen plan loads or date changes


    const loadWeeklyPlan = async () => {
        try {
            const plan = await getActiveWeeklyPlan();
            setWeeklyPlan(plan);
        } catch (error) {
            console.error('Error loading weekly plan:', error);
        }
    };

    const toggleDayExpand = (dayId) => {
        setExpandedDays(prev => ({
            ...prev,
            [dayId]: !prev[dayId]
        }));
    };

    const loadDayAsActive = (day) => {
        const workout = {
            planId: weeklyPlan?.id,
            dayId: day.id,
            session: day.title,
            date: day.date,
            dayName: day.dayName,
            warm_up: day.warm_up,
            exercises: day.exercises,
            duration_minutes: day.duration_minutes
        };
        // Global sync
        saveActiveWorkout(workout);
        setActiveWorkout(workout);
    };

    // Get other days from weekly plan (not the current one)
    const getOtherDays = () => {
        if (!weeklyPlan?.days || !activeWorkout) return weeklyPlan?.days || [];
        return weeklyPlan.days.filter(day =>
            day.date !== activeWorkout.date
        );
    };

    const clearActiveWorkout = () => {
        if (confirm('¿Limpiar el entrenamiento activo?')) {
            saveActiveWorkout(null);
            setActiveWorkout(null);
        }
    };

    const getWorkoutTitle = (workout) => {
        return workout.title || workout.session || 'Entrenamiento';
    };

    const handleStatChange = async (e, exerciseIdx, field, value) => {
        if (e) e.stopPropagation();

        const updatedWorkout = { ...activeWorkout };
        const updatedExercises = [...updatedWorkout.exercises];
        updatedExercises[exerciseIdx] = {
            ...updatedExercises[exerciseIdx],
            [field]: value
        };
        updatedWorkout.exercises = updatedExercises;

        setActiveWorkout(updatedWorkout);
        saveActiveWorkout(updatedWorkout);

        // Global Sync with Weekly Plan
        if (updatedWorkout.planId && updatedWorkout.dayId) {
            try {
                const currentPlan = await getActiveWeeklyPlan();
                if (currentPlan && currentPlan.id === updatedWorkout.planId) {
                    const updatedDays = currentPlan.days.map(day => {
                        if (day.id === updatedWorkout.dayId) {
                            return { ...day, exercises: updatedExercises };
                        }
                        return day;
                    });

                    const updatedPlan = { ...currentPlan, days: updatedDays };
                    await updateWeeklyPlan(updatedPlan);
                }
            } catch (err) {
                console.error('Sync Error:', err);
            }
        }
    };

    const handleSaveToHistory = async () => {
        try {
            // Save to Firestore history
            await saveWorkout(activeWorkout);

            const workoutTitle = getWorkoutTitle(activeWorkout);
            setSavedMessage(`✅ "${workoutTitle}" guardado en historial`);

            // Auto-dismiss message after 3 seconds
            setTimeout(() => setSavedMessage(''), 3000);
        } catch (error) {
            console.error('Error saving to history:', error);
            alert('Error al guardar: ' + error.message);
        }
    };

    if (!activeWorkout) {
        return (
            <div className="today-view">
                <h1>💪 Hoy</h1>
                <div className="empty-state">
                    <div className="empty-icon">📅</div>
                    <p>No hay entrenamiento activo</p>
                    <p className="empty-hint">
                        Importa y guarda un entrenamiento en la pestaña "Nuevo" para verlo aquí
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="today-view">
            {/* Success Toast */}
            {savedMessage && (
                <div className="success-toast">
                    {savedMessage}
                </div>
            )}

            <div className="today-header">
                <div>
                    <h1>💪 Hoy</h1>
                    <h2 className="workout-title">{getWorkoutTitle(activeWorkout)}</h2>
                    {activeWorkout.date && (
                        <p className="workout-date">📅 {activeWorkout.date}</p>
                    )}
                </div>
                <div className="header-actions">
                    <button
                        onClick={handleSaveToHistory}
                        className="btn-complete"
                        title="Guardar en historial"
                    >
                        ✅ Entreno Completado
                    </button>
                    <button
                        onClick={clearActiveWorkout}
                        className="btn-clear"
                        title="Limpiar entrenamiento activo"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* AI Description/Comments */}
            {activeWorkout.description && (
                <div className="workout-description">
                    <div className="description-header">🤖 Descripción IA</div>
                    <p>{activeWorkout.description}</p>
                </div>
            )}

            {activeWorkout.comments && (
                <div className="workout-description">
                    <div className="description-header">💬 Comentarios</div>
                    <p>{activeWorkout.comments}</p>
                </div>
            )}

            {/* Warmup */}
            {activeWorkout.warm_up && (
                <div className="warmup-section">
                    <div className="section-title">🔥 Calentamiento</div>
                    <div className="warmup-content">
                        <span className="warmup-exercise">{activeWorkout.warm_up.exercise}</span>
                        {activeWorkout.warm_up.duration_minutes && (
                            <span className="warmup-duration">
                                {activeWorkout.warm_up.duration_minutes} min
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Exercises */}
            <div className="exercises-section">
                <div className="section-title">🏋️ Ejercicios</div>
                {activeWorkout.exercises.map((ex, idx) => {
                    const name = ex.name || ex.exercise;
                    const loadValue = ex.load ? ex.load.replace(' kg', '').trim() : (ex.weight ? String(ex.weight).replace('kg', '').trim() : '');

                    return (
                        <div key={idx} className="exercise-card">
                            <div className="exercise-header">
                                <span className="exercise-number">{idx + 1}</span>
                                <span className="exercise-name">{name}</span>
                            </div>

                            <div className="editable-stats-grid">
                                <div className="stat-group">
                                    <input
                                        className="stat-input"
                                        type="text"
                                        inputMode="numeric"
                                        value={ex.sets}
                                        onChange={(e) => handleStatChange(e, idx, 'sets', e.target.value)}
                                        placeholder="S"
                                    />
                                    <span className="stat-separator">×</span>
                                    <input
                                        className="stat-input"
                                        type="text"
                                        inputMode="numeric"
                                        value={ex.reps}
                                        onChange={(e) => handleStatChange(e, idx, 'reps', e.target.value)}
                                        placeholder="R"
                                    />
                                    <span className="stat-separator">@</span>
                                    <div className="input-with-unit">
                                        <input
                                            className="stat-input load"
                                            type="text"
                                            inputMode="decimal"
                                            value={loadValue}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                handleStatChange(e, idx, 'load', val ? `${val} kg` : '')
                                            }}
                                            placeholder="0"
                                        />
                                        <span className="unit">kg</span>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Details */}
                            <div className="exercise-details">
                                {ex.tempo && (
                                    <div className="detail-item">
                                        <span className="detail-label">⏱️ Tempo:</span>
                                        <span className="detail-value">{ex.tempo}</span>
                                    </div>
                                )}

                                {ex.RIR && (
                                    <div className="detail-item">
                                        <span className="detail-label">💯 RIR:</span>
                                        <span className="detail-value">{ex.RIR}</span>
                                    </div>
                                )}

                                {ex.rest_seconds && (
                                    <div className="detail-item">
                                        <span className="detail-label">⏸️ Descanso:</span>
                                        <span className="detail-value">{ex.rest_seconds}</span>
                                    </div>
                                )}

                                {ex.increment && (
                                    <div className="detail-item">
                                        <span className="detail-label">📈 Incremento:</span>
                                        <span className="detail-value">{ex.increment}</span>
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            {ex.notes && (
                                <div className="exercise-notes">
                                    <div className="notes-label">📝 Notas:</div>
                                    <div className="notes-content">{ex.notes}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Duration */}
            {activeWorkout.duration_minutes && (
                <div className="workout-footer">
                    ⏱️ Duración total: {activeWorkout.duration_minutes} min
                </div>
            )}

            {/* Weekly Plan Preview */}
            {weeklyPlan && getOtherDays().length > 0 && (
                <div className="week-preview">
                    <div className="section-title">📅 Esta Semana</div>
                    <p className="week-range">{weeklyPlan.weekRange}</p>
                    <div className="week-days">
                        {getOtherDays().map((day, idx) => (
                            <WeeklyPlanCard
                                key={day.id || idx}
                                day={day}
                                isExpanded={expandedDays[day.id]}
                                onToggle={() => toggleDayExpand(day.id)}
                                onLoadAsActive={() => loadDayAsActive(day)}
                                compact={true}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
