const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const tempFolder = 'temp/'; // Set the correct path to your temp folder

async function uploadAudio(filePath) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    const headers = {
        'x-api-key': '427e4937dad722c624df98ff56d53da1',
        ...formData.getHeaders()
    };
    const response = await axios.post('https://api.audo.ai/v1/upload', formData, { headers });
    return response.data.fileId;
}

async function removeNoise(fileId) {
    const headers = {
        'x-api-key': '427e4937dad722c624df98ff56d53da1',
        'Content-Type': 'application/json'
    };
    const response = await axios.post('https://api.audo.ai/v1/remove-noise', { input: fileId }, { headers });
    return response.data.jobId;
}

async function checkStatus(jobId) {
    const headers = {
        'x-api-key': '427e4937dad722c624df98ff56d53da1'
    };
    while (true) {
        const response = await axios.get(`https://api.audo.ai/v1/remove-noise/${jobId}/status`, { headers });
        const { state, downloadPath } = response.data;
        if (state === 'succeeded') {
            return downloadPath;
        } else if (state === 'failed') {
            throw new Error(`Noise removal failed: ${response.data.reason}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
    }
}

function downloadAndPlay(downloadPath) {
    const fileUrl = `https://api.audo.ai/v1/${downloadPath}`;
    const filePath = './cleaned_audio.wav';
    axios({ url: fileUrl, method: 'GET', responseType: 'stream' })
        .then(response => {
            response.data.pipe(fs.createWriteStream(filePath))
                .on('finish', () => {
                    console.log('Playing cleaned audio...');
                    exec(`start ${filePath}`); // Ensure you have the 'exec' function required from 'child_process'
                });
        });
}

async function processAudioFiles() {
    console.log('Processing audio files...');
    try {
        const files = fs.readdirSync(tempFolder);
        for (const file of files) {
            const filePath = path.join(tempFolder, file);
            console.log(`Processing file: ${file}`);
            const fileId = await uploadAudio(filePath);
            console.log('Removing noise...');
            const jobId = await removeNoise(fileId);
            console.log('Checking status...');
            const downloadPath = await checkStatus(jobId);
            console.log('Downloading and playing...');
            downloadAndPlay(downloadPath);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

processAudioFiles();
