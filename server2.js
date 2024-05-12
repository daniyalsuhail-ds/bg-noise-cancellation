const path = require("path");
const express = require("express");
const WebSocket = require("ws");
const fs = require("fs");


const WS_PORT = process.env.WS_PORT || 9000;
const HTTP_PORT = process.env.HTTP_PORT || 8000;

const app = express();
const wsServer = new WebSocket.Server({ port: WS_PORT }, () =>
  console.log(`WS server is listening at ws://localhost:${WS_PORT}`)
);

wsServer.on("connection", (ws, req) => {
  console.log("Connected");
  ws.binaryType = 'arraybuffer'; 
  
  let wavData = [];
  
  ws.on("message", (data) => {
    const buffer = Buffer.from(data);
    wavData.push(buffer);
  });

  // Check and save data every 10 seconds
  setInterval(() => {
    const totalBytes = wavData.reduce((acc, val) => acc + val.length, 0);
    const requiredBytes = 88200 * 20;  // 10 seconds of audio data at 44100 Hz, 16-bit, mono
    
    if (totalBytes >= requiredBytes) {
      const concatenatedData = Buffer.concat(wavData);
      const filename = `audio_${Date.now()}.wav`;
      const header = generateWavHeader(concatenatedData.length);
      const wavBuffer = Buffer.concat([header, concatenatedData]);
      fs.writeFileSync(path.join(__dirname, "temp", filename), wavBuffer);
      wavData = [];  // Clear the array after saving
    }
  }, 20000);  // Check every 10 seconds
});

// Generate WAV file header
function generateWavHeader(dataSize) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); // Chunk ID
  header.writeUInt32LE(36 + dataSize, 4); // Chunk size (file size - 8)
  header.write("WAVE", 8); // Format
  header.write("fmt ", 12); // Subchunk1 ID
  header.writeUInt32LE(16, 16); // Subchunk1 size (PCM)
  header.writeUInt16LE(1, 20); // Audio format (PCM)
  header.writeUInt16LE(1, 22); // Number of channels (Mono)
  header.writeUInt32LE(44100, 24); // Sample rate
  header.writeUInt32LE(44100 * 1 * 2, 28); // Byte rate (Sample rate * Number of channels * Bits per sample / 8)
  header.writeUInt16LE(1 * 2, 32); // Block align (Number of channels * Bits per sample / 8)
  header.writeUInt16LE(16, 34); // Bits per sample
  header.write("data", 36); // Subchunk2 ID
  header.writeUInt32LE(dataSize, 40); // Subchunk2 size (Data size)
  return header;
}

app.listen(HTTP_PORT, () =>
  console.log(`HTTP server listening at http://localhost:${HTTP_PORT}`)
);
