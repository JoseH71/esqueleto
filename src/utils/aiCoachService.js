/**
 * Coach AI Service - Local Analysis Engine
 * Analyzes gym data and provides "AI-like" responses based on actual metrics
 */
import { getWorkouts, getExerciseAliases } from './firestoreStorage';
import { askGemini } from './geminiService';

/**
 * Normalizes an exercise name using the alias dictionary
 */
const normalizeExerciseName = (name, aliases) => {
    const lowerName = name.toLowerCase().trim();
    for (const group of aliases) {
        if (group.masterName.toLowerCase() === lowerName) return group.masterName;
        if (group.aliases.some(a => a.toLowerCase() === lowerName)) return group.masterName;
    }
    return name;
};

/**
 * Intelligent mapping of keywords to Muscle Groups
 */
const CATEGORY_MAP = {
    'Pierna': ['pierna', 'pata', 'cuadriceps', 'quad', 'femor', 'gluteo', 'gemelo', 'prensa', 'extensio', 'sentadilla', 'zancada', 'lunge', 'hip thrust', 'abductor', 'adductor'],
    'Pecho': ['pecho', 'pectoral', 'banca', 'chest', 'apertura', 'cruces', 'fondos'],
    'Espalda': ['espalda', 'dorsal', 'back', 'remo', 'dominada', 'jalon', 'pull', 'traccion'],
    'Hombro': ['hombro', 'deltoid', 'shoulder', 'militar', 'lateral', 'pajaro'],
    'Brazo': ['brazo', 'bicep', 'tricep', 'curll', 'martillo', 'frances', 'polea'],
    'Core': ['core', 'abdomen', 'abdominal', 'plancha', 'crunch', 'rueda', 'oblicuo']
};

/**
 * Extracts potential muscle groups or categories from a prompt
 */
const extractCategories = (prompt) => {
    const categories = [];
    for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
        if (keywords.some(k => prompt.toLowerCase().includes(k))) {
            categories.push(cat);
        }
    }
    return categories;
};

/**
 * Extracts potential exercise names from a user prompt
 */
const extractExerciseNames = (prompt, aliases) => {
    const found = [];
    const allNames = aliases.flatMap(g => [g.masterName, ...g.aliases]);

    allNames.sort((a, b) => b.length - a.length);

    for (const potential of allNames) {
        if (prompt.toLowerCase().includes(potential.toLowerCase())) {
            found.push(normalizeExerciseName(potential, aliases));
        }
    }
    return [...new Set(found)];
};

/**
 * Analyzes progression data for a specific exercise
 */
const analyzeProgression = (exerciseName, workouts, aliases) => {
    const data = [];
    workouts.forEach(workout => {
        const matchingEx = workout.exercises?.find(ex =>
            normalizeExerciseName(ex.name || ex.exercise, aliases) === exerciseName ||
            (ex.name || ex.exercise).toLowerCase().includes(exerciseName.toLowerCase())
        );

        if (matchingEx) {
            const loadStr = matchingEx.load || matchingEx.weight || '0';
            const load = parseFloat(loadStr.replace(/[^\d.]/g, '')) || 0;
            const reps = parseInt(matchingEx.reps) || 0;
            const sets = parseInt(matchingEx.sets) || 0;

            if (load > 0 && reps > 0) {
                const e1rm = reps > 1 ? load / (1.0278 - (0.0278 * reps)) : load;
                data.push({
                    date: workout.date || workout.timestamp?.split('T')[0],
                    load, reps, sets,
                    e1rm: Math.round(e1rm * 10) / 10,
                    volume: load * reps * sets
                });
            }
        }
    });
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    return data;
};

/**
 * Smart Search for exercises belonging to a category
 */
const findExercisesForCategory = (category, workouts, aliases) => {
    const keywords = CATEGORY_MAP[category] || [];
    const allWorkoutExercises = new Set();

    // 1. First, look at exercises in history
    workouts.forEach(w => {
        w.exercises?.forEach(ex => {
            const name = (ex.name || ex.exercise).toLowerCase();
            if (keywords.some(k => name.includes(k))) {
                allWorkoutExercises.add(normalizeExerciseName(ex.name || ex.exercise, aliases));
            }
        });
    });

    // 2. Also look at the Alias manager's category field
    aliases.forEach(a => {
        if (a.category?.toLowerCase() === category.toLowerCase()) {
            allWorkoutExercises.add(a.masterName);
        }
    });

    return Array.from(allWorkoutExercises);
};

/**
 * Generates a Coach-style response based on analysis
 */
