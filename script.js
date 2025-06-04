const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const transcriptionOutput = document.getElementById('transcriptionOutput');
const feedbackOutput = document.getElementById('feedbackOutput');
const statusMessage = document.getElementById('statusMessage');

let mediaRecorder;
let audioChunks = [];
let recognitionActive = false;

// Function to display status messages
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `message ${type}`;
    statusMessage.style.display = 'block';
}

// Function to hide status messages
function hideStatus() {
    statusMessage.style.display = 'none';
}

startButton.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recognitionActive = true;

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            recognitionActive = false;
            const audioBlob = new new Blob(audioChunks, { type: 'audio/webm' }); // Use webm for compatibility
            console.log('Audio recorded:', audioBlob);

            // Send the audio to the backend
            await sendAudioToBackend(audioBlob);

            // Stop the stream tracks after recording is complete
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        startButton.disabled = true;
        stopButton.disabled = false;
        transcriptionOutput.textContent = 'Recording... Speak now!';
        feedbackOutput.textContent = '';
        showStatus('Recording started. Speak clearly!', 'info');
        console.log('Recording started.');

    } catch (error) {
        console.error('Error accessing microphone:', error);
        showStatus('Error accessing microphone: ' + error.message, 'error');
        startButton.disabled = false;
        stopButton.disabled = true;
    }
});

stopButton.addEventListener('click', () => {
    if (mediaRecorder && recognitionActive) {
        mediaRecorder.stop();
        startButton.disabled = false;
        stopButton.disabled = true;
        showStatus('Processing audio...', 'info');
        console.log('Recording stopped. Sending audio to backend...');
    }
});

async function sendAudioToBackend(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm'); // Ensure the filename and content type are correct

    try {
        // Replace with your actual backend endpoint
        const response = await fetch('/transcribe-audio', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        console.log('Backend response:', data);

        if (data.transcription) {
            transcriptionOutput.textContent = data.transcription;
            showStatus('Transcription received!', 'info');
        } else {
            transcriptionOutput.textContent = 'No transcription received.';
        }

        // Displaying feedback - this is a placeholder.
        // Your backend would generate more sophisticated feedback.
        if (data.feedback) {
            feedbackOutput.textContent = data.feedback;
        } else if (data.transcription && data.transcription.trim() !== '') {
            feedbackOutput.textContent = 'Good attempt! Keep practicing.';
        } else {
            feedbackOutput.textContent = 'No clear speech detected or significant errors.';
        }

    } catch (error) {
        console.error('Error sending audio to backend:', error);
        showStatus('Error processing audio: ' + error.message, 'error');
        transcriptionOutput.textContent = 'Error: Could not transcribe audio.';
        feedbackOutput.textContent = 'Please try again. Ensure you speak clearly.';
    } finally {
        // Hide status message after 3 seconds, or clear it
        setTimeout(hideStatus, 3000);
    }
}
