/**
 * PhotoService — Stores body progress photos directly in Firestore as base64.
 * Uses a GLOBAL collection (not per-user) so all devices see the same photos.
 * No Firebase Storage needed = no CORS issues.
 */
import { db } from '../firebase';
import {
    collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy
} from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';

// Global collection — shared across all devices (single user app)
const PHOTOS_COLLECTION = 'photos';

function photosCol() {
    return collection(db, PHOTOS_COLLECTION);
}

async function compressImage(file, maxWidth, quality = 0.8) {
    return imageCompression(file, {
        maxWidthOrHeight: maxWidth,
        useWebWorker: true,
        initialQuality: quality,
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Extract the real capture date from EXIF/IPTC/XMP metadata.
 * Tries all known date tags. Falls back to file.lastModified, then current date.
 */
async function getCaptureDate(file) {
    try {
        // Try full parse (all tags) for maximum date coverage
        const exif = await exifr.parse(file, true);
        if (exif) {
            console.log('[PhotoService] EXIF tags found:', Object.keys(exif).filter(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('time')));

            // Priority order of date tags
            const dateValue =
                exif.DateTimeOriginal ||    // Camera capture date (most reliable)
                exif.CreateDate ||           // Create date
                exif.DateTimeDigitized ||    // Digitized date
                exif.DateTime ||             // Generic date/time
                exif.ModifyDate ||           // File modify date from EXIF
                exif.GPSDateStamp ||         // GPS date
                exif.DateCreated;            // IPTC date created

            if (dateValue) {
                const d = new Date(dateValue);
                if (!isNaN(d.getTime())) {
                    console.log('[PhotoService] ✅ EXIF capture date:', d.toISOString());
                    return d;
                }
            }
            console.log('[PhotoService] ⚠️ EXIF found but no valid date tags');
        } else {
            console.log('[PhotoService] ⚠️ No EXIF data in file:', file.name);
        }
    } catch (e) {
        console.warn('[PhotoService] Could not read EXIF:', e.message);
    }

    // Fallback: use file's lastModified
    if (file.lastModified) {
        console.log('[PhotoService] Using file.lastModified:', new Date(file.lastModified));
        return new Date(file.lastModified);
    }

    console.log('[PhotoService] No date found, using now');
    return new Date();
}

// ─── upload ────────────────────────────────────────────────────────────────────

export async function uploadPhoto(file, notes = '', onProgress, overrideDate = null) {
    console.log('[PhotoService] Starting upload (global collection mode)');

    // Use override date if provided, otherwise try EXIF
    let captureDate;
    if (overrideDate) {
        captureDate = new Date(overrideDate);
        console.log('[PhotoService] Using manually set date:', captureDate.toISOString());
    } else {
        captureDate = await getCaptureDate(file);
    }
    console.log('[PhotoService] Photo capture date:', captureDate.toISOString());

    if (onProgress) onProgress(10);
    const fullFile = await compressImage(file, 1200, 0.7);
    console.log('[PhotoService] Full compressed:', (fullFile.size / 1024).toFixed(0), 'KB');
    if (onProgress) onProgress(30);

    const thumbFile = await compressImage(file, 300, 0.6);
    console.log('[PhotoService] Thumb compressed:', (thumbFile.size / 1024).toFixed(0), 'KB');
    if (onProgress) onProgress(50);

    const fullBase64 = await fileToBase64(fullFile);
    const thumbBase64 = await fileToBase64(thumbFile);
    if (onProgress) onProgress(70);

    console.log('[PhotoService] Saving to Firestore (global)...');
    const data = {
        url: fullBase64,
        thumbUrl: thumbBase64,
        date: captureDate.toISOString(),
        fileName: file.name,
        notes,
        createdAt: Date.now(),
    };

    const docRef = await addDoc(photosCol(), data);
    console.log('[PhotoService] ✅ Saved! Doc ID:', docRef.id);
    if (onProgress) onProgress(100);

    return { id: docRef.id, ...data };
}

// ─── list ──────────────────────────────────────────────────────────────────────

export async function listPhotos() {
    const q = query(photosCol(), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── update notes ──────────────────────────────────────────────────────────────

export async function updatePhotoNotes(photoId, notes) {
    const docRef = doc(db, PHOTOS_COLLECTION, photoId);
    await updateDoc(docRef, { notes });
}

export async function updatePhotoDate(photoId, newDate) {
    const docRef = doc(db, PHOTOS_COLLECTION, photoId);
    await updateDoc(docRef, { date: new Date(newDate).toISOString() });
}

// ─── delete ────────────────────────────────────────────────────────────────────

export async function deletePhoto(photoId) {
    await deleteDoc(doc(db, PHOTOS_COLLECTION, photoId));
}

export async function deleteAllPhotos() {
    const snap = await getDocs(photosCol());
    const promises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(promises);
    console.log('[PhotoService] ✅ All photos deleted:', snap.docs.length);
    return snap.docs.length;
}