const generateCoachResponse = (prompt, workouts, aliases) => {
    const categories = extractCategories(prompt);

    if (categories.length > 0) {
        const responses = categories.map(cat => {
            const exNames = findExercisesForCategory(cat, workouts, aliases);

            if (exNames.length === 0) {
                return `He buscado en tu historial pero no encuentro ejercicios que parezcan ser de **${cat}**. \n\n¿Quizás los llamas de otra forma? Si me dices el nombre exacto de un ejercicio (ej: "Prensa Matrix"), podré analizarlo mejor.`;
            }

            const performance = exNames.map(name => {
                const history = analyzeProgression(name, workouts, aliases);
                if (history.length > 0) {
                    const last = history[history.length - 1];
                    return { name, ...last };
                }
                return null;
            }).filter(Boolean);

            if (performance.length === 0) return `Vaya, tengo los nombres de tus ejercicios de **${cat}** pero no encuentro datos de carga suficientes para analizarlos.`;

            const exSummary = performance.map(ex => {
                return `- **${ex.name}**: ${ex.load}kg x ${ex.reps} (1RM est: ${ex.e1rm}kg)`;
            }).join('\n');

            return `Analizando tu progreso en **${cat}**:\n\nHe encontrado estos ejercicios en tu historial:\n${exSummary}\n\nEn general, para ${cat} estás moviendo un volumen sólido. ¡Sigue así!`;
        });

        return { text: responses.join('\n\n'), type: 'success' };
    }

    // Fallback if no category found - look for specific exercise words in prompt
    const explicitExercises = extractExerciseNames(prompt, aliases);
    if (explicitExercises.length > 0) {
        const responses = explicitExercises.map(name => {
            const history = analyzeProgression(name, workouts, aliases);
            if (history.length < 2) return `Tengo pocos datos de **${name}**. Necesito más registros para ver tu evolución.`;

            const first = history[0];
            const last = history[history.length - 1];
            const diff = last.e1rm - first.e1rm;
            const trend = diff > 0 ? '📈 mejorado' : 'mantenido';
            return `Tu **${name}** ha ${trend} un **${Math.abs(Math.round((diff / first.e1rm) * 100))}%** (de ${first.e1rm}kg a ${last.e1rm}kg).`;
        });
        return { text: responses.join('\n\n'), type: 'success' };
    }

    return {
        text: "¡Hola! Soy tu Coach AI. No he pillado qué ejercicio o grupo muscular quieres analizar. Prueba con: '¿Cómo van mis piernas?' o '¿Qué tal mi Press Banca?'",
        type: 'neutral'
    };
};

/**
 * Main function to talk to the AI
 */
export const askCoachAI = async (prompt) => {
    const workouts = await getWorkouts();
    const aliases = await getExerciseAliases();

    // Also get the active workout (today's session) if available
    let activeWorkout = null;
    try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const snap = await getDoc(doc(db, 'appState', 'activeWorkout'));
        if (snap.exists()) activeWorkout = snap.data()?.workout || null;
    } catch (e) { /* no active workout, that's fine */ }

    try {
        // Build category analysis using existing functions
        const categories = ['Pierna', 'Pecho', 'Espalda', 'Hombro', 'Brazo', 'Core'];
        const categoryAnalysis = {};
        categories.forEach(cat => {
            const exNames = findExercisesForCategory(cat, workouts.slice(0, 30), aliases);
            if (exNames.length > 0) {
                const details = exNames.map(name => {
                    const history = analyzeProgression(name, workouts, aliases);
                    if (history.length > 0) {
                        const last = history[history.length - 1];
                        return { name, lastLoad: last.load, lastReps: last.reps, e1rm: last.e1rm, sessions: history.length };
                    }
                    return { name, sessions: 0 };
                });
                categoryAnalysis[cat] = { exercises: details, exerciseCount: exNames.length };
            }
        });

        const context = {
            fechaHoy: new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            entrenoActivo: activeWorkout ? {
                session: activeWorkout.session,
                exercises: activeWorkout.exercises?.map(ex => ({
                    name: ex.name || ex.exercise,
                    sets: ex.sets,
                    reps: ex.reps,
                    load: ex.load || ex.weight,
                    RIR: ex.RIR || '',
                    notes: ex.notes || ''
                }))
            } : null,
            historialReciente: workouts.slice(0, 15).map(w => ({
                date: w.date,
                session: w.session,
                exercises: w.exercises?.map(ex => ({
                    name: ex.name || ex.exercise,
                    sets: ex.sets,
                    reps: ex.reps,
                    load: ex.load || ex.weight
                }))
            })),
            analisisPorGrupo: categoryAnalysis,
            aliasEjercicios: aliases.map(a => ({ master: a.masterName, aliases: a.aliases, cat: a.category }))
        };

        const responseText = await askGemini(prompt, context);
        return { text: responseText, type: 'success' };
    } catch (error) {
        console.warn("Gemini falló, usando análisis local:", error);
        return generateCoachResponse(prompt, workouts, aliases);
    }
};

