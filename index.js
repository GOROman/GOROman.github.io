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
    this._synthNode = new AudioWorkletNode(this._context, 'wasm-synth');
    this._volumeNode = new GainNode(this._context, {gain: 1.0});
    this._synthNode.connect(this._volumeNode)
                   .connect(this._context.destination);

//                   var data = o.getReg(128);
  //                 console.log("test:"+data);
                 
                 const log = function(o){
                  var element = document.getElementById("opmreg");
                  var str = "";
                  for (let y=0;y<16;++y) {
                    for (let x=0;x<16;++x) {
                      str += (x+y*16).toString(16)+" ";
                    }
                    str += "<br>";
                  }
                  element.innerHTML = str;
//                   console.log(o._synthNode.getReg(40));
                 };
                 
                 setInterval(log, 500, this);
           

    if (!this._toggleState) this._context.suspend();
  }

  _handleToggle() {
    this._toggleState = !this._toggleState;
    if (this._toggleState) {
      this._context.resume();
      this._toggleButton.classList.replace('inactive', 'active');
    } else {
      this._context.suspend();
      this._toggleButton.classList.replace('active', 'inactive');
    }
  }

  _handleToneButton(isDown) {
    this._synthNode.port.postMessage(isDown);
  }

  onWindowLoad() {
    console.log("onWindowLoad!");
//    document.body.addEventListener('click', () => {
      this._initializeAudio();
      this._initializeView();
//    }, {once: true});
  }
}

const demoApp = new MDXPlayer();
window.addEventListener('load', () => demoApp.onWindowLoad());
