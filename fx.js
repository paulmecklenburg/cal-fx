/**
 * Cal-FX: Low-Latency Guitar Pedalboard
 * 
 * Refactored into Pedal Classes.
 */

let inputNode;
let isAudioStarted = false;
let theremin, octave, fuzz;

// UI Elements for global controls
const startBtn = document.getElementById('start-btn');
const muteBtn = document.getElementById('mute-btn');
const inputSelect = document.getElementById('input-select');
const outputSelect = document.getElementById('output-select');
const pedalboard = document.getElementById('pedalboard');

// --- Theremin Pedal Class ---
class ThereminPedal {
    constructor() {
        this.isBypass = true;
        this.analyser = new Tone.Analyser("fft", 512);

        this.reverb = new Tone.Reverb({
            decay: 4,
            wet: 0.4
        });

        this.filter = new Tone.Filter(1200, "lowpass").connect(this.reverb);

        this.vibrato = new Tone.Vibrato({
            frequency: 6,
            depth: 0.3
        }).connect(this.filter);

        this.osc = new Tone.Oscillator({
            type: "triangle",
            frequency: 440,
            volume: -Infinity // Keep it silent until playing
        }).connect(this.vibrato);

        this.osc.start();
        this.output = this.reverb;

        // UI Elements
        this.sensSlider = document.getElementById('theremin-sens');
        this.glideSlider = document.getElementById('theremin-glide');
        this.bypassBtn = document.getElementById('theremin-bypass-btn');
        this.led = document.getElementById('theremin-led');

        this.bypassBtn.addEventListener('click', () => {
            this.isBypass = !this.isBypass;
            this.updateUI();
            connectNodes();
        });

        this.update();
    }

    updateUI() {
        this.led.classList.toggle('active', !this.isBypass);
        if (this.isBypass) {
            this.osc.volume.rampTo(-Infinity, 0.1);
        }
    }

    update() {
        if (!this.isBypass && this.analyser) {
            const buffer = this.analyser.getValue();

            let maxVal = -Infinity;
            let maxIndex = -1;
            for (let i = 0; i < buffer.length; i++) {
                if (buffer[i] > maxVal) {
                    maxVal = buffer[i];
                    maxIndex = i;
                }
            }

            const sensitivity = parseFloat(this.sensSlider.value);
            const glide = parseFloat(this.glideSlider.value);

            if (maxIndex !== -1 && maxVal > -100) {
                const frequency = (maxIndex / this.analyser.size) * Tone.getContext().sampleRate;
                let gain = Tone.dbToGain(maxVal + 30);
                let db = Tone.gainToDb(gain * sensitivity * 2);
                // console.log("freq: ", frequency, " db: ", db);

                if (frequency > 20 && frequency < 5000) {
                    this.osc.frequency.rampTo(frequency, glide);
                    this.osc.volume.rampTo(Math.min(db, 0), 0.05);
                } else {
                    this.osc.volume.rampTo(-Infinity, 0.1);
                }
            } else {
                this.osc.volume.rampTo(-Infinity, 0.1);
            }
        }
        requestAnimationFrame(() => this.update());
    }

    disconnect() {
        this.output.disconnect();
    }
}

// --- Octave Pedal Class ---
class OctavePedal {
    constructor() {
        this.isBypass = true;
        this.input = new Tone.Gain(1);
        this.output = new Tone.Gain(1);

        this.settings = [
            { id: 'octave-m2', pitch: -24 },
            { id: 'octave-m1', pitch: -12 },
            { id: 'octave-0', pitch: 0 },
            { id: 'octave-p1', pitch: 12 },
            { id: 'octave-p2', pitch: 24 }
        ];

        this.settings.forEach(setting => {
            setting.gainNode = new Tone.Gain(0);
            const slider = document.getElementById(setting.id);
            if (slider) {
                setting.gainNode.gain.value = parseFloat(slider.value);
                slider.addEventListener('input', () => {
                    setting.gainNode.gain.setTargetAtTime(parseFloat(slider.value), Tone.now(), 0.05);
                });
            }

            if (setting.pitch !== 0) {
                setting.shiftNode = new Tone.PitchShift({
                    pitch: setting.pitch,
                    wet: 1
                });
            } else {
                setting.shiftNode = new Tone.Gain(1);
            }

            this.input.connect(setting.shiftNode);
            setting.shiftNode.connect(setting.gainNode);
            setting.gainNode.connect(this.output);
        });

        this.bypassBtn = document.getElementById('octave-bypass-btn');
        this.led = document.getElementById('octave-led');

        this.bypassBtn.addEventListener('click', () => {
            this.isBypass = !this.isBypass;
            this.updateUI();
            connectNodes();
        });
    }

    updateUI() {
        this.led.classList.toggle('active', !this.isBypass);
    }

    disconnect() {
        this.output.disconnect();
    }
}

