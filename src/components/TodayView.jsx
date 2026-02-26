import { useState, useEffect } from 'react';
import { getActiveWeeklyPlan, updateWeeklyPlan, subscribeToWeeklyPlan, saveActiveWorkout, subscribeToActiveWorkout } from '../utils/weeklyPlanStorage';
import { saveWorkout } from '../utils/firestoreStorage';
import { getIntervalsCredentials, saveIntervalsCredentials, uploadToIntervals } from '../utils/intervalsService';
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
    const [isIntervalsLoading, setIsIntervalsLoading] = useState(false);
    const [showIntervalsSettings, setShowIntervalsSettings] = useState(false);
    const [intervalsAthleteId, setIntervalsAthleteId] = useState('');
    const [intervalsApiKey, setIntervalsApiKey] = useState('');

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
        syncWithWeeklyPlan(updatedWorkout);
    };

    const syncWithWeeklyPlan = async (updatedWorkout) => {
        if (updatedWorkout.planId && updatedWorkout.dayId) {
            try {
                const currentPlan = await getActiveWeeklyPlan();
                if (currentPlan && currentPlan.id === updatedWorkout.planId) {
                    const updatedDays = currentPlan.days.map(day => {
                        if (day.id === updatedWorkout.dayId) {
                            return { ...day, exercises: updatedWorkout.exercises };
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

    const handleAddExercise = () => {
        const newExercise = {
            exercise: 'Nuevo Ejercicio',
            sets: '',
            reps: '',
            load: '',
            RIR: '',
            notes: ''
        };

        const updatedWorkout = {
            ...activeWorkout,
            exercises: [...activeWorkout.exercises, newExercise]
        };

        setActiveWorkout(updatedWorkout);
        saveActiveWorkout(updatedWorkout);
        syncWithWeeklyPlan(updatedWorkout);
    };

    const handleRemoveExercise = (idx) => {
        if (!confirm('¿Eliminar este ejercicio?')) return;

        const updatedExercises = activeWorkout.exercises.filter((_, i) => i !== idx);
        const updatedWorkout = {
            ...activeWorkout,
            exercises: updatedExercises
        };

        setActiveWorkout(updatedWorkout);
        saveActiveWorkout(updatedWorkout);
        syncWithWeeklyPlan(updatedWorkout);
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

    const handleUploadToIntervals = async () => {
        const { athleteId, apiKey } = getIntervalsCredentials();

        if (!athleteId || !apiKey) {
            setIntervalsAthleteId(athleteId || '');
            setIntervalsApiKey(apiKey || '');
            setShowIntervalsSettings(true);
            return;
        }

        setIsIntervalsLoading(true);
        try {
            await uploadToIntervals(activeWorkout);
            setSavedMessage('🚀 ¡Enviado a Intervals.icu!');
            setTimeout(() => setSavedMessage(''), 3000);
        } catch (error) {
            console.error('Intervals Error:', error);
            alert('Error al subir a Intervals: ' + error.message);
        } finally {
            setIsIntervalsLoading(false);
        }
    };

    const handleSaveIntervalsSettings = () => {
        if (!intervalsAthleteId || !intervalsApiKey) {
            alert('Por favor, rellena ambos campos');
            return;
        }
        saveIntervalsCredentials(intervalsAthleteId, intervalsApiKey);
        setShowIntervalsSettings(false);
        // After saving, try to upload
        handleUploadToIntervals();
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
                    <h1>🏋️ Hoy</h1>
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
                        onClick={handleUploadToIntervals}
                        className={`btn-intervals ${isIntervalsLoading ? 'loading' : ''}`}
                        title="Subir a Intervals.icu"
                        disabled={isIntervalsLoading}
                    >
                        {isIntervalsLoading ? '⌛' : '🚀 Intervals'}
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
                                <input
                                    className="exercise-name-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => handleStatChange(e, idx, ex.name ? 'name' : 'exercise', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Nombre del ejercicio"
                                />
                                <button
                                    className="btn-remove-exercise"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveExercise(idx);
                                    }}
                                    title="Eliminar ejercicio"
                                >
                                    🗑️
                                </button>
                            </div>

                            <div className="editable-stats-grid">
                                <div className="stat-group">
                                    <div className="input-label-group">
                                        <span className="mini-label">S</span>
                                        <input
                                            className="stat-input"
                                            type="text"
                                            inputMode="numeric"
                                            value={ex.sets}
                                            onChange={(e) => handleStatChange(e, idx, 'sets', e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="S"
                                        />
                                    </div>
                                    <span className="stat-separator">*</span>
                                    <div className="input-label-group">
                                        <span className="mini-label">R</span>
                                        <input
                                            className="stat-input"
                                            type="text"
                                            inputMode="numeric"
                                            value={ex.reps}
                                            onChange={(e) => handleStatChange(e, idx, 'reps', e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="R"
                                        />
                                    </div>
                                    <span className="stat-separator">*</span>
                                    <div className="input-with-unit">
                                        <div className="input-label-group">
                                            <span className="mini-label">KG</span>
                                            <input
                                                className="stat-input load"
                                                type="text"
                                                inputMode="decimal"
                                                value={ex.load ? ex.load.replace(' kg', '').trim() : (ex.weight ? String(ex.weight).replace('kg', '').trim() : '')}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    handleStatChange(e, idx, 'load', val ? `${val} kg` : '')
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="0"
                                            />
                                        </div>
                                        <span className="unit">kg</span>
                                    </div>
                                </div>
                                <div className="second-edit-row">
                                    <div className="input-label-group rir-box">
                                        <span className="mini-label">RIR</span>
                                        <input
                                            className="stat-input rir"
                                            type="text"
                                            value={ex.RIR || ''}
                                            onChange={(e) => handleStatChange(e, idx, 'RIR', e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="exercise-notes-edit">
                                        <input
                                            className="stat-input note-input"
                                            type="text"
                                            value={ex.notes || ''}
                                            onChange={(e) => handleStatChange(e, idx, 'notes', e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="Notas..."
                                        />
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

                <button
                    className="btn-add-exercise"
                    onClick={handleAddExercise}
                >
                    ➕ Añadir Ejercicio
                </button>
            </div>

            {/* Duration */}
            {activeWorkout.duration_minutes && (
                <div className="workout-footer">
                    <div>⏱️ Duración total: {activeWorkout.duration_minutes} min</div>
                    <div className="sync-indicator">
                        <span className="sync-dot"></span>
                        Sincronización en la nube activa
                    </div>
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

            {/* Intervals Settings Modal */}
            {showIntervalsSettings && (
                <div className="intervals-settings-overlay">
                    <div className="intervals-settings-modal">
                        <h3>🔗 Conectar Intervals.icu</h3>
                        <p>Introduce tus credenciales para sincronizar tus entrenamientos automáticamente.</p>

                        <div className="settings-field">
                            <label>Athlete ID</label>
                            <input
                                type="text"
                                value={intervalsAthleteId}
                                onChange={(e) => setIntervalsAthleteId(e.target.value)}
                                placeholder="Ej: 123456"
                            />
                        </div>

                        <div className="settings-field">
                            <label>API Key</label>
                            <input
                                type="password"
                                value={intervalsApiKey}
                                onChange={(e) => setIntervalsApiKey(e.target.value)}
                                placeholder="Tu API Key"
                            />
                        </div>

                        <div className="settings-actions">
                            <button
                                className="btn-save-settings"
                                onClick={handleSaveIntervalsSettings}
                            >
                                Guardar y Sincronizar
                            </button>
                            <button
                                className="btn-cancel-settings"
                                onClick={() => setShowIntervalsSettings(false)}
                            >
                                Cancelar
                            </button>
                        </div>

                        <div className="settings-help">
                            <p>¿Dónde lo encuentro?</p>
                            <ul>
                                <li><strong>Athlete ID:</strong> Haz clic en tu nombre en Intervals.icu.</li>
                                <li><strong>API Key:</strong> Pestaña "Settings", al final verás "API Keys".</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
