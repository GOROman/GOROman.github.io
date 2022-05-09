/**
 * Copyright 2021 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class MDXPlayer {

  constructor() {
    this._container = null;
    this._toggleButton = null;
    this._toneButton = null;
    this._context = null;
    this._synthNode = null;
    this._volumeNode = null;
    this._toggleState = false;
  }

  _initializeView() {
    this._container = document.getElementById('demo-app');
    this._toggleButton = document.getElementById('audio-toggle');
    this._toggleButton.addEventListener(
      'mouseup', () => this._handleToggle());
    this._toneButton = document.getElementById('play-tone');
    this._toneButton.addEventListener(
      'mousedown', () => this._handleToneButton(true));
    this._toneButton.addEventListener(
      'mouseup', () => this._handleToneButton(false));

    this._toggleButton.disabled = false;
    this._toneButton.disabled = false;
    //    this._container.style.pointerEvents = 'auto';
    //    this._container.style.backgroundColor = '#D2E3FC';
  }

  async _initializeAudio() {
    this._context = new AudioContext({
      latencyHint: "interactive",
      sampleRate: 48000
    });
    await this._context.audioWorklet.addModule('./SynthProcessor.js');
    this._synthNode = new AudioWorkletNode(this._context, 'wasm-synth',
      { 
        outputChannelCount: [2]
      }
     );
//    this._volumeNode = new GainNode(this._context, { gain: 0.5, numberOfOutputs:2 });
//    this._synthNode.connect(this._volumeNode)
//      .connect(this._context.destination);
      this._synthNode.connect(this._context.destination);

      this._synthNode.port.onmessage = (event) => {
        // Handling data from the node.
        var element = document.getElementById("opmreg");
        element.innerHTML = event.data;
      };

    // OPMレジスタの更新
    const getopmreg = function (self) {
      self.port.postMessage(true);
    };
    setInterval(getopmreg, 16, this._synthNode);  // 16ms

//    if (!this._toggleState) this._context.suspend();
  }

  _handleToggle() {
    this._toggleState = !this._toggleState;
    if (this._toggleState) {
      this._context.resume();
      this._toggleButton.classList.replace('inactive', 'active');
      this._toggleButton.innerHTML = 'STOP';
    } else {
      this._context.suspend();
      this._toggleButton.classList.replace('active', 'inactive');
      this._toggleButton.innerHTML = 'PLAY';
    }
  }

  _handleToneButton(isDown) {
    this._synthNode.port.postMessage(isDown);
  }

  onWindowPageShow() {
    console.log("onWindowPageShow!");

  }
  onWindowLoad() {
    console.log("onWindowLoad!");
    this._initializeAudio();
    this._initializeView();
  }
}

const mdxplayer = new MDXPlayer();
window.addEventListener(
  'load', () => mdxplayer.onWindowLoad()
);
window.addEventListener(
  'pageshow', () => mdxplayer.onWindowPageShow()
);
