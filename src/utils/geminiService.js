import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBAvljcr-JE5Q8pH-oWj2g9vLL9hhTWdzg";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

/**
 * Ask Gemini a question with workout context
 */
export const askGemini = async (prompt, contextData) => {
    const fullPrompt = `
Eres "Coach Esqueleto", un coach de gimnasio de fuerza experto. Respondes en español, breve y directo.

DATOS DEL USUARIO:
- Fecha de hoy: ${contextData.fechaHoy || 'desconocida'}
- Entrenamiento activo (lo que está haciendo HOY): ${contextData.entrenoActivo ? JSON.stringify(contextData.entrenoActivo) : 'No tiene entreno activo ahora mismo'}
- Últimos 15 entrenamientos: ${JSON.stringify(contextData.historialReciente || [])}
- Análisis por grupo muscular: ${JSON.stringify(contextData.analisisPorGrupo || {})}
- Aliases de ejercicios: ${JSON.stringify(contextData.aliasEjercicios || [])}

PREGUNTA: "${prompt}"

Reglas:
- Responde con datos concretos: pesos, reps, fechas, 1RM estimado.
- Si pregunta por "hoy" o "mi entreno", analiza el entrenoActivo.
- Si pregunta por progresión, compara datos del historial.
- Tono motivador pero directo. Usa emojis (💪📈🔥🚀).
- Máximo 200 palabras. No des consejos médicos.
- Si no hay datos, dilo sin rodeos.
`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
};
