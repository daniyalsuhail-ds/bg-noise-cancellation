const record = require('node-record-lpcm16');
const fs = require('fs');

// Define the file stream where the audio will be saved
const file = 'test.wav';
const fileStream = fs.createWriteStream(file, { encoding: 'binary' });

// Start recording audio
console.log('Recording...');
const recorder = record.start({
    sampleRate: 16000,
    channels: 1,
    verbose: true,
    recordProgram: 'sox',  // Ensure you have SoX installed and properly configured
    device: null           // Optionally specify the recording device
});

// Pipe the audio data to the file
recorder.pipe(fileStream);

fileStream.on('finish', () => {
    console.log('Recording finished.');
});

// Stop recording after 10 seconds
setTimeout(() => {
    console.log('Stopping recording...');
    record.stop();  // Stop the recording
}, 10000);
