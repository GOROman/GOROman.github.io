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

    await this._context.audioWorklet.addModule('./SynthProcessor.js');
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
    this._toggleButton.innerHTML = 'STOP';

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
  onWindowLoad() {
    console.log("onWindowLoad!");
    this._initializeAudio();
    this._initializeView();


    const ddarea = document.getElementById("ddarea");
    // ドラッグされたデータが有効かどうかチェック
    const isValid = e => e.dataTransfer.types.indexOf("Files") >= 0;

    const ddEvent = {
      "dragover": e => {
        //      console.log("dragover!");
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

        console.log(files.length);
        //          tarea.value += `${files.length}のファイルがドロップされた。`;
        for (let file of files) {
          //            tarea.value +=  `name:${file.name} type:${file.type}`;
          console.log(file.type);
          console.log(file.name);

          const reader = new FileReader();
          reader.onload = (event) => {

            var data = event.target.result;
            console.log(data.length);
            console.log(data);
            this._synthNode.port.postMessage(data);

            const title = document.getElementById("title");
            title.innerHTML = file.name;

            this.play();

          }
          reader.readAsArrayBuffer(file);
//          reader.readAsDataURL(file);
        }

        //     ddarea.classList.remove("ddefect");
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