// --- Fuzz Pedal Class ---
class FuzzPedal {
    constructor() {
        this.isBypass = true;
        this.fuzzNode = new Tone.Distortion({
            distortion: 0.5,
            oversampling: "4x"
        });
        this.fuzzGain = new Tone.Gain(0.5);
        this.fuzzNode.connect(this.fuzzGain);

        this.input = this.fuzzNode;
        this.output = this.fuzzGain;

        this.driveSlider = document.getElementById('fuzz-drive');
        this.volumeSlider = document.getElementById('fuzz-volume');
        this.bypassBtn = document.getElementById('fuzz-bypass-btn');
        this.led = document.getElementById('fuzz-led');

        // Initialize values
        this.fuzzNode.distortion = parseFloat(this.driveSlider.value);
        this.fuzzGain.gain.value = parseFloat(this.volumeSlider.value);

        this.driveSlider.addEventListener('input', () => {
            this.fuzzNode.distortion = parseFloat(this.driveSlider.value);
        });
        this.volumeSlider.addEventListener('input', () => {
            this.fuzzGain.gain.setTargetAtTime(parseFloat(this.volumeSlider.value), Tone.now(), 0.05);
        });

        this.bypassBtn.addEventListener('click', () => {
            this.isBypass = !this.isBypass;
            this.updateUI();
            connectNodes();
        });
    }

    updateUI() {
        this.led.classList.toggle('active', !this.isBypass);
    }

    disconnect() {
        this.output.disconnect();
    }
}

// Get available audio devices
async function refreshDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const testOption = inputSelect.querySelector('option[value="test-wave"]');
        inputSelect.innerHTML = '';
        if (testOption) inputSelect.appendChild(testOption);
        outputSelect.innerHTML = '';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `${device.kind} - ${device.deviceId.slice(0, 5)}`;
            if (device.kind === 'audioinput') inputSelect.appendChild(option);
            else if (device.kind === 'audiooutput') outputSelect.appendChild(option);
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

        theremin = new ThereminPedal();
        octave = new OctavePedal();
        fuzz = new FuzzPedal();

        isAudioStarted = true;

        // Initial state: all pedals bypassed
        theremin.isBypass = true;
        octave.isBypass = true;
        fuzz.isBypass = true;

        theremin.updateUI();
        octave.updateUI();
        fuzz.updateUI();

        updateGlobalUI();
        await setupStream();
    } catch (err) {
        console.error('Failed to initialize audio:', err);
        alert('Could not start audio engine.');
    }
}

function updateGlobalUI() {
    if (isAudioStarted) {
        startBtn.textContent = 'Audio Started';
        pedalboard.classList.remove('disabled');
        muteBtn.disabled = false;
    }

    if (Tone.Destination.mute) {
        muteBtn.textContent = 'Unmute Audio';
        muteBtn.classList.add('muted');
    } else {
        muteBtn.textContent = 'Mute Audio';
        muteBtn.classList.remove('muted');
    }
}

function makeTestWave() {
    const testWave = new Tone.Oscillator({
        type: "triangle",
        frequency: 440,
        volume: -Infinity // Keep it silent until playing
    }).start();

    const surface = document.getElementById('pedalboard');
    surface.addEventListener('mousemove', (e) => {
        const freq = (e.clientX / window.innerWidth) * 1050 + 150;
        const vol = (1 - (e.clientY / window.innerHeight)) * 40 - 30;
        // Safety: Only ramp if the context is valid
        if (Tone.context.state === "running") {
            testWave.frequency.rampTo(freq, 0.1);
            testWave.volume.rampTo(vol, 0.05);
        }
    });

    surface.addEventListener('mouseleave', () => {
        testWave.volume.rampTo(-Infinity, 0.5);
    });
    return testWave;
}

async function setupStream() {
    if (inputNode) {
        inputNode.dispose();
    }

    try {
        if (inputSelect.value === 'test-wave') {
            inputNode = makeTestWave();
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
    if (!inputNode || !theremin || !octave || !fuzz) return;

    inputNode.disconnect();
    theremin.disconnect();
    octave.disconnect();
    fuzz.disconnect();

    let currentOut = inputNode;

    // Theremin Pedal
    if (!theremin.isBypass) {
        inputNode.connect(theremin.analyser);
        currentOut = theremin.output;
    }

    // Octave Pedal
    if (!octave.isBypass) {
        currentOut.connect(octave.input);
        currentOut = octave.output;
    }

    // Fuzz Pedal
    if (!fuzz.isBypass) {
        currentOut.connect(fuzz.input);
        currentOut = fuzz.output;
    }

    currentOut.toDestination();
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    if (!isAudioStarted) {
        await initAudio();
    }
});

muteBtn.addEventListener('click', () => {
    Tone.Destination.mute = !Tone.Destination.mute;
    updateGlobalUI();
});

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
