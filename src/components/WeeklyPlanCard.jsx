import { useRef } from 'react';
import './WeeklyPlanCard.css';

/**
 * WeeklyPlanCard Component
 * Reusable card for displaying a single day in the weekly plan
 */
export default function WeeklyPlanCard({ day, isExpanded, onToggle, onLoadAsActive, onUpdateDay, compact = false, isCompleted = false }) {

    const handleStatChange = (e, exerciseIndex, field, value) => {
        if (!onUpdateDay) return;

        const updatedExercises = [...day.exercises];
        updatedExercises[exerciseIndex] = {
            ...updatedExercises[exerciseIndex],
            [field]: value
        };

        onUpdateDay({
            ...day,
            exercises: updatedExercises
        });
    };

    const handleAddExercise = (e) => {
        e.stopPropagation();
        if (!onUpdateDay) return;

        const newExercise = {
            exercise: 'Nuevo Ejercicio',
            sets: '',
            reps: '',
            load: '',
            RIR: '',
            notes: ''
        };

        onUpdateDay({
            ...day,
            exercises: [...day.exercises, newExercise]
        });
    };

    const handleRemoveExercise = (e, index) => {
        e.stopPropagation();
        if (!onUpdateDay || !confirm('¿Eliminar este ejercicio?')) return;

        const updatedExercises = day.exercises.filter((_, i) => i !== index);
        onUpdateDay({
            ...day,
            exercises: updatedExercises
        });
    };

    const getDayNameFromDate = (dateStr) => {
        const [day, month, year] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
        return days[date.getDay()];
    };

    const datePickerRef = useRef(null);

    const handleDateChange = (e) => {
        if (!onUpdateDay) return;
        e.stopPropagation();

        if (datePickerRef.current) {
            // Modern way to trigger the native calendar picker
            if (typeof datePickerRef.current.showPicker === 'function') {
                datePickerRef.current.showPicker();
            } else {
                datePickerRef.current.click();
            }
        }
    };

    const handlePickerChange = (e) => {
        const value = e.target.value; // Format: YYYY-MM-DD
        if (!value) return;

        const [year, month, dayText] = value.split('-');
        const formattedDate = `${dayText}-${month}-${year}`;

        if (formattedDate !== day.date) {
            const newDayName = getDayNameFromDate(formattedDate);
            onUpdateDay({
                ...day,
                date: formattedDate,
                dayName: newDayName
            });
        }
    };

    // Helper to convert DD-MM-YYYY back to YYYY-MM-DD for the picker
    const getPickerValue = (dateStr) => {
        if (!dateStr || !dateStr.includes('-')) return '';
        const [d, m, y] = dateStr.split('-');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    return (
        <div
            className={`day-card ${isExpanded ? 'expanded' : ''} ${compact ? 'compact' : ''}`}
            style={{ '--day-color': day.gradient || `var(--day-${day.color})` }}
        >
            <div className="day-header" onClick={onToggle}>
                <div className="day-info">
                    <span className="day-emoji">{day.emoji}</span>
                    <div className="day-text">
                        <span className="day-name">
                            <input
                                type="date"
                                ref={datePickerRef}
                                className="hidden-date-picker"
                                value={getPickerValue(day.date)}
                                onChange={handlePickerChange}
                                onClick={(e) => e.stopPropagation()}
                            />
                            {day.date && day.dayName?.startsWith('DÍA') ? getDayNameFromDate(day.date) : day.dayName} <span
                                className={`date-badge ${onUpdateDay ? 'editable' : ''}`}
                                onClick={handleDateChange}
                                title={onUpdateDay ? "Click para elegir fecha en calendario" : ""}
                            >
                                {day.date}
                            </span>
                            {isCompleted && <span className="completed-check" title="Completado"> ✅</span>}
                        </span>
                        <span className="day-title">{day.title}</span>
                    </div>
                </div>
                <div className="day-actions">
                    {!compact && onLoadAsActive && (
                        <button
                            className="btn-load"
                            onClick={(e) => {
                                e.stopPropagation();
                                onLoadAsActive();
                            }}
                            title="Entrenar este día"
                        >
                            ▶
                        </button>
                    )}
                    <span className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                    </span>
                </div>
            </div>

            {isExpanded && (
                <div className="day-body">
                    {/* Warmup */}
                    {day.warm_up && (
                        <div className="day-warmup">
                            🔥 {day.warm_up.exercise}
                            {day.warm_up.duration_minutes && ` → ${day.warm_up.duration_minutes} min`}
                        </div>
                    )}

                    {/* Exercises */}
                    <div className="day-exercises">
                        {day.exercises.map((ex, idx) => (
                            <div key={idx} className="exercise-row">
                                <div className="exercise-main">
                                    <span className="exercise-num">{idx + 1}</span>
                                    {onUpdateDay ? (
                                        <input
                                            className="exercise-name-edit"
                                            type="text"
                                            value={ex.name || ex.exercise}
                                            onChange={(e) => handleStatChange(e, idx, ex.name ? 'name' : 'exercise', e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="exercise-name">{ex.name || ex.exercise}</span>
                                    )}
                                    {onUpdateDay && (
                                        <button
                                            className="btn-remove-ex"
                                            onClick={(e) => handleRemoveExercise(e, idx)}
                                            title="Eliminar ejercicio"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                                <div className="exercise-stats">
                                    {onUpdateDay ? (
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
                                                        value={ex.RIR || ex.rir || ''}
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
                                    ) : (
                                        <>
                                            <span className="stat">
                                                {ex.sets} * {ex.reps} * {ex.load || `${ex.weight || 0} kg`}
                                            </span>
                                            {(ex.RIR || ex.rir) && (
                                                <span className="stat rir-badge">RIR {ex.RIR || ex.rir}</span>
                                            )}
                                        </>
                                    )}
                                </div>
                                {(ex.tempo || ex.rest_seconds) && (
                                    <div className="exercise-details">
                                        {ex.tempo && <span className="detail">⏱️ {ex.tempo}</span>}
                                        {ex.rest_seconds && <span className="detail">⏸️ {ex.rest_seconds}</span>}
                                    </div>
                                )}
                                {ex.notes && !onUpdateDay && (
                                    <div className="exercise-notes">📝 {ex.notes}</div>
                                )}
                            </div>
                        ))}

                        {onUpdateDay && (
                            <button className="btn-add-ex" onClick={handleAddExercise}>
                                ➕ Añadir Ejercicio
                            </button>
                        )}
                    </div>

                    {/* Duration */}
                    {day.duration_minutes && (
                        <div className="day-duration">
                            ⏱️ Duración: {day.duration_minutes} min
                        </div>
                    )}

                    {/* Load button for compact mode */}
                    {compact && onLoadAsActive && (
                        <button
                            className="btn-load-full"
                            onClick={onLoadAsActive}
                        >
                            ▶ Entrenar este día
                        </button>
                    )}
                </div>
            )
            }
        </div >
    );
}
