document.addEventListener('DOMContentLoaded', () => {
    const audioCtx = new AudioContext();
    let source;

    const ws = new WebSocket('ws://localhost:8888');
    ws.binaryType = 'arraybuffer';

    ws.onmessage = async function(event) {
        const audioData = event.data;
        audioCtx.decodeAudioData(audioData, (buffer) => {
            if (!source) {
                source = audioCtx.createBufferSource();
                source.buffer = buffer;

                const biquadFilter = audioCtx.createBiquadFilter();
                biquadFilter.type = 'bandpass';
                biquadFilter.frequency.value = 1700;
                biquadFilter.Q.value = 1;

                const noiseGate = audioCtx.createDynamicsCompressor();
                noiseGate.threshold.value = -50; // Adjust based on your noise floor
                noiseGate.knee.value = 0; // Hard knee
                noiseGate.ratio.value = 20;
                noiseGate.attack.value = 0;
                noiseGate.release.value = 0.1;

                source.connect(biquadFilter);
                biquadFilter.connect(noiseGate);
                noiseGate.connect(audioCtx.destination);
                source.start();
            }
        });
    };
});
