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

async function processFile(filePath) {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            console.log(`Processing file: ${filePath}`);
            const fileId = await uploadAudio(filePath);
            console.log('Removing noise...');
            const jobId = await removeNoise(fileId);
            console.log('Checking status...');
            const downloadPath = await checkStatus(jobId);
            console.log('Downloading and playing...');
            downloadAndPlay(downloadPath);
            break; // If all operations succeed, break out of the loop
        } catch (error) {
            if (error.code === 'EBUSY') {
                console.error(`File is busy, retrying... [Attempt ${attempt + 1}/${maxRetries}]`);
                attempt++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before retrying
            } else {
                console.error('Error:', error);
                break; // If the error is not related to the file being busy, break out of the loop
            }
        }
    }
}


function watchFolder(folderPath) {
    console.log(`Watching for files in ${folderPath}...`);
    fs.watch(folderPath, { encoding: 'buffer' }, (eventType, filename) => {
        if (filename) {
            const filePath = path.join(folderPath, filename.toString());
            // Check if the file is added and not a temporary or system file
            if (eventType === 'rename' && fs.existsSync(filePath) && !filename.toString().startsWith('.')) {
                processFile(filePath);
            }
        }
    });
}

// Call watchFolder to start monitoring the temp folder
watchFolder(tempFolder);