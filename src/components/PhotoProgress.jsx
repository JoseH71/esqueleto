import { useState, useEffect, useRef, useCallback } from 'react';
import { uploadPhoto, listPhotos, deletePhoto, deleteAllPhotos, updatePhotoDate } from '../utils/photoService';
import ReactCompareImage from 'react-compare-image';
import './PhotoProgress.css';

export default function PhotoProgress() {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);

    // upload flow (multi-file)
    const [previewFiles, setPreviewFiles] = useState([]);   // [{file, previewUrl}]
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState('');    // "Subiendo 2 de 5..."
    const [dragging, setDragging] = useState(false);
    const [uploadDate, setUploadDate] = useState(''); // manual date override for all photos
    const fileInputRef = useRef(null);

    // view mode
    const [viewMode, setViewMode] = useState('large');
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = newest first, 'asc' = oldest first

    // modal & compare
    const [modalPhoto, setModalPhoto] = useState(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareA, setCompareA] = useState(null);
    const [compareB, setCompareB] = useState(null);
    const [editingDate, setEditingDate] = useState(null); // photoId being edited

    // ─── load photos ────────────────────────────────────────────────────────
    const loadPhotos = useCallback(async () => {
        try {
            setLoading(true);
            const list = await listPhotos();
            setPhotos(list);
        } catch (err) {
            console.error('Error loading photos:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Sort photos based on current sort order
    const sortedPhotos = [...photos].sort((a, b) => {
        const da = new Date(a.date), db = new Date(b.date);
        return sortOrder === 'desc' ? db - da : da - db;
    });

    useEffect(() => { loadPhotos(); }, [loadPhotos]);

    useEffect(() => { loadPhotos(); }, [loadPhotos]);

    // ─── date editing ──────────────────────────────────────────────────────
    const [editDateValue, setEditDateValue] = useState('');

    const startEditDate = (photo) => {
        setEditingDate(photo.id);
        setEditDateValue(photo.date ? photo.date.substring(0, 10) : '');
    };

    const saveEditDate = async () => {
        if (!editingDate || !editDateValue) return;
        try {
            await updatePhotoDate(editingDate, editDateValue);
            setEditingDate(null);
            setEditDateValue('');
            // Update modalPhoto in place so modal stays open
            if (modalPhoto && modalPhoto.id === editingDate) {
                setModalPhoto({ ...modalPhoto, date: new Date(editDateValue).toISOString() });
            }
            await loadPhotos();
        } catch (err) {
            alert('Error al cambiar fecha: ' + err.message);
        }
    };

    // ─── file selection (multi) ────────────────────────────────────────────
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        prepareMultiPreview(files);
    };

    const prepareMultiPreview = (files) => {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (!imageFiles.length) return;

        const previews = imageFiles.map(file => ({
            file,
            previewUrl: URL.createObjectURL(file),
        }));
        setPreviewFiles(prev => [...prev, ...previews]);
    };

    const removePreview = (index) => {
        setPreviewFiles(prev => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[index].previewUrl);
            updated.splice(index, 1);
            return updated;
        });
    };

    const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const handleDragLeave = () => setDragging(false);
    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        prepareMultiPreview(files);
    };

    // ─── upload all ─────────────────────────────────────────────────────────
    const handleUploadAll = async () => {
        if (!previewFiles.length) return;
        try {
            setUploading(true);
            const total = previewFiles.length;

            for (let i = 0; i < total; i++) {
                setUploadStatus(`Subiendo ${i + 1} de ${total}...`);
                setUploadProgress(Math.round(((i) / total) * 100));

                const dateOverride = uploadDate || null;
                await uploadPhoto(previewFiles[i].file, '', (p) => {
                    const overallProgress = Math.round(((i + p / 100) / total) * 100);
                    setUploadProgress(overallProgress);
                }, dateOverride);
            }

            setUploadProgress(100);
            setUploadStatus('✅ ¡Todas subidas!');

            // Clean up
            previewFiles.forEach(p => URL.revokeObjectURL(p.previewUrl));
            setPreviewFiles([]);
            await loadPhotos();
        } catch (err) {
            console.error('Upload error:', err);
            alert('Error al subir: ' + err.message);
        } finally {
            setUploading(false);
            setUploadProgress(0);
            setUploadStatus('');
        }
    };

    const cancelAllPreviews = () => {
        previewFiles.forEach(p => URL.revokeObjectURL(p.previewUrl));
        setPreviewFiles([]);
        setUploadDate('');
    };

    // ─── delete ────────────────────────────────────────────────────────────
    const handleDelete = async (photo) => {
        if (!confirm('¿Eliminar esta foto?')) return;
        try {
            await deletePhoto(photo.id);
            setModalPhoto(null);
            await loadPhotos();
        } catch (err) {
            console.error('Delete error:', err);
            alert('Error al eliminar: ' + err.message);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm(`¿Eliminar TODAS las ${photos.length} fotos? Esta acción NO se puede deshacer.`)) return;
        if (!confirm('¿Estás completamente seguro? Se borrarán TODAS las fotos.')) return;
        try {
            setLoading(true);
            const count = await deleteAllPhotos();
            alert(`✅ ${count} fotos eliminadas.`);
            await loadPhotos();
        } catch (err) {
            console.error('Delete all error:', err);
            alert('Error: ' + err.message);
            setLoading(false);
        }
    };

    // ─── compare ────────────────────────────────────────────────────────────
    const startCompare = () => {
        setCompareMode(true);
        setCompareA(null);
        setCompareB(null);
        setModalPhoto(null);
    };

    const handleCardClick = (photo) => {
        if (compareMode) {
            if (!compareA) {
                setCompareA(photo);
            } else if (!compareB && photo.id !== compareA.id) {
                const a = new Date(compareA.date);
                const b = new Date(photo.date);
                if (a <= b) setCompareB(photo);
                else { setCompareB(compareA); setCompareA(photo); }
            }
        } else {
            setModalPhoto(photo);
        }
    };

    const closeCompare = () => {
        setCompareMode(false);
        setCompareA(null);
        setCompareB(null);
    };

    // ─── helpers ────────────────────────────────────────────────────────────
    const fmtDate = (iso) => {
        try {
            return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return iso; }
    };

    const fmtDateLong = (iso) => {
        try {
            return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        } catch { return iso; }
    };

    const fmtTime = (iso) => {
        try {
            return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    // ─── render ─────────────────────────────────────────────────────────────
    return (
        <div className="photo-progress">
            <h1>📸 Progreso Visual</h1>
            <p className="photo-subtitle">Seguimiento fotográfico de tu evolución corporal</p>

            {/* ── Upload area ──────────────────────────────────────────── */}
            {previewFiles.length === 0 && (
                <div
                    className={`photo-upload-area ${dragging ? 'dragging' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="upload-icon">📷</div>
                    <p className="upload-text">
                        <strong>Toca aquí</strong> para elegir fotos<br />
                        Puedes seleccionar <strong>varias a la vez</strong>
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="upload-input"
                        onChange={handleFileChange}
                    />
                </div>
            )}

            {/* ── Multi-preview ────────────────────────────────────────── */}
            {previewFiles.length > 0 && (
                <div className="upload-preview-multi">
                    <div className="preview-header">
                        <h3>{previewFiles.length} foto{previewFiles.length !== 1 ? 's' : ''} seleccionada{previewFiles.length !== 1 ? 's' : ''}</h3>
                        {!uploading && (
                            <button className="btn-add-more" onClick={() => fileInputRef.current?.click()}>
                                + Añadir más
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="upload-input"
                            onChange={handleFileChange}
                        />
                    </div>

                    <div className="preview-grid">
                        {previewFiles.map((p, i) => (
                            <div key={i} className="preview-thumb">
                                <img src={p.previewUrl} alt={`Preview ${i + 1}`} />
                                {!uploading && (
                                    <button className="preview-remove" onClick={() => removePreview(i)}>✕</button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Date picker for upload */}
                    {!uploading && (
                        <div className="upload-date-picker">
                            <label>📅 Fecha de las fotos:</label>
                            <input
                                type="date"
                                value={uploadDate}
                                onChange={(e) => setUploadDate(e.target.value)}
                                className="date-input"
                            />
                            <span className="date-hint">
                                {uploadDate ? `Se usará: ${new Date(uploadDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Vacío = se intentará leer del archivo'}
                            </span>
                        </div>
                    )}

                    {uploading && (
                        <>
                            <div className="upload-progress-bar">
                                <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                            </div>
                            <p className="upload-status-text">{uploadStatus}</p>
                        </>
                    )}

                    <div className="preview-actions">
                        <button className="btn-upload" onClick={handleUploadAll} disabled={uploading}>
                            {uploading ? `⏳ ${uploadStatus}` : `✅ Subir ${previewFiles.length} foto${previewFiles.length !== 1 ? 's' : ''}`}
                        </button>
                        <button className="btn-cancel-upload" onClick={cancelAllPreviews} disabled={uploading}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* ── Compare slider ───────────────────────────────────────── */}
            {compareMode && (
                <div className="compare-container">
                    <div className="compare-header">
                        <h3>🔄 Comparador Antes / Después</h3>
                        <button className="btn-close-compare" onClick={closeCompare}>✕ Cerrar</button>
                    </div>
                    {!compareA && <p className="compare-hint">👆 Selecciona la foto <strong>ANTES</strong></p>}
                    {compareA && !compareB && <p className="compare-hint">👆 Ahora selecciona la foto <strong>DESPUÉS</strong></p>}
                    {compareA && compareB && (
                        <>
                            <div className="compare-dates">
                                <span className="compare-date-label before">← {fmtDate(compareA.date)}</span>
                                <span className="compare-date-label after">{fmtDate(compareB.date)} →</span>
                            </div>
                            <div className="compare-slider-wrapper">
                                <ReactCompareImage leftImage={compareA.url} rightImage={compareB.url} sliderLineColor="#667eea" sliderLineWidth={3} />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Gallery ──────────────────────────────────────────────── */}
            {loading ? (
                <div className="photo-loading">
                    <div className="spinner"></div>
                    <p>Cargando galería…</p>
                </div>
            ) : photos.length === 0 ? (
                <div className="gallery-empty">
                    <div className="gallery-empty-icon">🖼️</div>
                    <p>Aún no has subido ninguna foto.<br />¡Empieza a registrar tu evolución!</p>
                </div>
            ) : (
                <>
                    <div className="gallery-header">
                        <h2>🗂️ Tu Galería</h2>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                className="btn-modal-action"
                                onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                                title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
                            >
                                {sortOrder === 'desc' ? '📅 Recientes ↓' : '📅 Antiguas ↑'}
                            </button>
                            {!compareMode && (
                                <button className="btn-modal-action" onClick={startCompare} style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}>
                                    🔄 Comparar
                                </button>
                            )}
                            <button className="btn-modal-action danger" onClick={handleDeleteAll} style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}>
                                🗑️ Borrar todo
                            </button>
                            <span className="photo-count">{photos.length} foto{photos.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    {/* View mode switcher */}
                    <div className="view-mode-switcher">
                        <button className={`view-mode-btn ${viewMode === 'large' ? 'active' : ''}`} onClick={() => setViewMode('large')}>🖼️ Grande</button>
                        <button className={`view-mode-btn ${viewMode === 'small' ? 'active' : ''}`} onClick={() => setViewMode('small')}>🔲 Pequeño</button>
                        <button className={`view-mode-btn ${viewMode === 'details' ? 'active' : ''}`} onClick={() => setViewMode('details')}>📋 Detalles</button>
                    </div>

                    {/* Grid views */}
                    {viewMode !== 'details' && (
                        <div className={`photo-grid ${viewMode === 'small' ? 'photo-grid-small' : ''}`}>
                            {sortedPhotos.map(photo => (
                                <div key={photo.id} className={`photo-card ${compareMode && (compareA?.id === photo.id || compareB?.id === photo.id) ? 'selected-compare' : ''}`} onClick={() => handleCardClick(photo)}>
                                    <img src={photo.thumbUrl} alt={fmtDate(photo.date)} loading="lazy" />
                                    <div className="photo-card-date">{fmtDate(photo.date)}</div>
                                    {compareMode && compareA?.id === photo.id && <div className="photo-card-check">A</div>}
                                    {compareMode && compareB?.id === photo.id && <div className="photo-card-check">B</div>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Details view */}
                    {viewMode === 'details' && (
                        <div className="photo-details-list">
                            {sortedPhotos.map(photo => (
                                <div key={photo.id} className={`photo-detail-row ${compareMode && (compareA?.id === photo.id || compareB?.id === photo.id) ? 'selected-compare' : ''}`} onClick={() => handleCardClick(photo)}>
                                    <div className="detail-thumb-wrapper">
                                        <img src={photo.thumbUrl} alt={fmtDate(photo.date)} />
                                        {compareMode && compareA?.id === photo.id && <div className="photo-card-check">A</div>}
                                        {compareMode && compareB?.id === photo.id && <div className="photo-card-check">B</div>}
                                    </div>
                                    <div className="detail-info">
                                        <div className="detail-date">{fmtDateLong(photo.date)}</div>
                                        <div className="detail-time">{fmtTime(photo.date)}</div>
                                        {photo.notes && <div className="detail-notes">{photo.notes}</div>}
                                    </div>
                                    <button className="detail-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(photo); }} title="Eliminar">🗑️</button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ── Full-screen modal ────────────────────────────────────── */}
            {modalPhoto && (
                <div className="photo-modal-overlay" onClick={() => { setModalPhoto(null); setEditingDate(null); }}>
                    <button className="photo-modal-close" onClick={() => { setModalPhoto(null); setEditingDate(null); }}>✕</button>
                    <img src={modalPhoto.url} alt={fmtDate(modalPhoto.date)} className="photo-modal-image" onClick={(e) => e.stopPropagation()} />

                    {/* Date display / editor */}
                    <div className="photo-modal-date" onClick={(e) => e.stopPropagation()}>
                        {editingDate === modalPhoto.id ? (
                            <div className="date-editor">
                                <input
                                    type="date"
                                    value={editDateValue}
                                    className="date-input"
                                    onChange={(e) => setEditDateValue(e.target.value)}
                                />
                                <button className="date-save" onClick={saveEditDate}>✅ Guardar</button>
                                <button className="date-cancel" onClick={() => setEditingDate(null)}>Cancelar</button>
                            </div>
                        ) : (
                            <span>{fmtDateLong(modalPhoto.date)}</span>
                        )}
                    </div>

                    <div className="photo-modal-actions" onClick={(e) => e.stopPropagation()}>
                        {editingDate !== modalPhoto.id && (
                            <button className="btn-modal-action" onClick={() => startEditDate(modalPhoto)}>📅 Cambiar fecha</button>
                        )}
                        <button className="btn-modal-action" onClick={() => { setModalPhoto(null); startCompare(); setCompareA(modalPhoto); }}>🔄 Comparar</button>
                        <button className="btn-modal-action danger" onClick={() => handleDelete(modalPhoto)}>🗑️ Eliminar</button>
                    </div>
                </div>
            )}
        </div>
    );
}
