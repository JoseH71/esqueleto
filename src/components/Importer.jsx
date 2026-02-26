import { useState } from 'react';
import { parseWorkoutText, isJSON } from '../utils/workoutParser';
import { parseWeeklyPlan, isWeeklyPlan } from '../utils/weeklyPlanParser';
import { saveWeeklyPlan } from '../utils/weeklyPlanStorage';
import './Importer.css';

/**
 * Importer Component
 * Allows user to paste workout in JSON, text, or weekly plan format
 */
export default function Importer({ onImport, onWeeklyPlanImport }) {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [inputFormat, setInputFormat] = useState('auto'); // 'auto', 'json', 'text', 'weekly'
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (isImporting) return;
        setError('');
        setIsImporting(true);

        try {
            // Check if it's a weekly plan (text format)
            const isWeekly = inputFormat === 'weekly' ||
                (inputFormat === 'auto' && isWeeklyPlan(input));

            if (isWeekly) {
                // Parse as weekly plan
                const weeklyPlan = parseWeeklyPlan(input);

                if (!weeklyPlan.days || weeklyPlan.days.length === 0) {
                    throw new Error('No se encontraron días en el plan semanal');
                }

                // Save to Firebase
                await saveWeeklyPlan(weeklyPlan);

                // Notify parent
                if (onWeeklyPlanImport) {
                    onWeeklyPlanImport(weeklyPlan);
                }

                setInput('');
                return;
            }

            let parsed;

            // Auto-detect format or use specified format
            const isJsonFormat = inputFormat === 'json' || (inputFormat === 'auto' && isJSON(input));

            if (isJsonFormat) {
                // Parse as JSON
                parsed = JSON.parse(input);

                // Check if it's a week_plan JSON format (day_1, day_2, etc.)
                if (parsed.week_plan) {
                    const weeklyPlan = {
                        title: 'Plan Semanal',
                        days: []
                    };

                    // Day colors for visual variety
                    const dayColors = ['green', 'blue', 'orange', 'purple', 'red'];
                    const dayEmojis = ['🟢', '🔵', '🟠', '🟣', '🔴'];

                    // Generate dates starting from today
                    const getDateForDay = (offset) => {
                        const date = new Date();
                        date.setDate(date.getDate() + offset);
                        const d = date.getDate();
                        const m = date.getMonth() + 1;
                        const y = date.getFullYear();
                        return `${d}-${m}-${y}`;
                    };

                    const getDayName = (offset) => {
                        const date = new Date();
                        date.setDate(date.getDate() + offset);
                        const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
                        return days[date.getDay()];
                    };

                    // Convert week_plan format to internal format
                    const dayKeys = Object.keys(parsed.week_plan).sort();
                    dayKeys.forEach((dayKey, idx) => {
                        const dayData = parsed.week_plan[dayKey];

                        // Convert exercises
                        const exercises = (dayData.exercises || []).map((ex, exIdx) => ({
                            id: String(exIdx + 1),
                            name: ex.exercise || ex.name,
                            sets: ex.sets,
                            reps: String(ex.reps),
                            load: ex.weight_kg !== undefined ? `${ex.weight_kg} kg` : '0 kg',
                            rir: ex.rir
                        }));

                        // Build day object with all required fields
                        const day = {
                            id: String(idx + 1),
                            title: dayData.name || `Día ${idx + 1}`,
                            dayName: getDayName(idx),
                            date: getDateForDay(idx),
                            emoji: dayEmojis[idx % dayEmojis.length],
                            color: dayColors[idx % dayColors.length],
                            exercises
                        };

                        // Add warmup if present
                        if (dayData.warmup) {
                            day.warm_up = {
                                exercise: dayData.warmup.exercise,
                                duration_minutes: dayData.warmup.duration_min || dayData.warmup.duration_minutes
                            };
                        }

                        // Add duration if present
                        if (dayData.duration_min) {
                            day.duration_minutes = dayData.duration_min;
                        }

                        weeklyPlan.days.push(day);
                    });


                    // Save to Firebase
                    await saveWeeklyPlan(weeklyPlan);

                    // Notify parent
                    if (onWeeklyPlanImport) {
                        onWeeklyPlanImport(weeklyPlan);
                    }

                    setInput('');
                    return;
                }

                // Flexible validation: support both old and new formats (single day)
                const hasTitle = parsed.title || parsed.session;
                if (!hasTitle) {
                    throw new Error('JSON debe tener "title", "session" o "week_plan"');
                }

                if (!Array.isArray(parsed.exercises)) {
                    throw new Error('JSON debe tener "exercises" (array)');
                }

                // Validate exercises - support both formats
                parsed.exercises.forEach((ex, idx) => {
                    const exerciseName = ex.name || ex.exercise;

                    if (!exerciseName) {
                        throw new Error(`Ejercicio ${idx + 1}: falta "name" o "exercise"`);
                    }

                    if (!ex.sets || !ex.reps) {
                        throw new Error(`Ejercicio ${idx + 1} (${exerciseName}): faltan "sets" o "reps"`);
                    }

                    // Normalize the exercise object for internal use
                    if (!ex.id && ex.order) ex.id = ex.order.toString();
                    if (!ex.name && ex.exercise) ex.name = ex.exercise;
                });
            } else {
                // Parse as text
                parsed = parseWorkoutText(input);

                if (!parsed.session) {
                    throw new Error('No se pudo detectar el título del entrenamiento');
                }

                if (parsed.exercises.length === 0) {
                    throw new Error('No se encontraron ejercicios en el texto');
                }
            }

            onImport(parsed);
            setInput(''); // Clear after successful import
        } catch (err) {
            setError(err.message);
        } finally {
            setIsImporting(false);
        }
    };


    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setInput(text);

            // Auto-select weekly if it looks like one
            if (inputFormat === 'auto' && isWeeklyPlan(text)) {
                setInputFormat('weekly');
            }
        } catch (err) {
            setError('No se pudo pegar desde el portapapeles');
        }
    };

    const getPlaceholder = () => {
        if (inputFormat === 'json') {
            return `{\n  "title": "Día A - Push",\n  "exercises": [\n    { "id": "1", "name": "Press Banca", "sets": 4, "reps": 8, "load": "60 kg" }\n  ]\n}`;
        }
        if (inputFormat === 'weekly') {
            return `📅 SEMANA GYM · 20–26 ENERO 2026

🟢 MARTES 20-1 — PIERNA + CORE
🔥 Calentamiento
 🚴 Bici reclinada → 10 min

1️⃣ Prensa Matrix — GEMELO
4 * 10 * 10 kg
 RIR 2–3

🔵 JUEVES 22-1 — UPPER ESTÉTICO
...`;
        }
        return `LUNES 12-1 — PIERNA + CORE
🔥 Calentamiento
 🚴 Bici reclinada → 10 min

1️⃣ Prensa Matrix — GEMELO
4 * 10 * 10 kg
 Incremento: ninguno
 Tempo 2↑ · 0 · 4↓ · 2 s pausa abajo
 RIR 2–3
 Descanso 90–120 s

2️⃣ Cuádriceps unilateral
4 * 10 por pierna * 9.5 kg
 Incremento: ninguno`;
    };

    return (
        <div className="importer">
            <h1>Esqueleto</h1>
            <p className="subtitle">Pega tu plan de entrenamiento</p>

            <div className="input-section">
                {/* Format Selector */}
                <div className="format-selector">
                    <label>
                        <input
                            type="radio"
                            value="auto"
                            checked={inputFormat === 'auto'}
                            onChange={(e) => setInputFormat(e.target.value)}
                        />
                        🔄 Auto
                    </label>
                    <label>
                        <input
                            type="radio"
                            value="text"
                            checked={inputFormat === 'text'}
                            onChange={(e) => setInputFormat(e.target.value)}
                        />
                        📝 Día
                    </label>
                    <label className="format-weekly">
                        <input
                            type="radio"
                            value="weekly"
                            checked={inputFormat === 'weekly'}
                            onChange={(e) => setInputFormat(e.target.value)}
                        />
                        📅 Semana
                    </label>
                    <label>
                        <input
                            type="radio"
                            value="json"
                            checked={inputFormat === 'json'}
                            onChange={(e) => setInputFormat(e.target.value)}
                        />
                        { } JSON
                    </label>
                </div>

                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={getPlaceholder()}
                    rows={16}
                />

                {error && <div className="error">{error}</div>}

                <div className="button-group">
                    <button onClick={handlePaste} className="btn-secondary">
                        📋 Pegar
                    </button>
                    <button
                        onClick={handleImport}
                        className="btn-primary"
                        disabled={isImporting}
                    >
                        {isImporting ? '⏳ Importando...' :
                            inputFormat === 'weekly' ? '📅 Importar Semana' : '▶ Importar y Entrenar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

