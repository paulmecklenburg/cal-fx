/**
 * Cal-FX: Low-Latency Guitar Pedal
 * 
 * Implements an octave effect using Tone.js.
 */

let inputNode;
let pitchShiftNode;
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
}

// Ensure labels are available
navigator.mediaDevices.ondevicechange = refreshDevices;
refreshDevices();

async function initAudio() {
    await Tone.start();
    
    // Create PitchShift node
    pitchShiftNode = new Tone.PitchShift({
        pitch: parseFloat(octaveMode.value) * 12,
        wet: parseFloat(mixKnob.value)
    }).toDestination();

    startBtn.textContent = 'Effect ON';
    isBypass = false;
    statusLed.classList.add('active');
    pedalboard.classList.remove('disabled');

    setupStream();
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
        if (typeof Tone.getContext().setSinkId === 'function') {
            await Tone.getContext().setSinkId(outputSelect.value);
        }

        connectNodes();
    } catch (err) {
        console.error('Error accessing audio source:', err);
        alert('Could not access audio source. Please ensure you have granted permission.');
    }
}

function connectNodes() {
    if (!inputNode || !pitchShiftNode) return;

    inputNode.disconnect();
    
    if (isBypass) {
        inputNode.connect(Tone.getDestination());
    } else {
        inputNode.connect(pitchShiftNode);
    }
}

function updatePedalParams() {
    if (!pitchShiftNode) return;
    
    const mix = parseFloat(mixKnob.value);
    const octave = parseFloat(octaveMode.value);
    
    // Tone.PitchShift uses semitones
    const pitch = octave * 12;

    pitchShiftNode.wet.value = mix;
    pitchShiftNode.pitch = pitch;
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    if (!pitchShiftNode) {
        await initAudio();
    } else {
        isBypass = !isBypass;
        statusLed.classList.toggle('active', !isBypass);
        startBtn.textContent = isBypass ? 'Effect OFF' : 'Effect ON';
        connectNodes();
    }
});

bypassBtn.addEventListener('click', () => {
    isBypass = !isBypass;
    statusLed.classList.toggle('active', !isBypass);
    startBtn.textContent = isBypass ? 'Effect OFF' : 'Effect ON';
    connectNodes();
});

mixKnob.addEventListener('input', updatePedalParams);
octaveMode.addEventListener('change', updatePedalParams);

inputSelect.addEventListener('change', setupStream);
outputSelect.addEventListener('change', async () => {
    if (typeof Tone.getContext().setSinkId === 'function') {
        await Tone.getContext().setSinkId(outputSelect.value);
    }
});

// Trigger device permission prompt early to get labels
navigator.mediaDevices.getUserMedia({ audio: true }).then(refreshDevices).catch(console.error);
