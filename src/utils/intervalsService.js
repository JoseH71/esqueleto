
/**
 * Intervals.icu Service
 * Handles workout conversion and API integration
 */

const STORAGE_KEYS = {
    ATHLETE_ID: 'intervals_athlete_id',
    API_KEY: 'intervals_api_key'
};

/**
 * Saves Intervals.icu credentials to localStorage
 */
export const saveIntervalsCredentials = (athleteId, apiKey) => {
    localStorage.setItem(STORAGE_KEYS.ATHLETE_ID, athleteId);
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
};

/**
 * Gets Intervals.icu credentials from localStorage
 */
export const getIntervalsCredentials = () => {
    return {
        athleteId: localStorage.getItem(STORAGE_KEYS.ATHLETE_ID),
        apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY)
    };
};

/**
 * Converts a workout to Intervals.icu strength text format
 */
export const convertToIntervalsText = (workout) => {
    let text = `${workout.title || workout.session}\n\n`;

    if (workout.description) {
        text += `${workout.description}\n\n`;
    }

    workout.exercises.forEach((ex, idx) => {
        const name = ex.name || ex.exercise;
        const load = ex.load || (ex.weight ? `${ex.weight}kg` : '');
        const sets = ex.sets || 0;
        const reps = ex.reps || 0;
        const rir = ex.RIR || ex.rir;

        // Intervals format: - Exercise Name 3x10 50kg
        text += `- ${name} ${sets}x${reps}`;
        if (rir !== undefined && rir !== '') {
            text += ` RIR ${rir}`;
        }
        if (load) {
            text += ` ${load}`;
        }
        text += '\n';

        if (ex.notes) {
            text += `  Notes: ${ex.notes}\n`;
        }
    });

    return text;
};

/**
 * Uploads a workout to Intervals.icu as a planned workout/event
 */
export const uploadToIntervals = async (workout) => {
    const { athleteId, apiKey } = getIntervalsCredentials();

    if (!athleteId || !apiKey) {
        throw new Error('Faltan las credenciales de Intervals.icu (Athlete ID o API Key)');
    }

    // Convert date to YYYY-MM-DD (Intervals.icu format)
    let dateStr = workout.date;
    console.log('📅 Fecha recibida del workout:', dateStr);

    if (dateStr) {
        // Handle multiple date formats
        if (dateStr.includes('/')) {
            // DD/MM/YYYY format
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    // YYYY/MM/DD
                    dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else {
                    // DD/MM/YYYY -> YYYY-MM-DD
                    dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        } else if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    // Already YYYY-MM-DD, keep it
                    dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[0].length === 2) {
                    // DD-MM-YYYY -> YYYY-MM-DD
                    dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        }
    } else {
        // No date provided, use today
        dateStr = new Date().toISOString().split('T')[0];
    }

    console.log('📅 Fecha convertida para API:', dateStr);

    // Use current time for more precision, or default to 09:00
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const description = convertToIntervalsText(workout);

    // Calculate TSS based on workout type or duration
    const workoutName = (workout.title || workout.session || '').toUpperCase();
    let tss = 0;
    const durationMins = workout.duration_minutes || 60;

    if (workoutName.includes('PIERNA')) {
        tss = 50;
    } else if (workoutName.includes('UPPER')) {
        tss = 35;
    } else {
        // Fallback: approx 40 per hour
        tss = Math.round((durationMins / 60) * 40);
    }

    const event = {
        category: 'WORKOUT',
        type: 'WeightTraining',
        start_date_local: `${dateStr}T${timeStr}`,
        moving_time: durationMins * 60,
        icu_training_load: tss,
        name: workout.title || workout.session,
        description: description,
        id: workout.intervalsId || null
    };

    // Intervals uses Basic Auth: 'API_KEY' as username, the key as password
    const auth = btoa(`API_KEY:${apiKey}`);

    const response = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/bulk?upsert=true`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify([event])
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error de Intervals.icu: ${response.status}`);
    }

    return await response.json();
};
