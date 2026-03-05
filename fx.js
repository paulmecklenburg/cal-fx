/**
 * Cal-FX: Low-Latency Guitar Pedalboard
 * 
 * Multi-effect board with Octave and Fuzz.
 */

let inputNode;
let isAudioStarted = false;

// Effect Nodes
let octaveChain;
let fuzzNode;
let fuzzGain;

// State
let isOctaveBypass = true;
let isFuzzBypass = true;

const octaveSettings = [
    { id: 'octave-m2', pitch: -24, shiftNode: null, gainNode: null },
    { id: 'octave-m1', pitch: -12, shiftNode: null, gainNode: null },
    { id: 'octave-0',  pitch: 0,   shiftNode: null, gainNode: null },
    { id: 'octave-p1', pitch: 12,  shiftNode: null, gainNode: null },
    { id: 'octave-p2', pitch: 24,  shiftNode: null, gainNode: null }
];

// UI Elements
const startBtn = document.getElementById('start-btn');
const inputSelect = document.getElementById('input-select');
const outputSelect = document.getElementById('output-select');
const pedalboard = document.getElementById('pedalboard');

const octaveBypassBtn = document.getElementById('octave-bypass-btn');
const octaveLed = document.getElementById('octave-led');

const fuzzBypassBtn = document.getElementById('fuzz-bypass-btn');
const fuzzLed = document.getElementById('fuzz-led');
const fuzzDriveSlider = document.getElementById('fuzz-drive');
const fuzzVolumeSlider = document.getElementById('fuzz-volume');

// Get available audio devices
async function refreshDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const testOption = inputSelect.querySelector('option[value="test-sine"]');
        inputSelect.innerHTML = '';
        if (testOption) inputSelect.appendChild(testOption);
        
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
    } catch (err) {
        console.error('Error refreshing devices:', err);
    }
}

navigator.mediaDevices.ondevicechange = refreshDevices;
refreshDevices();

async function initAudio() {
    try {
        await Tone.start();
        console.log('Tone.js started');
        
        // --- Octave Section ---
        octaveChain = new Tone.Gain(1);
        octaveSettings.forEach(setting => {
            setting.gainNode = new Tone.Gain(0);
            const slider = document.getElementById(setting.id);
            if (slider) {
                setting.gainNode.gain.value = parseFloat(slider.value);
            }

            if (setting.pitch !== 0) {
                setting.shiftNode = new Tone.PitchShift({
                    pitch: setting.pitch,
                    wet: 1
                });
            } else {
                setting.shiftNode = new Tone.Gain(1);
            }
            
            setting.shiftNode.connect(setting.gainNode);
            setting.gainNode.connect(octaveChain);
        });

        // --- Fuzz Section ---
        fuzzNode = new Tone.Distortion({
            distortion: parseFloat(fuzzDriveSlider.value),
            oversampling: "4x"
        });
        fuzzGain = new Tone.Gain(parseFloat(fuzzVolumeSlider.value));
        fuzzNode.connect(fuzzGain);

        // Chain effects in series: Octave -> Fuzz -> Destination
        // Connections are managed in connectNodes()
        
        isAudioStarted = true;
        isOctaveBypass = false;
        isFuzzBypass = false;
        
        updateUI();
        await setupStream();
    } catch (err) {
        console.error('Failed to initialize audio:', err);
        alert('Could not start audio engine.');
    }
}

function updateUI() {
    octaveLed.classList.toggle('active', !isOctaveBypass);
    fuzzLed.classList.toggle('active', !isFuzzBypass);
    
    if (isAudioStarted) {
        startBtn.textContent = 'Audio Started';
        pedalboard.classList.remove('disabled');
    }
}

async function setupStream() {
    if (inputNode) {
        inputNode.dispose();
    }
    
    try {
        if (inputSelect.value === 'test-sine') {
            inputNode = new Tone.Oscillator(440, "sine").start();
        } else {
            inputNode = new Tone.UserMedia();
            await inputNode.open(inputSelect.value);
        }
        
        if (outputSelect.value && typeof Tone.getContext().setSinkId === 'function') {
            await Tone.getContext().setSinkId(outputSelect.value);
        }

        connectNodes();
    } catch (err) {
        console.error('Error accessing audio source:', err);
    }
}

function connectNodes() {
    if (!inputNode || !octaveChain || !fuzzNode) return;

    inputNode.disconnect();
    octaveChain.disconnect();
    fuzzGain.disconnect();

    // Octave Pedal Path
    let octaveOut;
    if (isOctaveBypass) {
        // Simple passthrough
        octaveOut = inputNode;
    } else {
        octaveSettings.forEach(setting => {
            inputNode.connect(setting.shiftNode);
        });
        octaveOut = octaveChain;
    }

    // Fuzz Pedal Path
    let fuzzOut;
    if (isFuzzBypass) {
        fuzzOut = octaveOut;
    } else {
        octaveOut.connect(fuzzNode);
        fuzzOut = fuzzGain;
    }

    fuzzOut.toDestination();
}

function updateOctaveParams() {
    octaveSettings.forEach(setting => {
        if (setting.gainNode) {
            const slider = document.getElementById(setting.id);
            if (slider) {
                setting.gainNode.gain.setTargetAtTime(parseFloat(slider.value), Tone.now(), 0.05);
            }
        }
    });
}

function updateFuzzParams() {
    if (fuzzNode && fuzzGain) {
        fuzzNode.distortion = parseFloat(fuzzDriveSlider.value);
        fuzzGain.gain.setTargetAtTime(parseFloat(fuzzVolumeSlider.value), Tone.now(), 0.05);
    }
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    if (!isAudioStarted) {
        await initAudio();
    }
});

octaveBypassBtn.addEventListener('click', () => {
    if (isAudioStarted) {
        isOctaveBypass = !isOctaveBypass;
        updateUI();
        connectNodes();
    }
});

fuzzBypassBtn.addEventListener('click', () => {
    if (isAudioStarted) {
        isFuzzBypass = !isFuzzBypass;
        updateUI();
        connectNodes();
    }
});

octaveSettings.forEach(setting => {
    const slider = document.getElementById(setting.id);
    if (slider) slider.addEventListener('input', updateOctaveParams);
});

fuzzDriveSlider.addEventListener('input', updateFuzzParams);
fuzzVolumeSlider.addEventListener('input', updateFuzzParams);

inputSelect.addEventListener('change', setupStream);
outputSelect.addEventListener('change', async () => {
    if (outputSelect.value && typeof Tone.getContext().setSinkId === 'function') {
        await Tone.getContext().setSinkId(outputSelect.value);
    }
});

// Trigger device permission prompt early
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(refreshDevices)
    .catch(err => console.warn('Mic check failed:', err));
