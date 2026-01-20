/**
 * Parser for AI-generated weekly workout plans
 * Converts the structured text format into JSON
 */
import { parseWorkoutText } from './workoutParser';

/**
 * Day color mapping based on emoji
 */
const DAY_COLORS = {
    '🟢': { color: 'green', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    '🔵': { color: 'blue', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
    '🟠': { color: 'orange', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    '🔴': { color: 'red', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    '🟣': { color: 'purple', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }
};

/**
 * Parse a complete weekly plan from AI text
 * @param {string} text - The weekly plan text
 * @returns {Object} Parsed weekly plan object
 */
export function parseWeeklyPlan(text) {
    const lines = text.split('\n');

    const weeklyPlan = {
        id: generatePlanId(),
        weekRange: '',
        description: '',
        rules: '',
        days: []
    };

    let currentSection = null;
    let currentDayText = [];
    let currentDayMeta = null;
    let collectingDescription = false;
    let collectingRules = false;
    let descriptionLines = [];
    let rulesLines = [];

    console.log('[Parser] Starting to parse weekly plan...');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Parse week range header (📅 SEMANA GYM · 20–26 ENERO 2026)
        if (trimmedLine.includes('📅') && trimmedLine.toLowerCase().includes('semana')) {
            const match = trimmedLine.match(/📅\s*SEMANA\s+GYM\s*[·•]\s*(.+)/i);
            if (match) {
                weeklyPlan.weekRange = match[1].trim();
            } else {
                // Fallback: extract anything after 📅
                weeklyPlan.weekRange = trimmedLine.replace('📅', '').replace(/SEMANA\s*GYM\s*[·•]?/i, '').trim();
            }
            console.log('[Parser] Found week range:', weeklyPlan.weekRange);
            continue;
        }

        // Detect day header (🟢 MARTES 20-1 — PIERNA + CORE)
        // Updated to support accented characters like SÁBADO
        const dayMatch = trimmedLine.match(/^(🟢|🔵|🟠|🔴|🟣)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)\s+(\d{1,2}[-\/\.]\d{1,2})\s*[—–-]\s*(.+)/);
        if (dayMatch) {
            // Save previous day if exists
            if (currentDayMeta && currentDayText.length > 0) {
                console.log('[Parser] Saving previous day:', currentDayMeta.dayName, currentDayMeta.dateStr);
                const parsedDay = parseDayFromText(currentDayMeta, currentDayText.join('\n'));
                if (parsedDay) {
                    weeklyPlan.days.push(parsedDay);
                    console.log('[Parser] Day saved successfully. Total days:', weeklyPlan.days.length);
                }
            }

            // Start new day
            console.log('[Parser] Found new day:', dayMatch[2], dayMatch[3], '-', dayMatch[4]);
            currentDayMeta = {
                emoji: dayMatch[1],
                dayName: dayMatch[2].toUpperCase(),
                dateStr: dayMatch[3],
                title: dayMatch[4].trim(),
                colorInfo: DAY_COLORS[dayMatch[1]] || DAY_COLORS['🟢']
            };
            currentDayText = [trimmedLine];
            collectingDescription = false;
            collectingRules = false;
            continue;
        }

        // Detect description section (🧠 POR QUÉ...)
        if (trimmedLine.includes('🧠') || trimmedLine.toLowerCase().includes('por qué')) {
            console.log('[Parser] Found description section');
            // Save current day first (IMPORTANT: save before switching to description mode)
            if (currentDayMeta && currentDayText.length > 0) {
                console.log('[Parser] Saving day before description:', currentDayMeta.dayName);
                const parsedDay = parseDayFromText(currentDayMeta, currentDayText.join('\n'));
                if (parsedDay) {
                    weeklyPlan.days.push(parsedDay);
                    console.log('[Parser] Day saved. Total days:', weeklyPlan.days.length);
                }
                currentDayMeta = null;
                currentDayText = [];
            }
            collectingDescription = true;
            collectingRules = false;
            continue;
        }

        // Detect rules section (📌 REGLA...)
        if (trimmedLine.includes('📌') || trimmedLine.toLowerCase().includes('regla')) {
            console.log('[Parser] Found rules section');
            // Save current day if still active
            if (currentDayMeta && currentDayText.length > 0) {
                console.log('[Parser] Saving day before rules:', currentDayMeta.dayName);
                const parsedDay = parseDayFromText(currentDayMeta, currentDayText.join('\n'));
                if (parsedDay) {
                    weeklyPlan.days.push(parsedDay);
                    console.log('[Parser] Day saved. Total days:', weeklyPlan.days.length);
                }
                currentDayMeta = null;
                currentDayText = [];
            }
            collectingDescription = false;
            collectingRules = true;
            continue;
        }

        // Collect description lines
        if (collectingDescription && trimmedLine && !collectingRules) {
            descriptionLines.push(trimmedLine);
            continue;
        }

        // Collect rules lines
        if (collectingRules && trimmedLine) {
            rulesLines.push(trimmedLine);
            continue;
        }

        // If currently in a day, add line to that day's text
        if (currentDayMeta) {
            currentDayText.push(line);
        }
    }

    // Save last day (in case it wasn't saved yet)
    if (currentDayMeta && currentDayText.length > 0) {
        console.log('[Parser] Saving last day:', currentDayMeta.dayName);
        const parsedDay = parseDayFromText(currentDayMeta, currentDayText.join('\n'));
        if (parsedDay) {
            weeklyPlan.days.push(parsedDay);
            console.log('[Parser] Last day saved. Total days:', weeklyPlan.days.length);
        }
    }

    // Set description and rules
    weeklyPlan.description = descriptionLines.join('\n').trim();
    weeklyPlan.rules = rulesLines.join('\n').trim();

    console.log('[Parser] Parsing complete. Total days:', weeklyPlan.days.length);
    console.log('[Parser] Days:', weeklyPlan.days.map(d => `${d.emoji} ${d.dayName} ${d.date}`).join(', '));

    return weeklyPlan;
}

/**
 * Parse a single day from its text content
 * @param {Object} meta - Day metadata (emoji, dayName, dateStr, title)
 * @param {string} text - The day's content text
 * @returns {Object} Parsed day object
 */
function parseDayFromText(meta, text) {
    // Use the existing workout parser for the exercises
    const workout = parseWorkoutText(text);

    // Format the date
    const dateMatch = meta.dateStr.match(/(\d{1,2})[-\/\.](\d{1,2})/);
    let formattedDate = meta.dateStr;
    if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        formattedDate = `${day}-${month}`;
    }

    return {
        id: `day-${meta.dateStr.replace(/[\/\.]/g, '-')}`,
        date: formattedDate,
        dayName: meta.dayName,
        emoji: meta.emoji,
        color: meta.colorInfo.color,
        gradient: meta.colorInfo.gradient,
        title: meta.title || workout.session,
        warm_up: workout.warm_up,
        exercises: workout.exercises,
        duration_minutes: workout.duration_minutes
    };
}

/**
 * Generate a unique plan ID based on current date
 */
function generatePlanId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `week-${year}-${month}-${day}`;
}

/**
 * Check if text looks like a weekly plan (multiple days)
 * @param {string} text - Input text
 * @returns {boolean} True if it appears to be a weekly plan
 */
export function isWeeklyPlan(text) {
    // Check for multiple day markers or week header
    const hasWeekHeader = text.includes('📅') && text.toLowerCase().includes('semana');
    const dayEmojis = (text.match(/🟢|🔵|🟠|🔴|🟣/g) || []).length;
    return hasWeekHeader || dayEmojis >= 2;
}
