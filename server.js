require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const multer = require('multer');
const { SpeechClient } = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000; // Or any port you prefer

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Google Cloud Speech-to-Text client
// Ensure GOOGLE_APPLICATION_CREDENTIALS is set as an environment variable
// pointing to your service account key file, or you can pass the keyfile directly:
// const client = new SpeechClient({
//   keyFilename: '/path/to/your/service-account-key.json'
// });
const client = new SpeechClient(); // It will automatically use GOOGLE_APPLICATION_CREDENTIALS

// Middleware to serve static files
// IMPORTANT: Adjust this path to point to the directory containing your index.html, style.css, and script.js
app.use(express.static(path.join(__dirname, 'public'))); // Assuming your frontend files are in a 'public' folder

// Endpoint for audio transcription
app.post('/transcribe-audio', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    const audioBuffer = req.file.buffer; // The audio data from multer

    // Google Cloud Speech-to-Text configuration
    const config = {
        encoding: 'WEBM_OPUS', // Or LINEAR16, FLAC, etc., depending on your frontend's output. WebM typically uses OPUS.
        sampleRateHertz: 48000, // Adjust if your browser records at a different rate
        languageCode: 'en-US', // Or 'en-GB', 'en-AU', etc.
        enableWordConfidence: true, // Get confidence scores for words
        enableAutomaticPunctuation: true,
        model: 'default' // Or 'video', 'phone_call', 'command_and_search' for specific use cases
    };

    const audio = {
        content: audioBuffer.toString('base64'), // Send audio as base64 encoded string
    };

    const request = {
        config: config,
        audio: audio,
    };

    console.log('Sending audio to Google STT...');

    try {
        const [response] = await client.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        let feedback = '';
        let totalConfidence = 0;
        let wordCount = 0;

        if (response.results && response.results.length > 0) {
            const words = response.results[0].alternatives[0].words;
            if (words && words.length > 0) {
                words.forEach(word => {
                    totalConfidence += word.confidence;
                    wordCount++;
                });
                const averageConfidence = totalConfidence / wordCount;

                feedback += `Transcription Confidence (Average): ${averageConfidence.toFixed(2)}\n\n`;
                feedback += 'Word-level Confidence:\n';

                words.forEach(word => {
                    // You can set thresholds here for "poor pronunciation"
                    const confidence = word.confidence;
                    feedback += `"${word.word}": ${confidence.toFixed(2)} ${confidence < 0.7 ? '(Needs practice!)' : ''}\n`;
                });

                if (averageConfidence < 0.7) {
                    feedback = `Overall: Your pronunciation could use some improvement. Try to enunciate more clearly.\n\n` + feedback;
                } else if (averageConfidence >= 0.7 && averageConfidence < 0.9) {
                    feedback = `Overall: Good job! You're doing well, but there's always room for refinement.\n\n` + feedback;
                } else {
                    feedback = `Overall: Excellent pronunciation! Keep up the great work.\n\n` + feedback;
                }

            } else {
                feedback = 'No word-level confidence available. Speak more clearly.';
            }
        } else {
            feedback = 'No speech detected or unclear audio. Please try again.';
        }


        res.json({ transcription, feedback });

    } catch (error) {
        console.error('ERROR:', error);
        res.status(500).json({ error: 'Could not process audio. ' + error.message });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log(`Ensure GOOGLE_APPLICATION_CREDENTIALS environment variable is set.`);
});
