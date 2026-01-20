import { useState, useEffect } from 'react';
import { getActiveWeeklyPlan, getWeeklyPlans, deleteWeeklyPlan, updateWeeklyPlan, subscribeToWeeklyPlan } from '../utils/weeklyPlanStorage';
import WeeklyPlanCard from './WeeklyPlanCard';
import './WeeklyPlanView.css';

/**
 * WeeklyPlanView Component
 * Displays the weekly workout plan from the AI
 */
export default function WeeklyPlanView() {
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const [allPlans, setAllPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedDays, setExpandedDays] = useState({});

    useEffect(() => {
        loadWeeklyPlan();

        // Subscribe to active plan changes
        let unsubscribe = () => { };

        const setupSubscription = async () => {
            const active = await getActiveWeeklyPlan();
            if (active?.id) {
                unsubscribe = subscribeToWeeklyPlan(active.id, (updatedPlan) => {
                    setWeeklyPlan(updatedPlan);
                    // Also update if it's currently expanded
                    if (updatedPlan.days) {
                        // Optimistic update logic handles this generally, but this ensures remote changes reflect
                    }
                });
            }
        };

        setupSubscription();

        return () => unsubscribe();
    }, []);

    const loadWeeklyPlan = async () => {
        setIsLoading(true);
        try {
            const [active, history] = await Promise.all([
                getActiveWeeklyPlan(),
                getWeeklyPlans()
            ]);
            setWeeklyPlan(active);
            setAllPlans(history);

            // Auto-expand first day
            if (active?.days?.length > 0) {
                setExpandedDays({ [active.days[0].id]: true });
            }
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
        localStorage.setItem('activeWorkout', JSON.stringify(workout));
        window.location.hash = '#today';
        window.dispatchEvent(new CustomEvent('navigateToToday'));
    };

    const selectPlan = (plan) => {
        setWeeklyPlan(plan);
        localStorage.setItem('activeWeeklyPlan', JSON.stringify(plan));
        setShowHistory(false);
        if (plan?.days?.length > 0) {
            setExpandedDays({ [plan.days[0].id]: true });
        }
    };

    const handleUpdateDay = async (updatedDay) => {
        if (!weeklyPlan) return;

        const updatedDays = weeklyPlan.days.map(day =>
            day.id === updatedDay.id ? updatedDay : day
        );

        const updatedPlan = { ...weeklyPlan, days: updatedDays };
        setWeeklyPlan(updatedPlan); // Optimistic update

        try {
            await updateWeeklyPlan(updatedPlan);
        } catch (error) {
            console.error('Error saving plan update:', error);
            // Revert on error? For now just log
        }
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
            setAllPlans(history);
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
                        className="btn-delete-plan"
                        onClick={deletePlan}
                        title="Eliminar plan"
                    >
                        🗑️
                    </button>
                </div>
            </header>

            {/* Plan History Dropdown */}
            {showHistory && allPlans.length > 1 && (
                <div className="plan-history">
                    <h3>Planes Anteriores</h3>
                    <div className="history-list">
                        {allPlans.map(plan => (
                            <div key={plan.id} className="history-item-wrapper">
                                <button
                                    className={`history-item ${plan.id === weeklyPlan.id ? 'active' : ''}`}
                                    onClick={() => selectPlan(plan)}
                                >
                                    📅 {plan.weekRange || 'Plan sin fecha'}
                                </button>
                                <button
                                    className="btn-delete-history"
                                    onClick={(e) => deletePlanFromHistory(e, plan.id)}
                                    title="Eliminar plan"
                                >
                                    🗑️
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
                {weeklyPlan.days.map((day, idx) => (
                    <WeeklyPlanCard
                        key={day.id || idx}
                        day={day}
                        isExpanded={expandedDays[day.id]}
                        onToggle={() => toggleDayExpand(day.id)}
                        onLoadAsActive={() => loadDayAsActive(day)}
                        onUpdateDay={handleUpdateDay}
                    />
                ))}
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
