import { useState, useEffect, useMemo } from 'react';
import { getWorkouts, getExerciseAliases } from '../utils/firestoreStorage';
import AliasManager from './AliasManager';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import './EvolutionView.css';

// Helper to robustly parse dates from any format
const getWorkoutDateObj = (workout) => {
    if (workout.date && typeof workout.date === 'string') {
        let parts = [];
        if (workout.date.includes('-')) parts = workout.date.split('-');
        else if (workout.date.includes('/')) parts = workout.date.split('/');

        if (parts.length === 3) {
            const [p1, p2, p3] = parts.map(Number);
            if (p1 > 1000) return new Date(p1, p2 - 1, p3); // YYYY-MM-DD
            if (p3 > 1000) return new Date(p3, p2 - 1, p1); // DD-MM-YYYY
            return new Date(2000 + p3, p2 - 1, p1); // assumed DD-MM-YY
        }
    }
    return workout.timestamp ? new Date(workout.timestamp) : new Date();
};

export default function EvolutionView() {
    const [workouts, setWorkouts] = useState([]);
    const [aliases, setAliases] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedExercise, setSelectedExercise] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    const CATEGORIES = ['Todos', 'Piernas', 'Pecho', 'Espalda', 'Hombros', 'Brazos', 'Core', 'Otros'];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [savedWorkouts, savedAliases] = await Promise.all([
                getWorkouts(),
                getExerciseAliases()
            ]);
            // Sort ascending for chart (chronological)
            const sorted = [...savedWorkouts].sort((a, b) => getWorkoutDateObj(a) - getWorkoutDateObj(b));
            setWorkouts(sorted);
            setAliases(savedAliases);
        } catch (error) {
            console.error('Error loading data for evolution:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadAliasesOnly = async () => {
        const savedAliases = await getExerciseAliases();
        setAliases(savedAliases);
    };

    // Extract all unique exercise names across all history
    const uniqueExercises = useMemo(() => {
        const names = new Set();
        workouts.forEach(w => {
            if (!w.exercises) return;
            w.exercises.forEach(ex => {
                const name = ex.name || ex.exercise;
                if (name) {
                    names.add(name.trim().toUpperCase());
                }
            });
        });
        return Array.from(names).sort();
    }, [workouts]);

    // Get unmapped exercises for the dropdown
    const unmappedExercises = useMemo(() => {
        if (activeCategory !== 'Todos') return [];

        const mapped = new Set();
        aliases.forEach(ag => ag.aliases.forEach(a => mapped.add(a.toUpperCase())));
        return uniqueExercises.filter(ex => !mapped.has(ex));
    }, [uniqueExercises, aliases, activeCategory]);

    const filteredAliases = useMemo(() => {
        let list = [...aliases];
        if (activeCategory !== 'Todos') {
            list = list.filter(a => a.category === activeCategory);
        }
        return list.sort((a, b) => (a.masterName || '').localeCompare(b.masterName || ''));
    }, [aliases, activeCategory]);

    // Build chart data for the selected exercise
    const chartData = useMemo(() => {
        if (!selectedExercise) return [];

        const dataPoints = [];

        workouts.forEach(w => {
            if (!w.exercises) return;

            // Determine if selectedExercise is a Master Group or a Raw exercise
            const isMaster = selectedExercise.startsWith('[MASTER] ');
            let targetAliases = [];

            if (isMaster) {
                const masterName = selectedExercise.replace('[MASTER] ', '');
                const group = aliases.find(a => a.masterName === masterName);
                if (group) targetAliases = group.aliases.map(a => a.toUpperCase());
            } else {
                targetAliases = [selectedExercise];
            }

            // Find matching exercise(s) in this workout
            // (If you did multiple variants on the same day, this merges them for that day)
            const matchingExs = w.exercises.filter(ex => {
                const exName = (ex.name || ex.exercise || '').trim().toUpperCase();
                return targetAliases.includes(exName);
            });

            if (matchingExs.length > 0) {
                const dateObj = getWorkoutDateObj(w);
                const dateLabel = dateObj.toLocaleDateString('es-ES', {
                    month: 'short',
                    day: 'numeric'
                }).replace('.', '');

                const safeParse = (val) => {
                    if (!val) return 0;
                    if (typeof val === 'number') return val;
                    const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
                    return isNaN(num) ? 0 : num;
                };

                // Accumulate totals and find max E1RM for the day if multiple matches
                let dayVolume = 0;
                let dayMaxE1RM = 0;
                let rawStrings = [];

                matchingExs.forEach(matchingEx => {
                    const load = matchingEx.load || matchingEx.weight_kg || matchingEx.weight || '0';
                    const weight = safeParse(load);
                    const reps = safeParse(matchingEx.reps);
                    const sets = safeParse(matchingEx.sets);

                    const e1rm = weight > 0 && reps > 0 ? (weight * (1 + (reps / 30))) : weight;
                    if (e1rm > dayMaxE1RM) dayMaxE1RM = e1rm;

                    const volume = sets * reps * weight;
                    dayVolume += volume;

                    if (weight > 0 || reps > 0) {
                        const exName = matchingEx.name || matchingEx.exercise;
                        rawStrings.push(`${exName}: ${sets}x${reps}x${weight}kg`);
                    }
                });

                // Only add if we have actual data
                if (dayVolume > 0 || dayMaxE1RM > 0) {
                    dataPoints.push({
                        date: dateLabel,
                        dateISO: dateObj.toISOString().split('T')[0],
                        e1rm: Number(dayMaxE1RM.toFixed(1)),
                        volume: Number(dayVolume.toFixed(0)),
                        rawString: rawStrings.join(' | ')
                    });
                }
            }
        });

        return dataPoints;
    }, [workouts, selectedExercise, aliases]);

    // Derived filtered data for chart and table
    const filteredChartData = useMemo(() => {
        let data = [...chartData];
        if (startDate) {
            data = data.filter(d => d.dateISO >= startDate);
        }
        if (endDate) {
            data = data.filter(d => d.dateISO <= endDate);
        }
        return data;
    }, [chartData, startDate, endDate]);

    const handleCopyTable = () => {
        if (filteredChartData.length === 0) return;

        let tableStr = `Evolución: ${selectedExercise}\n`;
        tableStr += `Rango: ${startDate || 'Inicio'} hasta ${endDate || 'Hoy'}\n\n`;
        tableStr += `Fecha | 1RM Est (kg) | Volumen (kg) | Detalle\n`;
        tableStr += `------|--------------|--------------|--------\n`;

        filteredChartData.forEach(d => {
            tableStr += `${d.dateISO} | ${d.e1rm} | ${d.volume} | ${d.rawString}\n`;
        });

        navigator.clipboard.writeText(tableStr).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    if (isLoading) {
        return (
            <div className="evolution-view">
                <h1>📉 Evolución</h1>
                <div className="empty-state">
                    <div className="empty-icon">⏳</div>
                    <p>Analizando historial...</p>
                </div>
            </div>
        );
    }

    if (workouts.length === 0) {
        return (
            <div className="evolution-view">
                <h1>📉 Evolución</h1>
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <p>No hay suficientes datos</p>
                    <p className="empty-hint">Necesitas guardar entrenamientos en el historial para ver tu evolución</p>
                </div>
            </div>
        );
    }

    // Custom Tooltip component to show more info cleanly
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const rawData = payload[0].payload;
            return (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', color: '#f1f5f9' }}>
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#cbd5e1' }}>{label}</p>
                    <p style={{ color: '#667eea', fontWeight: 'bold' }}>
                        1RM Est: {rawData.e1rm} kg
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                        Volumen: {rawData.volume} kg
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                        Realizado: {rawData.rawString}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="evolution-view">
            <h1>📉 Evolución (Fase 3)</h1>
            <p className="evolution-subtitle">Analítica basada en 1RM Estimado y Volumen Total con Filtros de Grupo Muscular</p>

            <AliasManager
                uniqueExercises={uniqueExercises}
                existingAliases={aliases}
                onAliasesUpdated={loadAliasesOnly}
            />

            <div className="category-filters">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                        onClick={() => {
                            setActiveCategory(cat);
                            setSelectedExercise(''); // Reset selection on category change
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="evolution-controls">
                <div className="control-group">
                    <label>1. Selecciona un ejercicio</label>
                    <div className="select-wrapper">
                        <select
                            className="exercise-select"
                            value={selectedExercise}
                            onChange={(e) => setSelectedExercise(e.target.value)}
                        >
                            <option value="">-- Elige un ejercicio --</option>

                            {filteredAliases.length > 0 && (
                                <optgroup label="✨ AGRUPACIONES MAESTRAS">
                                    {filteredAliases.map(group => (
                                        <option key={group.id} value={`[MASTER] ${group.masterName}`}>
                                            {group.masterName} ({group.aliases.length} variantes)
                                        </option>
                                    ))}
                                </optgroup>
                            )}

                            {unmappedExercises.length > 0 && (
                                <optgroup label="📋 Ejercicios Sueltos">
                                    {unmappedExercises.map(ex => (
                                        <option key={ex} value={ex}>{ex}</option>
                                    ))}
                                </optgroup>
                            )}

                            {activeCategory !== 'Todos' && filteredAliases.length === 0 && (
                                <option disabled value="">
                                    {`⚠️ No hay agrupaciones creadas en la categoría "${activeCategory}"`}
                                </option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="control-group-row">
                    <div className="input-field">
                        <label>Desde:</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="input-field">
                        <label>Hasta:</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                </div>
            </div>

            {selectedExercise && filteredChartData.length > 0 ? (
                <>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={filteredChartData}
                                margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
                            >
                                <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#94a3b8"
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickMargin={15}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#667eea"
                                    tick={{ fill: '#667eea', fontSize: 12 }}
                                    domain={['auto', 'auto']}
                                    unit="kg"
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#475569"
                                    tick={{ fill: '#475569', fontSize: 12 }}
                                    hide={false}
                                    domain={[0, 'auto']}
                                />

                                <Tooltip content={<CustomTooltip />} />

                                <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                <Bar
                                    yAxisId="right"
                                    dataKey="volume"
                                    name="Volumen Total (kg)"
                                    fill="#334155"
                                    radius={[4, 4, 0, 0]}
                                    barSize={30}
                                />

                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="e1rm"
                                    name="1RM Estimado (Fuerza)"
                                    stroke="#667eea"
                                    strokeWidth={4}
                                    dot={{ fill: '#667eea', r: 5, strokeWidth: 2, stroke: '#0f172a' }}
                                    activeDot={{ r: 8, strokeWidth: 0 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="evolution-table-section">
                        <div className="table-header">
                            <h3>📋 Tabla de Datos</h3>
                            <button className={`btn-copy-table ${copySuccess ? 'success' : ''}`} onClick={handleCopyTable}>
                                {copySuccess ? '✅ ¡Copiado!' : '📋 Copiar para IA'}
                            </button>
                        </div>
                        <div className="table-responsive">
                            <table className="evolution-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>1RM Est</th>
                                        <th>Volumen</th>
                                        <th>Detalles</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...filteredChartData].reverse().map((d, i) => (
                                        <tr key={i}>
                                            <td className="td-date">{d.dateISO}</td>
                                            <td className="td-e1rm">{d.e1rm} kg</td>
                                            <td className="td-volume">{d.volume} kg</td>
                                            <td className="td-raw">{d.rawString}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : selectedExercise ? (
                <div className="empty-state">
                    <div className="empty-icon">🤷</div>
                    <p>No hay datos graficables para este rango o ejercicio</p>
                    <p className="empty-hint">Comprueba el filtro de fecha o que el ejercicio tenga peso y reps.</p>
                </div>
            ) : null}
        </div>
    );
}
