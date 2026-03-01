/**
 * Pitch Shifter AudioWorklet Processor
 * 
 * Implements a simple pitch shifter for the octave effect.
 */

class PitchShifterProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'ratio', defaultValue: 0.5, minValue: 0.25, maxValue: 4.0 },
            { name: 'mix', defaultValue: 0.5, minValue: 0, maxValue: 1.0 }
        ];
    }

    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.writePos = 0;
        this.readPos = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0][0];
        const output = outputs[0][0];
        
        if (!input || !output) return true;

        const ratio = parameters.ratio[0];
        const mix = parameters.mix[0];

        for (let i = 0; i < input.length; i++) {
            // Write input to circular buffer
            this.buffer[this.writePos] = input[i];

            // Simple delay-line based pitch shifting
            const sample = this.buffer[Math.floor(this.readPos)];
            
            output[i] = (input[i] * (1 - mix)) + (sample * mix);

            this.writePos = (this.writePos + 1) % this.bufferSize;
            this.readPos = (this.readPos + ratio) % this.bufferSize;
        }

        return true;
    }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
