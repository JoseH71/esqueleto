/**
 * Script to set CORS on Firebase Storage bucket.
 * Run once: node setup-cors.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// Initialize with default project
initializeApp({
    projectId: 'esqueleto-gym',
    storageBucket: 'esqueleto-gym.firebasestorage.app'
});

const bucket = getStorage().bucket();

const corsConfig = [
    {
        origin: ['*'],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
        maxAgeSeconds: 3600,
        responseHeader: [
            'Content-Type',
            'Authorization',
            'Content-Length',
            'User-Agent',
            'x-goog-resumable'
        ]
    }
];

async function setCors() {
    try {
        await bucket.setCorsConfiguration(corsConfig);
        console.log('✅ CORS set successfully on bucket:', bucket.name);
    } catch (err) {
        console.error('❌ Error setting CORS:', err.message);
        console.log('\nAlternative: Run this from Google Cloud Shell:');
        console.log('gsutil cors set cors.json gs://esqueleto-gym.firebasestorage.app');
    }
}

setCors();
