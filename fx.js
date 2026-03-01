/**
 * Cal-FX: Low-Latency Guitar Pedal
 * 
 * Implements a simple pitch shifter for the octave effect using AudioWorklet.
 */

let audioContext;
let inputNode;
let workletNode;
let outputNode;
let isBypass = true;

const startBtn = document.getElementById('start-btn');
const bypassBtn = document.getElementById('bypass-btn');
const statusLed = document.getElementById('status-led');
const pedalboard = document.getElementById('pedalboard');
const inputSelect = document.getElementById('input-select');
const outputSelect = document.getElementById('output-select');
const mixKnob = document.getElementById('mix-knob');
const octaveMode = document.getElementById('octave-mode');

// Get available audio devices
async function refreshDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    inputSelect.innerHTML = '';
    outputSelect.innerHTML = '';
    
    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `${device.kind} - ${device.deviceId.slice(0, 5)}`;
        
        if (device.kind === 'audioinput') {
            inputSelect.appendChild(option);
        } else if (device.kind === 'audiooutput') {
            outputSelect.appendChild(option);
        }
    });
}

// Ensure labels are available
navigator.mediaDevices.ondevicechange = refreshDevices;
refreshDevices();

async function initAudio() {
    if (audioContext) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive'
    });

    await audioContext.audioWorklet.addModule('pitch-shifter.js');

    workletNode = new AudioWorkletNode(audioContext, 'pitch-shifter-processor');
    
    // Initial parameters
    updatePedalParams();

    startBtn.textContent = 'Audio Engine Running';
    startBtn.disabled = true;
    pedalboard.classList.remove('disabled');

    setupStream();
}

async function setupStream() {
    if (inputNode) inputNode.disconnect();
    
    const constraints = {
        audio: {
            deviceId: inputSelect.value ? { exact: inputSelect.value } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            latency: 0
        }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        inputNode = audioContext.createMediaStreamSource(stream);
        
        // Output device selection (Chrome only for now)
        if (typeof audioContext.setSinkId === 'function') {
            await audioContext.setSinkId(outputSelect.value);
        }

        connectNodes();
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access microphone. Please ensure you have granted permission.');
    }
}

function connectNodes() {
    if (!inputNode || !workletNode) return;

    inputNode.disconnect();
    workletNode.disconnect();

    if (isBypass) {
        inputNode.connect(audioContext.destination);
    } else {
        inputNode.connect(workletNode);
        workletNode.connect(audioContext.destination);
    }
}

function updatePedalParams() {
    if (!workletNode) return;
    
    const mix = parseFloat(mixKnob.value);
    const octave = parseFloat(octaveMode.value);
    
    // Ratio: 0.5 for octave down, 2.0 for octave up
    const ratio = octave === -1 ? 0.5 : 2.0;

    workletNode.parameters.get('mix').setValueAtTime(mix, audioContext.currentTime);
    workletNode.parameters.get('ratio').setValueAtTime(ratio, audioContext.currentTime);
}

// Event Listeners
startBtn.addEventListener('click', () => {
    // Resume context if suspended (browser security policy)
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    initAudio();
});

bypassBtn.addEventListener('click', () => {
    isBypass = !isBypass;
    statusLed.classList.toggle('active', !isBypass);
    connectNodes();
});

mixKnob.addEventListener('input', updatePedalParams);
octaveMode.addEventListener('change', updatePedalParams);

inputSelect.addEventListener('change', setupStream);
outputSelect.addEventListener('change', async () => {
    if (audioContext && typeof audioContext.setSinkId === 'function') {
        await audioContext.setSinkId(outputSelect.value);
    }
});

// Trigger device permission prompt early to get labels
navigator.mediaDevices.getUserMedia({ audio: true }).then(refreshDevices).catch(console.error);
