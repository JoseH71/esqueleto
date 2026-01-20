import { useState, useEffect } from 'react';
import { getActiveWeeklyPlan } from '../utils/weeklyPlanStorage';
import WeeklyPlanCard from './WeeklyPlanCard';
import './WeeklyPlanModal.css';

/**
 * WeeklyPlanModal Component
 * Quick access modal/drawer for viewing weekly plan
 */
export default function WeeklyPlanModal({ isOpen, onClose }) {
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const [expandedDays, setExpandedDays] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadWeeklyPlan();
        }
    }, [isOpen]);

    const loadWeeklyPlan = async () => {
        setIsLoading(true);
        try {
            const plan = await getActiveWeeklyPlan();
            setWeeklyPlan(plan);
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
            session: day.title,
            date: day.date,
            dayName: day.dayName,
            warm_up: day.warm_up,
            exercises: day.exercises,
            duration_minutes: day.duration_minutes
        };
        localStorage.setItem('activeWorkout', JSON.stringify(workout));
        onClose();
        window.dispatchEvent(new CustomEvent('navigateToToday'));
    };

    const handleBackdropClick = (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal-content">
                <header className="modal-header">
                    <h2>📅 Plan Semanal</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </header>

                <div className="modal-body">
                    {isLoading ? (
                        <div className="modal-loading">
                            <span>⏳</span> Cargando...
                        </div>
                    ) : !weeklyPlan ? (
                        <div className="modal-empty">
                            <p>No hay plan semanal activo</p>
                            <p className="hint">Importa uno en la pestaña "Nuevo"</p>
                        </div>
                    ) : (
                        <>
                            <div className="modal-week-range">
                                {weeklyPlan.weekRange}
                            </div>

                            {weeklyPlan.description && (
                                <div className="modal-description">
                                    🧠 {weeklyPlan.description}
                                </div>
                            )}

                            <div className="modal-days">
                                {weeklyPlan.days.map((day, idx) => (
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

                            {weeklyPlan.rules && (
                                <div className="modal-rules">
                                    📌 {weeklyPlan.rules}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
