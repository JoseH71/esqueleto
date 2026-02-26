import { useState, useEffect } from 'react';
import { getWorkouts, deleteWorkout, updateWorkout } from '../utils/firestoreStorage';
import './HistoryView.css';

const getWorkoutDateObj = (workout) => {
    if (workout.date && typeof workout.date === 'string') {
        let parts = [];
        if (workout.date.includes('-')) parts = workout.date.split('-');
        else if (workout.date.includes('/')) parts = workout.date.split('/');

        if (parts.length === 3) {
            const [p1, p2, p3] = parts.map(Number);
            if (p1 > 1000) return new Date(p1, p2 - 1, p3); // YYYY-MM-DD
            if (p3 > 1000) return new Date(p3, p2 - 1, p1); // DD-MM-YYYY
            return new Date(2000 + p3, p2 - 1, p1); // assumed DD-MM-YY
        }
    }
    return workout.timestamp ? new Date(workout.timestamp) : new Date();
};

/**
 * HistoryView Component
 * Displays saved workout history from Firestore
 */
export default function HistoryView() {
    const [workouts, setWorkouts] = useState([]);
    const [expandedWorkouts, setExpandedWorkouts] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ date: '', title: '', description: '' });
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    // Parse workout date to comparable format
    const parseWorkoutDateToKey = (workout) => {
        const dateObj = getWorkoutDateObj(workout);
        // Avoid timezone shift issues by extracting local year, month, day manually
        // Or simply use the date object directly with correct offsets.
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Get set of workout dates for quick lookup
    const getWorkoutDatesSet = () => {
        const dates = new Set();
        workouts.forEach(w => {
            const key = parseWorkoutDateToKey(w);
            if (key) dates.add(key);
        });
        return dates;
    };

    // Calculate current streak
    const calculateStreak = () => {
        const workoutDates = getWorkoutDatesSet();
        let streak = 0;
        const today = new Date();
        let checkDate = new Date(today);

        // Check if today or yesterday has a workout to start streak
        const todayKey = checkDate.toISOString().split('T')[0];
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayKey = checkDate.toISOString().split('T')[0];

        if (!workoutDates.has(todayKey) && !workoutDates.has(yesterdayKey)) {
            return 0;
        }

        // Reset and count backwards
        checkDate = new Date(today);
        if (!workoutDates.has(todayKey)) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const key = checkDate.toISOString().split('T')[0];
            if (workoutDates.has(key)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
            if (streak > 365) break; // Safety limit
        }
        return streak;
    };

    // Get calendar days for current month view
    const getCalendarDays = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const workoutDates = getWorkoutDatesSet();

        const days = [];

        // Add empty slots for days before first of month
        const startPadding = (firstDay.getDay() + 6) % 7; // Monday = 0
        for (let i = 0; i < startPadding; i++) {
            days.push({ day: null, isWorkout: false });
        }

        // Add actual days
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = new Date().toISOString().split('T')[0] === dateKey;
            days.push({
                day: d,
                isWorkout: workoutDates.has(dateKey),
                isToday,
                dateKey
            });
        }

        return days;
    };

    const getMonthName = () => {
        return calendarMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    const prevMonth = () => {
        setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
    };

    const getMonthWorkoutCount = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const workoutDates = getWorkoutDatesSet();
        let count = 0;
        for (const dateKey of workoutDates) {
            const [y, m] = dateKey.split('-').map(Number);
            if (y === year && m === month + 1) count++;
        }
        return count;
    };

    // Find workout by dateKey (YYYY-MM-DD) and expand it
    const handleCalendarDayClick = (dateKey, isWorkout) => {
        if (!isWorkout || !dateKey) return;

        // Find matching workout
        const matchingWorkout = workouts.find(w => {
            const wKey = parseWorkoutDateToKey(w);
            return wKey === dateKey;
        });

        if (matchingWorkout) {
            setExpandedWorkouts(prev => ({
                ...prev,
                [matchingWorkout.id]: true
            }));

            // Scroll to the workout card
            setTimeout(() => {
                const element = document.getElementById(`workout-${matchingWorkout.id}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    };

    useEffect(() => {
        loadWorkouts();
    }, []);

    const loadWorkouts = async () => {
        setIsLoading(true);
        try {
            const saved = await getWorkouts();

            // Enhanced sorting: newest logical date first
            const sorted = [...saved].sort((a, b) => getWorkoutDateObj(b) - getWorkoutDateObj(a));
            setWorkouts(sorted);
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
        const dateObj = getWorkoutDateObj(workout);
        return dateObj.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).replace('.', ''); // cleans up the month abbreviation slightly
    };

    const handleEditStart = (e, workout) => {
        e.stopPropagation();
        setEditingId(workout.id);

        const dateObj = getWorkoutDateObj(workout);
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const dateValue = `${y}-${m}-${d}`;

        setEditForm({
            date: dateValue,
            title: workout.title || workout.session || '',
            description: workout.description || ''
        });
    };

    const handleEditCancel = (e) => {
        e.stopPropagation();
        setEditingId(null);
    };

    const handleEditSave = async (e, workoutId) => {
        e.stopPropagation();

        // Save exactly what the edit form has (YYYY-MM-DD from the input)
        let formattedDate = editForm.date;

        const updates = {
            date: formattedDate,
            title: editForm.title,
            session: editForm.title, // Keep both for safety
            description: editForm.description
        };

        const success = await updateWorkout(workoutId, updates);
        if (success) {
            setEditingId(null);
            loadWorkouts();
        } else {
            alert('Error al actualizar el entrenamiento');
        }
    };

    const handleCopyRange = () => {
        if (!startDate || !endDate) {
            alert('Por favor selecciona un rango de fechas');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const filtered = workouts.filter(w => {
            const wDate = getWorkoutDateObj(w);
            // Normalize all dates to midnight for comparison to avoid hour mismatches
            const checkDate = new Date(wDate.getFullYear(), wDate.getMonth(), wDate.getDate());
            const compareStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const compareEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

            return checkDate >= compareStart && checkDate <= compareEnd;
        }).sort((a, b) => getWorkoutDateObj(a) - getWorkoutDateObj(b));

        if (filtered.length === 0) {
            alert('No hay entrenamientos en este rango');
            return;
        }

        let summary = `Resumen de Entrenamientos (${startDate} al ${endDate})\n\n`;

        filtered.forEach(w => {
            // Title with emoji for importable format
            summary += `🏋️ ${getWorkoutTitle(w)}\n\n`;
            if (w.warm_up) {
                summary += `🔥 Calentamiento: ${w.warm_up.exercise} · ${w.warm_up.duration_minutes} min\n\n`;
            }
            w.exercises.forEach(ex => {
                const name = ex.name || ex.exercise;
                // Normalize load to just number + kg
                let loadValue = ex.load || (ex.weight_kg !== undefined ? `${ex.weight_kg}` : (ex.weight ? `${ex.weight}` : '0'));
                loadValue = loadValue.toString().replace(/\s*kg\s*/gi, '').trim();
                const rir = ex.RIR || ex.rir;

                // Format: "Exercise Name: 4 × 10 × 20 kg · RIR 5"
                summary += `${name}: ${ex.sets} × ${ex.reps} × ${loadValue} kg`;
                if (rir !== undefined && rir !== '') {
                    summary += ` · RIR ${rir}`;
                }
                summary += '\n';
            });
            if (w.duration_minutes) {
                summary += `⏱️ ${w.duration_minutes} min\n`;
            }
            summary += `\n`;
        });

        navigator.clipboard.writeText(summary).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 3000);
        });
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
            <h1>📊 Historial</h1>

            <div className="history-controls-row">
                {/* Left Side: Date Range & Copy */}
                <div className="controls-left">
                    <div className="range-selector">
                        <div className="input-field">
                            <label>Desde:</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="input-field">
                            <label>Hasta:</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <button className={`btn-copy-range ${copySuccess ? 'success' : ''}`} onClick={handleCopyRange}>
                        {copySuccess ? '✅ ¡Copiado!' : '📋 Copiar Desglose'}
                    </button>
                    <p className="history-subtitle">{workouts.length} entrenamientos guardados</p>
                </div>

                {/* Right Side: Gym Calendar */}
                <div className="gym-calendar">
                    <div className="calendar-header">
                        <button className="cal-nav" onClick={prevMonth}>◀</button>
                        <span className="cal-month">{getMonthName()}</span>
                        <button className="cal-nav" onClick={nextMonth}>▶</button>
                    </div>
                    <div className="calendar-weekdays">
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                            <span key={d} className="weekday">{d}</span>
                        ))}
                    </div>
                    <div className="calendar-grid">
                        {getCalendarDays().map((day, idx) => (
                            <div
                                key={idx}
                                className={`cal-day ${day.day ? '' : 'empty'} ${day.isWorkout ? 'workout clickable' : ''} ${day.isToday ? 'today' : ''}`}
                                title={day.isWorkout ? 'Click para ver entreno' : ''}
                                onClick={() => handleCalendarDayClick(day.dateKey, day.isWorkout)}
                            >
                                {day.day || ''}
                            </div>
                        ))}
                    </div>
                    <div className="calendar-stats">
                        <div className="stat-box">
                            <span className="stat-num">🔥 {calculateStreak()}</span>
                            <span className="stat-label">Racha</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-num">🏋️ {getMonthWorkoutCount()}</span>
                            <span className="stat-label">Este mes</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-num">🏆 {workouts.length}</span>
                            <span className="stat-label">Total</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="workout-cards">
                {workouts.map((workout) => {
                    const isExpanded = expandedWorkouts[workout.id];

                    return (
                        <div
                            key={workout.id}
                            id={`workout-${workout.id}`}
                            className={`workout-card ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleExpand(workout.id)}
                        >
                            <div className="workout-card-header">
                                <div className="workout-info">
                                    {editingId === workout.id ? (
                                        <div className="edit-fields" onClick={(e) => e.stopPropagation()}>
                                            <div className="edit-row">
                                                <input
                                                    type="date"
                                                    value={editForm.date}
                                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                                    className="edit-date-input"
                                                />
                                                <input
                                                    type="text"
                                                    value={editForm.title}
                                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                    className="edit-title-input"
                                                    placeholder="Título del entrenamiento"
                                                />
                                            </div>
                                            <textarea
                                                value={editForm.description}
                                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                className="edit-description-input"
                                                placeholder="Descripción..."
                                                rows={2}
                                            />
                                        </div>
                                    ) : (
                                        <h3>
                                            <span className="date-blue">{getWorkoutDate(workout)}</span> {getWorkoutTitle(workout)}
                                        </h3>
                                    )}
                                </div>
                                <div className="card-actions">
                                    {editingId === workout.id ? (
                                        <>
                                            <button
                                                onClick={(e) => handleEditSave(e, workout.id)}
                                                className="btn-save-edit"
                                                title="Guardar"
                                            >
                                                ✅
                                            </button>
                                            <button
                                                onClick={handleEditCancel}
                                                className="btn-cancel-edit"
                                                title="Cancelar"
                                            >
                                                ✕
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={(e) => handleEditStart(e, workout)}
                                                className="btn-edit-workout"
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, workout.id)}
                                                className="btn-delete-workout"
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="workout-card-body">
                                    {workout.description && (
                                        <div className="workout-description">
                                            <div className="description-label">📝 Descripción:</div>
                                            <p>{workout.description}</p>
                                        </div>
                                    )}
                                    {workout.warm_up && (
                                        <div className="workout-warmup">
                                            🔥 {workout.warm_up.exercise}
                                            {workout.warm_up.duration_minutes && ` (${workout.warm_up.duration_minutes} min)`}
                                        </div>
                                    )}

                                    <div className="exercise-list">
                                        {workout.exercises.map((ex, idx) => {
                                            const name = ex.name || ex.exercise;
                                            const load = ex.load ||
                                                (ex.weight_kg !== undefined ? `${ex.weight_kg} kg` :
                                                    (ex.weight ? `${ex.weight} kg` : '0 kg'));
                                            return (
                                                <div key={idx} className="exercise-item">
                                                    <span className="exercise-name">{name}</span>
                                                    <span className="exercise-details">
                                                        {ex.sets} * {ex.reps} * {load}
                                                        {(ex.RIR || ex.rir) !== undefined && (ex.RIR || ex.rir) !== '' && (
                                                            <span className="exercise-rir"> (RIR {ex.RIR || ex.rir})</span>
                                                        )}
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
