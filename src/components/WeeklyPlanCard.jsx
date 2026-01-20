import './WeeklyPlanCard.css';

/**
 * WeeklyPlanCard Component
 * Reusable card for displaying a single day in the weekly plan
 */
export default function WeeklyPlanCard({ day, isExpanded, onToggle, onLoadAsActive, onUpdateDay, compact = false }) {

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

    return (
        <div
            className={`day-card ${isExpanded ? 'expanded' : ''} ${compact ? 'compact' : ''}`}
            style={{ '--day-color': day.gradient || `var(--day-${day.color})` }}
        >
            <div className="day-header" onClick={onToggle}>
                <div className="day-info">
                    <span className="day-emoji">{day.emoji}</span>
                    <div className="day-text">
                        <span className="day-name">{day.dayName} {day.date}</span>
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
                                    <span className="exercise-name">{ex.name || ex.exercise}</span>
                                </div>
                                <div className="exercise-stats">
                                    {onUpdateDay ? (
                                        <div className="editable-stats-grid">
                                            <input
                                                className="stat-input"
                                                type="text"
                                                inputMode="numeric"
                                                value={ex.sets}
                                                onChange={(e) => handleStatChange(e, idx, 'sets', e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="S"
                                            />
                                            <span className="stat-separator">×</span>
                                            <input
                                                className="stat-input"
                                                type="text"
                                                inputMode="numeric"
                                                value={ex.reps}
                                                onChange={(e) => handleStatChange(e, idx, 'reps', e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="R"
                                            />
                                            <span className="stat-separator">@</span>
                                            <div className="input-with-unit">
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
                                                <span className="unit">kg</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="stat">{ex.sets}×{ex.reps}</span>
                                            {(ex.load || ex.weight) && (
                                                <span className="stat load">@ {ex.load || `${ex.weight} kg`}</span>
                                            )}
                                        </>
                                    )}
                                </div>
                                {(ex.tempo || ex.RIR || ex.rest_seconds) && (
                                    <div className="exercise-details">
                                        {ex.tempo && <span className="detail">⏱️ {ex.tempo}</span>}
                                        {ex.RIR && <span className="detail">💯 RIR {ex.RIR}</span>}
                                        {ex.rest_seconds && <span className="detail">⏸️ {ex.rest_seconds}</span>}
                                    </div>
                                )}
                                {ex.notes && (
                                    <div className="exercise-notes">📝 {ex.notes}</div>
                                )}
                            </div>
                        ))}
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
