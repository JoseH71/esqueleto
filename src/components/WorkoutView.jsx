import { useState } from 'react';
import './WorkoutView.css';

/**
 * WorkoutView Component
 * "Gestión por Excepción" - Only edit what changes
 * Supports both simple and complex workout formats
 */
export default function WorkoutView({ workout, onSave, onCancel }) {
    const [exercises, setExercises] = useState(workout.exercises);
    const [expandedNotes, setExpandedNotes] = useState({});

    // Determine workout title (support both formats)
    const workoutTitle = workout.title || workout.session || 'Entrenamiento';

    const handleChange = (id, field, value) => {
        setExercises(prev =>
            prev.map(ex => {
                if (ex.id === id) {
                    // For numeric fields, convert to number
                    if (['sets', 'reps', 'weight'].includes(field)) {
                        return { ...ex, [field]: Number(value) || 0 };
                    }
                    // For text fields (load, tempo, RIR, etc.), keep as string
                    return { ...ex, [field]: value };
                }
                return ex;
            })
        );
    };

    const handleDelete = (id) => {
        setExercises(prev => prev.filter(ex => ex.id !== id));
    };

    const toggleNotes = (id) => {
        setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSave = () => {
        onSave({
            ...workout,
            exercises,
        });
    };

    return (
        <div className="workout-view">
            <header className="workout-header">
                <h1>{workoutTitle}</h1>
                <div className="workout-meta">
                    {workout.date && <span className="meta-item">📅 {workout.date}</span>}
                    {workout.duration_minutes && (
                        <span className="meta-item">⏱️ {workout.duration_minutes} min</span>
                    )}
                </div>
                <p className="workout-subtitle">Ajusta solo lo que cambió</p>
            </header>

            {/* Warm-up Section */}
            {workout.warm_up && (
                <div className="warm-up-section">
                    <span className="warm-up-icon">🔥</span>
                    <strong>Calentamiento:</strong> {workout.warm_up.exercise}
                    {workout.warm_up.duration_minutes && (
                        <span> ({workout.warm_up.duration_minutes} min)</span>
                    )}
                </div>
            )}

            <div className="exercise-list">
                {exercises.map((exercise) => {
                    const exerciseName = exercise.name || exercise.exercise;
                    const isNotesExpanded = expandedNotes[exercise.id];

                    return (
                        <div key={exercise.id} className="exercise-card">
                            <div className="exercise-header">
                                <h3>
                                    {exercise.order && <span className="exercise-order">#{exercise.order}</span>}
                                    {exerciseName}
                                </h3>
                                <button
                                    onClick={() => handleDelete(exercise.id)}
                                    className="btn-delete"
                                    title="No hice este ejercicio"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Primary Fields: Sets, Reps, Load */}
                            <div className="exercise-inputs primary-inputs">
                                <div className="input-group">
                                    <label>Series</label>
                                    <input
                                        type="number"
                                        value={exercise.sets}
                                        onChange={(e) => handleChange(exercise.id, 'sets', e.target.value)}
                                        min="1"
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Reps</label>
                                    <input
                                        type="number"
                                        value={exercise.reps}
                                        onChange={(e) => handleChange(exercise.id, 'reps', e.target.value)}
                                        min="1"
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Carga</label>
                                    <input
                                        type="text"
                                        value={exercise.load || exercise.weight || ''}
                                        onChange={(e) => handleChange(exercise.id, 'load', e.target.value)}
                                        placeholder="ej: 60 kg"
                                    />
                                </div>
                            </div>

                            {/* Secondary Fields: Tempo, RIR, Rest */}
                            <div className="exercise-inputs secondary-inputs">
                                {(exercise.tempo || exercise.RIR || exercise.rest_seconds) && (
                                    <>
                                        {exercise.tempo !== undefined && (
                                            <div className="input-group">
                                                <label>Tempo</label>
                                                <input
                                                    type="text"
                                                    value={exercise.tempo || ''}
                                                    onChange={(e) => handleChange(exercise.id, 'tempo', e.target.value)}
                                                    placeholder="ej: 2-0-4-2"
                                                />
                                            </div>
                                        )}

                                        {exercise.RIR !== undefined && (
                                            <div className="input-group">
                                                <label>RIR</label>
                                                <input
                                                    type="text"
                                                    value={exercise.RIR || ''}
                                                    onChange={(e) => handleChange(exercise.id, 'RIR', e.target.value)}
                                                    placeholder="ej: 2-3"
                                                />
                                            </div>
                                        )}

                                        {exercise.rest_seconds !== undefined && (
                                            <div className="input-group">
                                                <label>Descanso</label>
                                                <input
                                                    type="text"
                                                    value={exercise.rest_seconds || ''}
                                                    onChange={(e) => handleChange(exercise.id, 'rest_seconds', e.target.value)}
                                                    placeholder="ej: 90-120"
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Increment Suggestion */}
                            {exercise.increment && (
                                <div className="increment-hint">
                                    💡 Sugerencia: {exercise.increment}
                                </div>
                            )}

                            {/* Notes Section */}
                            {exercise.notes && (
                                <div className="notes-section">
                                    <button
                                        className="notes-toggle"
                                        onClick={() => toggleNotes(exercise.id)}
                                    >
                                        📝 Notas {isNotesExpanded ? '▼' : '▶'}
                                    </button>
                                    {isNotesExpanded && (
                                        <textarea
                                            className="notes-textarea"
                                            value={exercise.notes}
                                            onChange={(e) => handleChange(exercise.id, 'notes', e.target.value)}
                                            rows={3}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="action-buttons">
                <button onClick={onCancel} className="btn-cancel">
                    ← Cancelar
                </button>
                <button onClick={handleSave} className="btn-save">
                    ✓ Terminar y Guardar
                </button>
            </div>
        </div>
    );
}
