import { useState, useEffect } from 'react';
import {
    getActiveWeeklyPlan,
    getWeeklyPlans,
    deleteWeeklyPlan,
    updateWeeklyPlan,
    subscribeToWeeklyPlan,
    saveActiveWorkout,
    saveWeeklyPlan,
    subscribeToActivePlanId,
    saveActivePlanId
} from '../utils/weeklyPlanStorage';
import { getWorkouts } from '../utils/firestoreStorage';
import WeeklyPlanCard from './WeeklyPlanCard';
import './WeeklyPlanView.css';

/**
 * WeeklyPlanView Component
 * Displays the weekly workout plan from the AI
 */
export default function WeeklyPlanView() {
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const [allPlans, setAllPlans] = useState([]);
    const [weekGroups, setWeekGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedDays, setExpandedDays] = useState({});
    const [completedWorkouts, setCompletedWorkouts] = useState([]);
    const [copySuccess, setCopySuccess] = useState(false);

    const sortDays = (days) => {
        if (!days) return [];
        return [...days].sort((a, b) => {
            if (!a.date || !b.date) return 0;
            // Handle both - and / as separators
            const dateA = a.date.replace(/[\/\.]/g, '-');
            const dateB = b.date.replace(/[\/\.]/g, '-');
            const [da, ma, ya] = dateA.split('-').map(Number);
            const [db, mb, yb] = dateB.split('-').map(Number);
            return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
        });
    };
    useEffect(() => {
        loadWeeklyPlan();

        // 1. Subscribe to Global Active Plan ID changes
        const unsubId = subscribeToActivePlanId(async (globalId) => {
            const current = await getActiveWeeklyPlan();
            if (globalId && globalId !== current?.id) {
                console.log('[Sync] Global active plan changed to:', globalId);
                // Refresh local state
                loadWeeklyPlan();
            }
        });

        return () => unsubId();
    }, []);

    // 2. Subscribe to real-time changes for the current plan ID
    useEffect(() => {
        if (!weeklyPlan?.id) return;
        // Don't subscribe to temporary history-based plans
        if (weeklyPlan.id.startsWith('history-')) return;

        console.log('[Sync] Subscribing to content updates for plan:', weeklyPlan.id);
        const unsubscribe = subscribeToWeeklyPlan(weeklyPlan.id, (updatedPlan) => {
            if (updatedPlan && updatedPlan.days) {
                updatedPlan.days = sortDays(updatedPlan.days);
            }
            // Only update if data actually changed to avoid loops
            if (JSON.stringify(updatedPlan) !== JSON.stringify(weeklyPlan)) {
                console.log('[Sync] Received content update from cloud');
                setWeeklyPlan(updatedPlan);
            }
        });

        return () => unsubscribe();
    }, [weeklyPlan?.id]);

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const parseDateStr = (dateStr) => {
        if (!dateStr) return null;
        const p = dateStr.replace(/[\/\.]/g, '-').split('-').map(Number);
        if (p.length < 3) return null;
        if (p[0] > 31) return new Date(p[0], p[1] - 1, p[2]); // YYYY-MM-DD
        return new Date(p[2], p[1] - 1, p[0]); // DD-MM-YYYY
    };

    // Get the Monday of a date's week
    const getMonday = (d) => {
        const date = new Date(d);
        const day = date.getDay(); // 0=Sun, 1=Mon...
        const diff = day === 0 ? -6 : 1 - day; // If Sunday go back 6, else go to Monday
        date.setDate(date.getDate() + diff);
        return date;
    };

    const getWeekLabel = (plan) => {
        if (!plan.days || plan.days.length === 0) return 'Plan semanal';
        const dates = plan.days
            .map(d => parseDateStr(d.date))
            .filter(Boolean)
            .sort((a, b) => a - b);
        if (dates.length === 0) return 'Plan semanal';

        const monday = getMonday(dates[0]);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        if (monday.getMonth() === sunday.getMonth()) {
            return `Sem. ${monday.getDate()}–${sunday.getDate()} ${MESES[monday.getMonth()]}`;
        }
        return `Sem. ${monday.getDate()} ${MESES[monday.getMonth()]}–${sunday.getDate()} ${MESES[sunday.getMonth()]}`;
    };

    // Get the earliest workout date from a plan (for sorting)
    const getPlanStartDate = (plan) => {
        if (!plan.days || plan.days.length === 0) return new Date(0);
        const dates = plan.days
            .map(d => parseDateStr(d.date))
            .filter(Boolean);
        return dates.length > 0 ? Math.min(...dates) : 0;
    };

    const sortPlans = (plans) => {
        if (!plans) return [];
        return [...plans].sort((a, b) => getPlanStartDate(b) - getPlanStartDate(a)); // Most recent first
    };

    // Build week groups from ALL workout history
    const buildWeekGroups = (workouts) => {
        const groups = {};
        workouts.forEach(w => {
            const date = parseDateStr(w.date);
            if (!date) return;
            const monday = getMonday(date);
            const key = monday.toISOString().split('T')[0]; // YYYY-MM-DD of monday
            if (!groups[key]) {
                groups[key] = { monday, workouts: [] };
            }
            groups[key].workouts.push(w);
        });

        // Convert to array, sorted most recent first
        return Object.values(groups)
            .sort((a, b) => b.monday - a.monday)
            .map(g => {
                const sunday = new Date(g.monday);
                sunday.setDate(g.monday.getDate() + 6);
                let label;
                if (g.monday.getMonth() === sunday.getMonth()) {
                    label = `Sem. ${g.monday.getDate()}–${sunday.getDate()} ${MESES[g.monday.getMonth()]}`;
                } else {
                    label = `Sem. ${g.monday.getDate()} ${MESES[g.monday.getMonth()]}–${sunday.getDate()} ${MESES[sunday.getMonth()]}`;
                }
                return {
                    key: g.monday.toISOString().split('T')[0],
                    label,
                    numDays: g.workouts.length,
                    monday: g.monday,
                    workouts: g.workouts.sort((a, b) => parseDateStr(a.date) - parseDateStr(b.date)),
                };
            });
    };

    const loadWeeklyPlan = async () => {
        setIsLoading(true);
        try {
            const [active, history, workouts] = await Promise.all([
                getActiveWeeklyPlan(),
                getWeeklyPlans(),
                getWorkouts()
            ]);

            if (active && active.days) {
                active.days = sortDays(active.days);
            }

            setWeeklyPlan(active);
            setAllPlans(sortPlans(history));
            setCompletedWorkouts(workouts);
            setWeekGroups(buildWeekGroups(workouts));

            // Start with all days collapsed
            setExpandedDays({});
        } catch (error) {
            console.error('Error loading weekly plan:', error);
        } finally {
            setIsLoading(false);
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
            planId: weeklyPlan.id,
            dayId: day.id,
            session: day.title,
            date: day.date,
            dayName: day.dayName,
            warm_up: day.warm_up,
            exercises: day.exercises,
            duration_minutes: day.duration_minutes
        };
        saveActiveWorkout(workout);
        window.location.hash = '#today';
        window.dispatchEvent(new CustomEvent('navigateToToday'));
    };

    const selectPlan = async (plan) => {
        if (plan && plan.days) {
            plan.days = sortDays(plan.days);
        }
        setWeeklyPlan(plan);
        localStorage.setItem('activeWeeklyPlan', JSON.stringify(plan));
        setShowHistory(false);
        setExpandedDays({});

        // Broadcast to other devices
        if (plan.id && !plan.id.startsWith('history-')) {
            await saveActivePlanId(plan.id);
        }
    };

    // Build a temporary plan view from a week group (from history workouts)
    const selectWeekGroup = (group) => {
        const days = group.workouts.map((w, idx) => ({
            id: w.id || `hist-${idx}`,
            dayName: parseDateStr(w.date)?.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase() || `DÍA ${idx + 1}`,
            title: w.session || w.title || `Día ${idx + 1}`,
            date: w.date,
            exercises: w.exercises || [],
            warm_up: w.warm_up || null,
            duration_minutes: w.duration_minutes || null,
        }));

        const tempPlan = {
            id: `history-${group.key}`,
            weekRange: group.label,
            description: '',
            rules: '',
            days: sortDays(days),
        };
        setWeeklyPlan(tempPlan);
        setShowHistory(false);
        setExpandedDays({});
    };

    const handleUpdateDay = async (updatedDay) => {
        if (!weeklyPlan) return;

        let updatedDays = weeklyPlan.days.map(day =>
            day.id === updatedDay.id ? updatedDay : day
        );

        // Always sort days after an update to keep chronological order
        updatedDays = sortDays(updatedDays);

        const updatedPlan = { ...weeklyPlan, days: updatedDays };
        setWeeklyPlan(updatedPlan); // Optimistic update

        try {
            await updateWeeklyPlan(updatedPlan);
        } catch (error) {
            console.error('Error saving plan update:', error);
        }
    };

    const handleCopyPlan = () => {
        if (!weeklyPlan || !weeklyPlan.days) return;

        let text = `📅 SEMANA GYM · ${weeklyPlan.weekRange || 'PLAN'}\n\n`;

        weeklyPlan.days.forEach((day, index) => {
            text += `🏋️ DÍA ${index + 1} – ${day.title}\n\n`;

            if (day.warm_up) {
                text += `🔥 Calentamiento: ${day.warm_up.exercise} · ${day.warm_up.duration_minutes} min\n\n`;
            }

            day.exercises.forEach(ex => {
                const name = ex.name || ex.exercise;
                const load = ex.load || (ex.weight_kg !== undefined ? `${ex.weight_kg} kg` : (ex.weight ? `${ex.weight} kg` : '0 kg'));
                const rir = ex.RIR || ex.rir;

                text += `${name}: ${ex.sets} × ${ex.reps} × ${load.toString().replace(' kg', '')} kg`;
                if (rir !== undefined && rir !== '') {
                    text += ` · RIR ${rir}`;
                }
                text += '\n';
            });

            if (day.duration_minutes) {
                text += `⏱️ ${day.duration_minutes} min\n`;
            }
            text += '\n';
        });

        if (weeklyPlan.description) {
            text += `🧠 POR QUÉ ESTE PLAN\n${weeklyPlan.description}\n\n`;
        }

        if (weeklyPlan.rules) {
            text += `📌 REGLAS DE LA SEMANA\n${weeklyPlan.rules}\n`;
        }

        navigator.clipboard.writeText(text).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const deletePlan = () => {
        if (confirm('¿Eliminar este plan semanal?')) {
            localStorage.removeItem('activeWeeklyPlan');
            setWeeklyPlan(null);
            setExpandedDays({});
        }
    };

    const deletePlanFromHistory = async (e, planId) => {
        e.stopPropagation();
        if (confirm('¿Eliminar este plan del historial?')) {
            await deleteWeeklyPlan(planId);
            // Reload plans
            const history = await getWeeklyPlans();
            setAllPlans(sortPlans(history));
            // If deleted plan was the active one, clear it
            if (weeklyPlan?.id === planId) {
                localStorage.removeItem('activeWeeklyPlan');
                setWeeklyPlan(null);
                setExpandedDays({});
            }
        }
    };

    if (isLoading) {
        return (
            <div className="weekly-plan-view">
                <h1>📅 Plan Semanal</h1>
                <div className="loading-state">
                    <div className="loading-spinner">⏳</div>
                    <p>Cargando plan...</p>
                </div>
            </div>
        );
    }

    if (!weeklyPlan) {
        return (
            <div className="weekly-plan-view">
                <h1>📅 Plan Semanal</h1>
                <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <p>No hay plan semanal activo</p>
                    <p className="empty-hint">
                        Importa un plan semanal en la pestaña "Nuevo" seleccionando "📅 Plan Semanal"
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="weekly-plan-view">
            <header className="plan-header">
                <div className="plan-title-section">
                    <h1>📅 Plan Semanal</h1>
                    <h2 className="week-range">{weeklyPlan.weekRange}</h2>
                </div>
                <div className="plan-header-actions">
                    {allPlans.length > 1 && (
                        <button
                            className="btn-history"
                            onClick={() => setShowHistory(!showHistory)}
                        >
                            📚 {showHistory ? 'Ocultar' : 'Historial'}
                        </button>
                    )}
                    <button
                        className={`btn-copy-plan ${copySuccess ? 'success' : ''}`}
                        onClick={handleCopyPlan}
                        title="Copiar plan completo para esta semana"
                    >
                        {copySuccess ? '✅ Copiado' : '📋 Copiar Plan'}
                    </button>
                    <button
                        className="btn-delete-plan"
                        onClick={deletePlan}
                        title="Eliminar plan"
                    >
                        🗑️
                    </button>
                </div>
            </header>

            {/* Plan History - Built from workout history grouped by week */}
            {showHistory && weekGroups.length > 0 && (
                <div className="plan-history">
                    <h3>Historial por Semanas</h3>
                    <div className="history-list">
                        {weekGroups.map(group => (
                            <div key={group.key} className="history-item-wrapper">
                                <button
                                    className="history-item"
                                    onClick={() => selectWeekGroup(group)}
                                >
                                    📅 {group.label} · {group.numDays} días
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Description from AI */}
            {weeklyPlan.description && (
                <div className="plan-description">
                    <div className="description-header">🧠 Por qué este plan</div>
                    <p>{weeklyPlan.description}</p>
                </div>
            )}

            {/* Days */}
            <div className="days-container">
                {weeklyPlan.days.map((day, idx) => {
                    const isCompleted = completedWorkouts.some(w =>
                        (w.planId === weeklyPlan.id && w.dayId === day.id) ||
                        (w.date === day.date) // Fallback for legacy
                    );

                    return (
                        <WeeklyPlanCard
                            key={day.id || idx}
                            day={day}
                            isExpanded={expandedDays[day.id]}
                            onToggle={() => toggleDayExpand(day.id)}
                            onLoadAsActive={() => loadDayAsActive(day)}
                            onUpdateDay={handleUpdateDay}
                            isCompleted={isCompleted}
                        />
                    );
                })}
            </div>

            {/* Rules from AI */}
            {weeklyPlan.rules && (
                <div className="plan-rules">
                    <div className="rules-header">📌 Reglas de la Semana</div>
                    <p>{weeklyPlan.rules}</p>
                </div>
            )}
        </div>
    );
}
