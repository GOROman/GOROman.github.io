/**
 * Copyright 2019 Google Inc. All Rights Reserved.
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


// Basic byte unit of WASM heap. (16 bit = 2 bytes)
const BYTES_PER_UNIT = Uint16Array.BYTES_PER_ELEMENT;

// Byte per audio sample. (32 bit float)
const BYTES_PER_SAMPLE = Float32Array.BYTES_PER_ELEMENT;

// The max audio channel on Chrome is 32.
const MAX_CHANNEL_COUNT = 32;

/**
 * A WASM HEAP wrapper for AudioBuffer class. This breaks down the AudioBuffer
 * into an Array of Float32Array for the convinient WASM opearion.
 *
 * @class
 * @dependency Module A WASM module generated by the emscripten glue code.
 */
class WASMAudioBuffer {
  /**
   * @constructor
   * @param  {object} wasmModule WASM module generated by Emscripten.
   * @param  {number} length Buffer frame length.
   * @param  {number} channelCount Number of channels.
   * @param  {number=} maxChannelCount Maximum number of channels.
   */
  constructor(wasmModule, length, channelCount, maxChannelCount) {
    // The |channelCount| must be greater than 0, and less than or equal to
    // the maximum channel count.
    this._isInitialized = false;
    this._module = wasmModule;
    this._length = length;
    this._maxChannelCount = maxChannelCount
        ? Math.min(maxChannelCount, MAX_CHANNEL_COUNT)
        : channelCount;
    this._channelCount = channelCount;
    this._allocateHeap();
    this._isInitialized = true;
  }

  /**
   * Allocates memory in the WASM heap and set up Float32Array views for the
   * channel data.
   *
   * @private
   */
  _allocateHeap() {
    const channelByteSize = this._length * BYTES_PER_SAMPLE;
    const dataByteSize = this._channelCount * channelByteSize;
    this._dataPtr = this._module._malloc(dataByteSize);
    this._channelData = [];
    for (let i = 0; i < this._channelCount; ++i) {
      let startByteOffset = this._dataPtr + i * channelByteSize;
      let endByteOffset = startByteOffset + channelByteSize;
      // Get the actual array index by dividing the byte offset by 2 bytes.
      this._channelData[i] =
          this._module.HEAPF32.subarray(startByteOffset >> BYTES_PER_UNIT,
                                        endByteOffset >> BYTES_PER_UNIT);
    }
  }

  /**
   * Adapt the current channel count to the new input buffer.
   *
   * @param  {number} newChannelCount The new channel count.
   */
  adaptChannel(newChannelCount) {
    if (newChannelCount < this._maxChannelCount) {
      this._channelCount = newChannelCount;
    }
  }

  /**
   * Getter for the buffer length in frames.
   *
   * @return {?number} Buffer length in frames.
   */
  get length() {
    return this._isInitialized ? this._length : null;
  }

  /**
   * Getter for the number of channels.
   *
   * @return {?number} Buffer length in frames.
   */
  get numberOfChannels() {
    return this._isInitialized ? this._channelCount : null;
  }

  /**
   * Getter for the maxixmum number of channels allowed for the instance.
   *
   * @return {?number} Buffer length in frames.
   */
  get maxChannelCount() {
    return this._isInitialized ? this._maxChannelCount : null;
  }

  /**
   * Returns a Float32Array object for a given channel index. If the channel
   * index is undefined, it returns the reference to the entire array of channel
   * data.
   *
   * @param  {number|undefined} channelIndex Channel index.
   * @return {?Array} a channel data array or an
   * array of channel data.
   */
  getChannelData(channelIndex) {
    if (channelIndex >= this._channelCount) {
      return null;
    }

    return typeof channelIndex === 'undefined'
        ? this._channelData : this._channelData[channelIndex];
  }

  getF32Array() {
    return this._channelData[0];
  }

  /**
   * Returns the base address of the allocated memory space in the WASM heap.
   *
   * @return {number} WASM Heap address.
   */
  getPointer() {
    return this._dataPtr;
  }

  /**
   * Frees the allocated memory space in the WASM heap.
   */
  free() {
    this._isInitialized = false;
    this._module._free(this._dataPtr);
    this._channelData = null;
  }
} // class WASMAudioBuffer

export default WASMAudioBuffer;
