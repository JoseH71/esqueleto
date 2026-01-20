/**
 * Parser for text-based workout format
 * Converts structured text into JSON format for the app
 */

/**
 * Parse a workout from text format to JSON
 * @param {string} text - The workout text
 * @returns {Object} Parsed workout object
 */
export function parseWorkoutText(text) {
    const lines = text.split('\n').filter(line => line.length > 0);

    const workout = {
        session: '',
        date: '',
        warm_up: null,
        exercises: [],
        duration_minutes: null
    };

    let currentExercise = null;
    let exerciseOrder = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse session title (first line)
        if (i === 0) {
            workout.session = line;

            // Try to extract date from title (e.g., "LUNES 12-1 — PIERNA")
            // Patterns: "12-1", "12/1", "12.1"
            const dateMatch = line.match(/(\d{1,2})[-\/.](\d{1,2})/);
            if (dateMatch) {
                const day = dateMatch[1].padStart(2, '0');
                const month = dateMatch[2].padStart(2, '0');
                const year = new Date().getFullYear();
                workout.date = `${day}-${month}-${year}`;

                // Clean up session name by removing the date part and day name
                // Remove patterns like "LUNES 12-1 —" or "MARTES 15/1 -"
                workout.session = line
                    .replace(/^(LUNES|MARTES|MIÉRCOLES|MIERCOLES|JUEVES|VIERNES|SÁBADO|SABADO|DOMINGO)\s+\d{1,2}[-\/\.]\d{1,2}\s*[-—–]\s*/i, '')
                    .trim();
            }
            continue;
        }

        // Parse warm-up section
        if (line.includes('🔥') || line.toLowerCase().includes('calentamiento')) {
            const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
            if (nextLine) {
                const warmupMatch = nextLine.match(/(.+?)\s*→\s*(\d+)\s*min/);
                if (warmupMatch) {
                    workout.warm_up = {
                        exercise: warmupMatch[1].trim(),
                        duration_minutes: parseInt(warmupMatch[2])
                    };
                    i++; // Skip next line
                }
            }
            continue;
        }

        // Parse duration
        if (line.includes('⏱️') || line.toLowerCase().includes('duración total')) {
            const durationMatch = line.match(/(\d+)[-–]?(\d+)?\s*min/);
            if (durationMatch) {
                workout.duration_minutes = durationMatch[2]
                    ? parseInt(durationMatch[2])
                    : parseInt(durationMatch[1]);
            }
            continue;
        }

        // Parse exercise header (starts with emoji number like 1️⃣, 2️⃣, etc.)
        // Must have the emoji combining character to distinguish from sets/reps
        const exerciseHeaderMatch = line.match(/^([0-9]️⃣)\s+(.+)/);
        if (exerciseHeaderMatch) {
            // Save previous exercise if exists
            if (currentExercise) {
                workout.exercises.push(currentExercise);
            }

            exerciseOrder++;
            currentExercise = {
                id: exerciseOrder.toString(),
                order: exerciseOrder,
                name: exerciseHeaderMatch[2].trim(),
                sets: 0,
                reps: 0,
                load: '',
                tempo: '',
                RIR: '',
                rest_seconds: '',
                increment: '',
                notes: []
            };
            continue;
        }

        // Parse exercise with other emojis (🦵, 🔹, etc.)
        const emojiExerciseMatch = line.match(/^([🦵🔹🔸🔶🔷🔺🔻])\s+(.+)/);
        if (emojiExerciseMatch) {
            // Save previous exercise if exists
            if (currentExercise) {
                workout.exercises.push(currentExercise);
            }

            exerciseOrder++;
            currentExercise = {
                id: exerciseOrder.toString(),
                order: exerciseOrder,
                name: emojiExerciseMatch[2].trim(),
                sets: 0,
                reps: 0,
                load: '',
                tempo: '',
                RIR: '',
                rest_seconds: '',
                increment: '',
                notes: []
            };
            continue;
        }

        // Parse sub-exercises (like Pallof press under Core)
        if (line.startsWith('➤')) {
            // Save previous exercise if exists
            if (currentExercise) {
                workout.exercises.push(currentExercise);
            }

            exerciseOrder++;
            currentExercise = {
                id: exerciseOrder.toString(),
                order: exerciseOrder,
                name: line.replace('➤', '').trim(),
                sets: 0,
                reps: 0,
                load: '',
                tempo: '',
                RIR: '',
                rest_seconds: '',
                increment: '',
                notes: []
            };
            continue;
        }

        // Parse exercise details (only if we have a current exercise)
        if (currentExercise) {
            // Sets and reps: "4 × 10 @ 10 kg" or "4 × 10 por pierna @ 9.5 kg"
            // This line typically starts with a number
            const setsRepsMatch = line.match(/^(\d+)\s*[×x]\s*(\d+)(?:\s+[^@]*)?(?:\s*@\s*(.+))?/);
            if (setsRepsMatch) {
                currentExercise.sets = parseInt(setsRepsMatch[1]);
                currentExercise.reps = parseInt(setsRepsMatch[2]);
                if (setsRepsMatch[3]) {
                    currentExercise.load = setsRepsMatch[3].trim();
                }
                continue;
            }

            // Increment
            if (line.includes('Incremento:')) {
                const incrementMatch = line.match(/Incremento:\s*(.+)/);
                if (incrementMatch) {
                    currentExercise.increment = incrementMatch[1].trim();
                }
                continue;
            }

            // Tempo
            if (line.includes('Tempo')) {
                const tempoMatch = line.match(/Tempo\s+(.+)/);
                if (tempoMatch) {
                    currentExercise.tempo = tempoMatch[1].trim();
                }
                continue;
            }

            // RIR
            if (line.includes('RIR')) {
                const rirMatch = line.match(/RIR\s+(.+)/);
                if (rirMatch) {
                    currentExercise.RIR = rirMatch[1].trim();
                }
                continue;
            }

            // Rest/Descanso
            if (line.includes('Descanso')) {
                const restMatch = line.match(/Descanso\s+(.+)/);
                if (restMatch) {
                    currentExercise.rest_seconds = restMatch[1].trim();
                }
                continue;
            }

            // Any other line with bullet points or details becomes notes
            if (line.startsWith('•') || line.startsWith('-')) {
                currentExercise.notes.push(line);
            } else if (line.length > 0 && !line.match(/^[0-9️⃣🔥⏱️]/)) {
                // Other descriptive lines (but not sets/reps or exercise headers)
                currentExercise.notes.push(line);
            }
        }
    }

    // Add last exercise
    if (currentExercise) {
        workout.exercises.push(currentExercise);
    }

    // Convert notes arrays to strings and clean up
    workout.exercises = workout.exercises.filter(ex => {
        // Keep exercises that have sets/reps OR notes
        return (ex.sets > 0 && ex.reps > 0) || (ex.notes && ex.notes.length > 0);
    }).map(ex => {
        if (ex.notes && ex.notes.length > 0) {
            ex.notes = ex.notes.join('\n');
        } else {
            delete ex.notes;
        }

        // Clean up empty fields
        if (!ex.tempo) delete ex.tempo;
        if (!ex.RIR) delete ex.RIR;
        if (!ex.rest_seconds) delete ex.rest_seconds;
        if (!ex.increment) delete ex.increment;
        if (!ex.load) delete ex.load;

        return ex;
    });

    // Renumber exercises after filtering
    workout.exercises.forEach((ex, idx) => {
        ex.id = (idx + 1).toString();
        ex.order = idx + 1;
    });

    return workout;
}

/**
 * Detect if input is JSON or text format
 * @param {string} input - The input string
 * @returns {boolean} True if JSON, false if text
 */
export function isJSON(input) {
    try {
        JSON.parse(input.trim());
        return true;
    } catch {
        return false;
    }
}
