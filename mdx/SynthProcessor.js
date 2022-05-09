
import Module from './mdx.wasm.js';
import WASMAudioBuffer from './util/WASMAudioBuffer.js';


// Web Audio API's render block size
const NUM_FRAMES = 128;

class SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Create an instance of Synthesizer and WASM memory helper. Then set up an
    // event handler for MIDI data from the main thread.
    this._synth = new Module.Synthesizer(sampleRate);

    this._outputBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 2, 2);
    this.port.onmessage = this.onMessage.bind(this);
  }

  process(inputs, outputs) {

    // Call the render function to fill the WASM buffer. Then clone the
    // rendered data to process() callback's output buffer.
    this._synth.render(this._outputBuffer.getPointer(), NUM_FRAMES);

    for (let i = 0; i < outputs[0].length; i++) {
      outputs[0][i].set(this._outputBuffer.getChannelData(i));
    }

    return true;
  }

  getReg(addr) {
    return this._synth.getReg(addr);
  }

  onMessage(event) {
    //    console.log(event);
    const data = event.data;
//    console.log(data);
    if ( data == "OPM" ) {
      var str = "";
      for (let y = 0; y < 16; ++y) {
        for (let x = 0; x < 16; ++x) {
          var s = this._synth.getReg(x + y * 16).toString(16).toUpperCase();
          if (s.length == 1) {
            s = "0" + s;
          }
          str += s + " ";
        }
        str += "<br>";
      }
    } else {

      var a1 = new Uint8Array(data);
      let pointer = Module._malloc(data.byteLength);
      Module.HEAPU8.set(a1, pointer);
      this._synth.loadMDX(pointer, data.byteLength);
      Module._free(pointer);
      a1 = null;
    }


    //    const isDown = event.data;
    //    isDown ? this._synth.noteOn(60) : this._synth.noteOff(60);
    this.port.postMessage(str);
  }
}

registerProcessor('wasm-synth', SynthProcessor);
