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
  }

  async _initializeAudio() {
    this._context = new AudioContext({
      latencyHint: "interactive",
      sampleRate: 48000
    });

    await this._context.audioWorklet.addModule('./mdx.wasm.js');
    this._synthNode = new AudioWorkletNode(this._context, 'wasm-synth',
      {
        outputChannelCount: [2]
      }
    );

    this._synthNode.connect(this._context.destination);


    this._synthNode.port.onmessage = (event) => {
      // Handling data from the node.
      var element = document.getElementById("opmreg");
      element.innerHTML = event.data;
    };

    // OPMレジスタの更新
    const getopmreg = function (self) {
      self.port.postMessage("OPM");
    };
    setInterval(getopmreg, 16, this._synthNode);  // 16ms

    if (!this._toggleState) this._context.suspend();
  }

  play()
  {
    this._context.resume();
    this._toggleButton.classList.replace('inactive', 'active');
    this._toggleButton.innerHTML = 'PAUSE';

  }
  pause()
  {
    this._context.suspend();
    this._toggleButton.classList.replace('active', 'inactive');
    this._toggleButton.innerHTML = 'PLAY';

  }

  _handleToggle() {
    this._toggleState = !this._toggleState;
    if (this._toggleState) {
      this.play();
    } else {
      this.pause();
    }
  }

  _handleToneButton(isDown) {
    this._synthNode.port.postMessage(isDown);
  }

  onWindowPageShow() {
    console.log("onWindowPageShow!");

  }
  loadMDX( filename, data ) {
    this._synthNode.port.postMessage("MDX");
    this._synthNode.port.postMessage(data);

    document.getElementById("title").innerHTML = filename;
    document.getElementById("mdxfile").innerHTML = filename;
    this.play();

  }
  loadPDX( filename, data ) {
    this._synthNode.port.postMessage(filename);
    this._synthNode.port.postMessage(data);

    document.getElementById("pdxfile").innerHTML = filename;
  }

  onWindowLoad() {
    console.log("onWindowLoad!");
    this._initializeAudio();
    this._initializeView();

    const f = document.getElementById('mdxfile1');
    f.addEventListener('change', evt => {
      const input = evt.target;
      for (let i = 0; i < input.files.length; i++) {

        const reader = new FileReader();
        reader.onload = (event) => {

          var data = event.target.result;
          console.log(data.length);
          console.log(data);
          this.loadMDX(input.files[i].name, data)

        }
        console.log(input.files[i]);
        reader.readAsArrayBuffer(input.files[i]);

      }
    });

    const f2 = document.getElementById('pdxfile1');
    f2.addEventListener('change', evt => {
      const input = evt.target;
      for (let i = 0; i < input.files.length; i++) {

        const reader = new FileReader();
        reader.onload = (event) => {

          var data = event.target.result;
          
          this.loadPDX(input.files[i].name, data)


        }
        console.log(input.files[i]);
        reader.readAsArrayBuffer(input.files[i]);

      }
    });

    const ddarea = document.getElementById("ddarea");
    // ドラッグされたデータが有効かどうかチェック
    const isValid = e => e.dataTransfer.types.indexOf("Files") >= 0;

    const ddEvent = {
      "dragover": e => {
        e.preventDefault(); // 既定の処理をさせない
        e.stopPropagation(); // イベント伝播を止める
        if (!e.target.isEqualNode(ddarea)) {
          // ドロップエリア外ならドロップを無効にする
          e.dataTransfer.dropEffect = "none"; return;
        }
        // e.stopPropagation(); // イベント伝播を止める

        if (!isValid(e)) {
          // 無効なデータがドラッグされたらドロップを無効にする
          e.dataTransfer.dropEffect = "none"; return;
        }
        // ドロップのタイプを変更
        e.dataTransfer.dropEffect = "copy";
        //      ddarea.classList.add("ddefect");
      },
      "dragleave": e => {
        console.log("dragleave!");
        e.stopPropagation(); // イベント伝播を止める
        if (!e.target.isEqualNode(ddarea)) {
          return;
        }
        // e.stopPropagation(); // イベント伝播を止める
        //     ddarea.classList.remove("ddefect");
      },
      "drop": e => {
        console.log("drop!");
        e.preventDefault(); // 既定の処理をさせない
        e.stopPropagation(); // イベント伝播を止める

        const files = e.dataTransfer.files;
        console.log("Count:"+files.length);
        console.log("PDX");
        for (let file of files) {
          
          if ( file.name.match(/\.pdx$/i) ) {
              console.log("File:"+file.name);

            const reader1 = new FileReader();
            reader1.onload = (event) => {

              var data = event.target.result;
              if ( file.name.match(/\.pdx$/i) ) {
                this.loadPDX(file.name, data);
              }

            }
            reader1.readAsArrayBuffer(file);
          }
        }

        console.log("MDX");
        for (let file of files) {

          if ( file.name.match(/\.mdx$/i) ) {
          console.log("File:"+file.name);
              const reader2 = new FileReader();
            reader2.onload = (event) => {

                  var data = event.target.result;
                if ( file.name.match(/\.mdx$/i) ) {
                  this.loadMDX(file.name, data);
                }

            }
            reader2.readAsArrayBuffer(file);
          }
        }

      }
    };

    Object.keys(ddEvent).forEach(e => {
      // ddarea.addEventListener(e,ddEvent[e]);
      document.body.addEventListener(e, ddEvent[e], true)
    });


  }
}

const mdxplayer = new MDXPlayer();
window.addEventListener(
  'load', () => mdxplayer.onWindowLoad()
);
window.addEventListener(
  'pageshow', () => mdxplayer.onWindowPageShow()
);
window.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded!");
});
