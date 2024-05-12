const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const tempFolder = 'temp/';
const downloadFolder = 'audio/';

if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder);
}

let audioQueue = [];
let isPlaying = false;

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
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

function downloadAndPlay(downloadPath) {
    const fileUrl = `https://api.audo.ai/v1/${downloadPath}`;
    const fileName = path.basename(downloadPath);
    const filePath = path.join(downloadFolder, fileName);

    axios({ url: fileUrl, method: 'GET', responseType: 'stream' })
        .then(response => {
            response.data.pipe(fs.createWriteStream(filePath))
                .on('finish', () => {
                    console.log(`Downloaded and ready to play: ${filePath}`);
                    queueAudio(filePath);
                });
        });
}

function queueAudio(filePath) {
    audioQueue.push(filePath);
    if (!isPlaying) {
        playNextAudio();
    }
}

function playNextAudio() {
    if (audioQueue.length > 0 && !isPlaying) {
        const filePath = audioQueue.shift();
        isPlaying = true;
        console.log(`Playing audio: ${filePath}`);
        exec(`ffplay -nodisp -autoexit "${filePath}"`, (error) => {
            if (error) {
                console.error(`Error playing ${filePath}: ${error}`);
            }
            console.log(`Finished playing: ${filePath}`);
            isPlaying = false;
            if (audioQueue.length > 0) {
                playNextAudio(); // Play next after current is finished
            }
        });
    }
}

function processAudioFiles() {
    console.log('Processing audio files...');
    fs.watch(tempFolder, { encoding: 'buffer' }, (eventType, filename) => {
        if (filename) {
            const filePath = path.join(tempFolder, filename.toString());
            if (eventType === 'rename' && fs.existsSync(filePath) && !filename.toString().startsWith('.')) {
                setTimeout(() => processFile(filePath), 1000); // Delay to avoid EBUSY errors
            }
        }
    });
}

async function processFile(filePath) {
    console.log(`Processing file: ${filePath}`);
    try {
        const fileId = await uploadAudio(filePath);
        console.log('Removing noise...');
        const jobId = await removeNoise(fileId);
        console.log('Checking status...');
        const downloadPath = await checkStatus(jobId);
        console.log('Downloading and playing...');
        downloadAndPlay(downloadPath);
    } catch (error) {
        console.error('Error:', error);
    }
}

processAudioFiles();
