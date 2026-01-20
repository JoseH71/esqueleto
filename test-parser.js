// Test script to debug the weekly plan parser
import { parseWeeklyPlan } from './src/utils/weeklyPlanParser.js';

const testText = `📅 SEMANA GYM · 20–26 ENERO 2026

Días propuestos:
🟢 Martes 20-1
🔵 Jueves 22-1
🟠 Sábado 24-1
(Bici queda fuera del gym, sin interferencias)

🟢 MARTES 20-1 — PIERNA + CORE

🔥 Calentamiento
🚴 Bici reclinada → 10 min

1️⃣ Prensa Matrix — GEMELO
4 × 10 @ 10 kg

🔵 JUEVES 22-1 — UPPER ESTÉTICO

🔥 Calentamiento
🚴 Bici reclinada → 10 min

1️⃣ Press banca
4 × 10 @ 20 kg

🟠 SÁBADO 24-1 — ESTÉTICA + GEMELO

🔥 Calentamiento
🚴 Bici reclinada → 10 min

1️⃣ Press banca inclinado
3 × 12 @ 20 kg

🧠 POR QUÉ ESTA SEMANA ESTÁ BIEN PLANTEADA

Compensa que la semana pasada hubo solo 2 gyms

📌 REGLA DE ESTA SEMANA

Si algún ejercicio vuelve a ir "sobrado", NO subes peso`;

console.log('Testing weekly plan parser...\n');
const result = parseWeeklyPlan(testText);

console.log('Parsed plan:');
console.log('- Week range:', result.weekRange);
console.log('- Days found:', result.days.length);
console.log('- Day details:');
result.days.forEach((day, i) => {
    console.log(`  ${i + 1}. ${day.emoji} ${day.dayName} ${day.date} - ${day.title}`);
    console.log(`     Exercises: ${day.exercises.length}`);
});
console.log('\n- Description:', result.description ? 'YES' : 'NO');
console.log('- Rules:', result.rules ? 'YES' : 'NO');
