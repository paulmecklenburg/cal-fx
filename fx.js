/**
 * Cal-FX: Low-Latency Guitar Pedal
 * 
 * Implements a multi-octave pedal using Tone.js.
 */

let inputNode;
let isBypass = true;
let octaveChain;
const octaveSettings = [
    { id: 'octave-m2', pitch: -24, shiftNode: null, gainNode: null },
    { id: 'octave-m1', pitch: -12, shiftNode: null, gainNode: null },
    { id: 'octave-0',  pitch: 0,   shiftNode: null, gainNode: null },
    { id: 'octave-p1', pitch: 12,  shiftNode: null, gainNode: null },
    { id: 'octave-p2', pitch: 24,  shiftNode: null, gainNode: null }
];

const startBtn = document.getElementById('start-btn');
const bypassBtn = document.getElementById('bypass-btn');
const statusLed = document.getElementById('status-led');
const pedalboard = document.getElementById('pedalboard');
const inputSelect = document.getElementById('input-select');
const outputSelect = document.getElementById('output-select');

// Get available audio devices
async function refreshDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Clear hardware devices but keep our test options
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

// Ensure labels are available
navigator.mediaDevices.ondevicechange = refreshDevices;
refreshDevices();

async function initAudio() {
    try {
        await Tone.start();
        console.log('Tone.js started');
        
        // Summary gain node
        octaveChain = new Tone.Gain(1).toDestination();

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
                // Dry signal doesn't need pitch shift, just a pass-through
                setting.shiftNode = new Tone.Gain(1);
            }
            
            setting.shiftNode.connect(setting.gainNode);
            setting.gainNode.connect(octaveChain);
        });

        isBypass = false;
        updateUI();
        await setupStream();
    } catch (err) {
        console.error('Failed to initialize audio:', err);
        alert('Could not start audio engine. Please ensure you have granted microphone permissions.');
    }
}

function updateUI() {
    if (isBypass) {
        statusLed.classList.remove('active');
        startBtn.textContent = 'Effect OFF';
    } else {
        statusLed.classList.add('active');
        startBtn.textContent = 'Effect ON';
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
        
        // Output device selection
        if (outputSelect.value && typeof Tone.getContext().setSinkId === 'function') {
            await Tone.getContext().setSinkId(outputSelect.value);
        }

        connectNodes();
    } catch (err) {
        console.error('Error accessing audio source:', err);
    }
}

function connectNodes() {
    if (!inputNode || !octaveChain) return;

    inputNode.disconnect();
    
    if (isBypass) {
        inputNode.connect(Tone.getDestination());
    } else {
        octaveSettings.forEach(setting => {
            if (setting.shiftNode) {
                inputNode.connect(setting.shiftNode);
            }
        });
    }
}

function updatePedalParams() {
    octaveSettings.forEach(setting => {
        if (setting.gainNode) {
            const slider = document.getElementById(setting.id);
            if (slider) {
                // Smoothly ramp to the new volume to avoid clicks
                setting.gainNode.gain.setTargetAtTime(parseFloat(slider.value), Tone.now(), 0.05);
            }
        }
    });
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    if (!octaveChain) {
        await initAudio();
    } else {
        isBypass = !isBypass;
        updateUI();
        connectNodes();
    }
});

bypassBtn.addEventListener('click', () => {
    if (octaveChain) {
        isBypass = !isBypass;
        updateUI();
        connectNodes();
    }
});

// Attach event listeners to all octave sliders
octaveSettings.forEach(setting => {
    const slider = document.getElementById(setting.id);
    if (slider) {
        slider.addEventListener('input', updatePedalParams);
    }
});

inputSelect.addEventListener('change', setupStream);
outputSelect.addEventListener('change', async () => {
    if (outputSelect.value && typeof Tone.getContext().setSinkId === 'function') {
        await Tone.getContext().setSinkId(outputSelect.value);
    }
});

// Trigger device permission prompt early to get labels
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(refreshDevices)
    .catch(err => {
        console.warn('Initial mic check failed - labels may be generic until Start Audio is clicked:', err);
    });
