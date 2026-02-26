import { useState } from 'react';
import { saveExerciseAlias, deleteExerciseAlias } from '../utils/firestoreStorage';
import './AliasManager.css';

export default function AliasManager({
    uniqueExercises,
    existingAliases,
    onAliasesUpdated
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [masterName, setMasterName] = useState('');
    const [category, setCategory] = useState('Otros');
    const [selectedAliases, setSelectedAliases] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const CATEGORIES = ['Piernas', 'Pecho', 'Espalda', 'Hombros', 'Brazos', 'Core', 'Otros'];

    // Get a list of exercises that are NOT YET mapped to ANY alias group
    const mappedExercises = new Set();
    existingAliases.forEach(ag => {
        if (ag.id !== editingId) {
            ag.aliases.forEach(a => mappedExercises.add(a.toUpperCase()));
        }
    });

    const unmappedExercises = uniqueExercises.filter(
        ex => !mappedExercises.has(ex.toUpperCase())
    );

    const handleToggleAlias = (ex) => {
        setSelectedAliases(prev => {
            if (prev.includes(ex)) return prev.filter(a => a !== ex);
            return [...prev, ex];
        });
    };

    const handleSave = async () => {
        if (!masterName.trim() || selectedAliases.length === 0) return;

        setIsSaving(true);
        try {
            await saveExerciseAlias({
                id: editingId,
                masterName: masterName.trim(),
                category: category,
                aliases: selectedAliases
            });
            // Reset form
            setEditingId(null);
            setMasterName('');
            setCategory('Otros');
            setSelectedAliases([]);
            // Tell parent to refresh
            await onAliasesUpdated();
        } catch (error) {
            console.error('Error saving alias:', error);
            alert('Error al guardar el alias');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (aliasId) => {
        if (!confirm('¿Eliminar esta agrupación de alias? Los ejercicios volverán a estar sueltos.')) return;

        try {
            await deleteExerciseAlias(aliasId);
            if (editingId === aliasId) {
                handleCancelEdit();
            }
            await onAliasesUpdated();
        } catch (error) {
            console.error('Error deleting alias:', error);
            alert('Error al eliminar');
        }
    };

    const handleEdit = (group) => {
        setEditingId(group.id);
        setMasterName(group.masterName);
        setCategory(group.category || 'Otros');
        setSelectedAliases([...group.aliases]);
        // scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setMasterName('');
        setCategory('Otros');
        setSelectedAliases([]);
    };

    if (!isOpen) {
        return (
            <div className="alias-manager-collapsed">
                <button className="btn-toggle-alias" onClick={() => setIsOpen(true)}>
                    ⚙️ Gestionar Agrupación de Ejercicios
                </button>
            </div>
        );
    }

    return (
        <div className="alias-manager">
            <div className="alias-header">
                <h3>🔗 Motor de Alias (Agrupar ejercicios)</h3>
                <button className="btn-toggle-alias" onClick={() => setIsOpen(false)}>
                    Ocultar
                </button>
            </div>

            <div className="alias-content">
                {/* Nuevo Grupo / Edición */}
                <div className="alias-form">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ color: '#f1f5f9', margin: 0, fontSize: '1.1rem' }}>
                            {editingId ? '✏️ Editando Agrupación' : '➕ Nueva Agrupación'}
                        </h4>
                        {editingId && (
                            <button className="btn-toggle-alias" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={handleCancelEdit}>
                                Cancelar edición
                            </button>
                        )}
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        {editingId
                            ? 'Añade o quita variantes para esta agrupación. Los desmarcados volverán a estar sueltos.'
                            : 'Crea un nombre maestro (ej. "PRENSA") y marca todos los ejercicios sueltos de tu historial que signifiquen lo mismo.'}
                    </p>
                    <div className="alias-form-row">
                        <input
                            type="text"
                            value={masterName}
                            onChange={(e) => setMasterName(e.target.value.toUpperCase())}
                            className="alias-input"
                            placeholder="Nombre Maestro (ej. PRESS BANCA)"
                        />
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="alias-input"
                            style={{ flex: '0 0 auto', width: '150px' }}
                        >
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <button
                            className="btn-save-alias"
                            onClick={handleSave}
                            disabled={isSaving || !masterName.trim() || selectedAliases.length === 0}
                        >
                            {isSaving ? '⏳ Guardando...' : 'Guardar Fusión'}
                        </button>
                    </div>

                    <div className="raw-exercise-list">
                        {unmappedExercises.map(ex => (
                            <label key={ex} className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selectedAliases.includes(ex)}
                                    onChange={() => handleToggleAlias(ex)}
                                />
                                <span>{ex}</span>
                            </label>
                        ))}
                        {unmappedExercises.length === 0 && (
                            <p style={{ color: '#475569', padding: '1rem' }}>No quedan ejercicios sueltos para agrupar.</p>
                        )}
                    </div>
                </div>

                {/* Grupos Existentes */}
                {existingAliases.length > 0 && (
                    <div className="existing-aliases">
                        <h4>Agrupaciones Activas</h4>
                        {[...existingAliases]
                            .sort((a, b) => (a.masterName || '').localeCompare(b.masterName || ''))
                            .map(group => (
                                <div key={group.id} className="alias-group-card">
                                    <div className="alias-group-info">
                                        <h5 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {group.masterName}
                                            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: '#334155', borderRadius: '12px', color: '#cbd5e1' }}>
                                                {group.category || 'Otros'}
                                            </span>
                                        </h5>
                                        <div className="alias-tags">
                                            {group.aliases.map(a => (
                                                <span key={a} className="alias-tag">{a}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="alias-group-actions">
                                        <button
                                            className="btn-edit-alias"
                                            onClick={() => handleEdit(group)}
                                            title="Editar fusión"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn-delete-alias"
                                            onClick={() => handleDelete(group.id)}
                                            title="Deshacer fusión"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}
