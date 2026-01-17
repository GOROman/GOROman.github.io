/**
 * WASM MDX Player - MMDSP Style UI
 * Copyright 2022-2025 GOROman
 */

// ========================================
// Keyboard Visualizer (MMDSP Style - Piano Keys)
// ========================================
class KeyboardVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.numFmChannels = 8;
    this.numPcmChannels = 8;
    this.numOctaves = 8;
    this.channelHeight = 22;

    // MMDSP colors
    this.colors = {
      bg: '#000010',
      whiteKey: '#303060',     // White keys (dark blue-gray)
      blackKey: '#101030',     // Black keys (very dark)
      keyBorder: '#404080',    // Key border
      keyOn: '#e0e0ff',        // Key-on white/light blue
      keyOnMidi: '#ffff80',    // MIDI key-on yellow
      text: '#6080c0',         // Label text
      textDim: '#304080',      // Dim text
      textBright: '#80a0ff',   // Bright text
      textMidi: '#ffff00',     // MIDI label yellow
      regText: '#5070b0'       // Register text
    };

    // MIDI state (received from worklet)
    this.midiChannelActive = 0;
    this.midiKeyState = new Array(8).fill(null).map(() => ({ keyOn: false, note: 0 }));

    // OPM register cache for display
    this.opmRegs = new Array(256).fill(0);

    // Mute state for each channel (FM 0-7, PCM 0-7)
    this.muteState = {
      fm: new Array(8).fill(false),
      pcm: new Array(8).fill(false)
    };

    // Callback for mute toggle
    this.onMuteToggle = null;

    // Label width for click detection
    this.labelWidth = 32;
  }

  // Get channel from click position
  getChannelFromPosition(x, y) {
    // Check if click is in label area (left side)
    if (x > this.labelWidth) return null;

    // Check FM channels (0-7)
    for (let ch = 0; ch < this.numFmChannels; ch++) {
      const chY = ch * this.channelHeight;
      if (y >= chY && y < chY + this.channelHeight) {
        return { type: 'fm', channel: ch };
      }
    }

    // Check PCM channels (8-15)
    const pcmStartY = this.numFmChannels * this.channelHeight + 4;
    for (let ch = 0; ch < this.numPcmChannels; ch++) {
      const chY = pcmStartY + ch * this.channelHeight;
      if (y >= chY && y < chY + this.channelHeight) {
        return { type: 'pcm', channel: ch };
      }
    }

    return null;
  }

  // Toggle mute state for a channel
  toggleMute(type, channel) {
    if (type === 'fm' && channel >= 0 && channel < 8) {
      this.muteState.fm[channel] = !this.muteState.fm[channel];
      return this.muteState.fm[channel];
    } else if (type === 'pcm' && channel >= 0 && channel < 8) {
      this.muteState.pcm[channel] = !this.muteState.pcm[channel];
      return this.muteState.pcm[channel];
    }
    return false;
  }

  // Check if a channel is muted
  isMuted(type, channel) {
    if (type === 'fm') return this.muteState.fm[channel] || false;
    if (type === 'pcm') return this.muteState.pcm[channel] || false;
    return false;
  }

  noteToKeyIndex(note) {
    // Convert MDX note value to key index (0-95 for 8 octaves)
    return Math.floor((note + 27) / 64);
  }

  // Draw piano keyboard (white and black keys)
  drawKeyboard(x, y, width, height, activeKey, volume, isPcm = false, isMuted = false, isMidi = false) {
    const ctx = this.ctx;
    const octaveWidth = width / this.numOctaves;
    const whiteKeyWidth = octaveWidth / 7; // 7 white keys per octave

    // Muted colors (much darker)
    const mutedWhiteKey = '#181830';
    const mutedBlackKey = '#080818';
    const mutedBorder = '#202040';

    // Background
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(x, y, width, height);

    // Draw white keys first
    let keyIndex = 0;
    for (let oct = 0; oct < this.numOctaves; oct++) {
      for (let wk = 0; wk < 7; wk++) {
        const kx = x + oct * octaveWidth + wk * whiteKeyWidth;

        // Check if this white key is active
        // MIDI keys light up even when muted
        const noteInOctave = [0, 2, 4, 5, 7, 9, 11][wk];
        const currentKeyIndex = oct * 12 + noteInOctave;
        const isActive = activeKey === currentKeyIndex && (!isMuted || isMidi);

        if (isActive) {
          const brightness = Math.min(255, 180 + Math.floor((volume / 255) * 75));
          if (isMidi) {
            // Yellow for MIDI - keep blue low to stay yellow (not white)
            const yellowBlue = Math.min(80, Math.floor((volume / 255) * 80));
            ctx.fillStyle = `rgb(255, 255, ${yellowBlue})`;
          } else if (isPcm) {
            ctx.fillStyle = `rgb(${brightness}, 255, ${brightness})`; // Green for PCM
          } else {
            ctx.fillStyle = `rgb(${brightness}, ${brightness}, 255)`; // Blue for FM
          }
        } else {
          ctx.fillStyle = isMuted ? mutedWhiteKey : this.colors.whiteKey;
        }

        ctx.fillRect(kx, y, whiteKeyWidth - 1, height);

        // Key border
        ctx.strokeStyle = isMuted ? mutedBorder : this.colors.keyBorder;
        ctx.strokeRect(kx, y, whiteKeyWidth - 1, height);
      }
    }

    // Draw black keys on top
    const blackKeyWidth = whiteKeyWidth * 0.6;
    const blackKeyHeight = height * 0.6;
    const blackKeyPattern = [1, 1, 0, 1, 1, 1, 0]; // C#, D#, skip, F#, G#, A#, skip

    for (let oct = 0; oct < this.numOctaves; oct++) {
      for (let wk = 0; wk < 7; wk++) {
        if (blackKeyPattern[wk] === 0) continue;

        const kx = x + oct * octaveWidth + (wk + 1) * whiteKeyWidth - blackKeyWidth / 2;

        // Black key note indices: 1, 3, 6, 8, 10
        const blackNoteIndices = [1, 3, null, 6, 8, 10, null];
        const noteIndex = blackNoteIndices[wk];
        if (noteIndex === null) continue;

        // MIDI keys light up even when muted
        const currentKeyIndex = oct * 12 + noteIndex;
        const isActive = activeKey === currentKeyIndex && (!isMuted || isMidi);

        if (isActive) {
          const brightness = Math.min(255, 180 + Math.floor((volume / 255) * 75));
          if (isMidi) {
            // Yellow for MIDI - keep blue low to stay yellow (not white)
            const yellowBlue = Math.min(80, Math.floor((volume / 255) * 80));
            ctx.fillStyle = `rgb(255, 255, ${yellowBlue})`;
          } else if (isPcm) {
            ctx.fillStyle = `rgb(${brightness}, 255, ${brightness})`; // Green for PCM
          } else {
            ctx.fillStyle = `rgb(${brightness}, ${brightness}, 255)`; // Blue for FM
          }
        } else {
          ctx.fillStyle = isMuted ? mutedBlackKey : this.colors.blackKey;
        }

        ctx.fillRect(kx, y, blackKeyWidth, blackKeyHeight);
      }
    }
  }

  render(channelData, opmRegs) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Update OPM registers if provided
    if (opmRegs) {
      this.opmRegs = opmRegs;
    }

    // Update MIDI state if provided
    if (channelData && channelData.midiChannelActive !== undefined) {
      this.midiChannelActive = channelData.midiChannelActive;
    }
    if (channelData && channelData.midiKeyState) {
      this.midiKeyState = channelData.midiKeyState;
    }

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, width, height);

    if (!channelData || !channelData.fm) return;

    const labelWidth = 32;
    const keyboardWidth = width - labelWidth - 10;
    const kbWidth = keyboardWidth - 130;
    const infoX = labelWidth + kbWidth + 5;

    // Draw FM channels
    for (let ch = 0; ch < this.numFmChannels; ch++) {
      const y = ch * this.channelHeight;
      const kbHeight = this.channelHeight - 2;
      const isMuted = this.muteState.fm[ch];

      // Check if this channel is MIDI-controlled
      const isMidiActive = (this.midiChannelActive & (1 << ch)) !== 0;
      const midiState = this.midiKeyState[ch];

      // Channel label (yellow if MIDI, dimmed if muted)
      if (isMidiActive) {
        ctx.fillStyle = this.colors.textMidi; // Yellow for MIDI
      } else if (isMuted) {
        ctx.fillStyle = '#303050';
      } else {
        ctx.fillStyle = this.colors.textBright;
      }
      ctx.font = "8px 'Share Tech Mono', monospace";
      ctx.fillText(`FM${ch + 1}`, 2, y + 12);

      // Get channel data - MIDI takes priority
      const fmCh = channelData.fm[ch];
      let activeKey = -1;
      let vol = 0;
      let isMidi = false;

      if (isMidiActive && midiState) {
        // MIDI mode - always show in yellow when MIDI signal received
        isMidi = true;
        if (midiState.keyOn) {
          // Key is pressed - show active key
          activeKey = Math.max(0, Math.min(95, midiState.note));
          vol = 255; // Full volume for MIDI (velocity ignored)
        }
        // When keyOn is false, activeKey stays -1 (no key lit) but isMidi is true
      } else if (fmCh && fmCh.keyOn) {
        // MDX is playing
        activeKey = this.noteToKeyIndex(fmCh.note);
        vol = fmCh.volume;
        if (vol & 0x80) {
          vol = (0x7F - (vol & 0x7F)) * 2;
        } else {
          vol = (vol & 0xF) * 0x11;
        }
      }

      // Draw keyboard with active key (pass mute state and MIDI flag)
      this.drawKeyboard(labelWidth, y + 1, kbWidth, kbHeight, activeKey, vol, false, isMuted, isMidi);

      // Get OPM registers for this channel
      const kc = this.opmRegs[0x28 + ch] || 0;
      const kf = this.opmRegs[0x30 + ch] || 0;
      const panFlCon = this.opmRegs[0x20 + ch] || 0;

      const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

      let noteName, noteOct, volStr, displayKc;

      if (isMidiActive && midiState) {
        // MIDI mode - show MIDI note info
        const midiNote = midiState.note;
        noteOct = Math.floor(midiNote / 12) - 1; // MIDI octave (C4 = note 60 = oct 4)
        noteName = noteNames[midiNote % 12] || '??';
        volStr = midiState.keyOn ? '255' : '  0';
        displayKc = kc; // Still show current OPM KC
      } else {
        // MDX mode - show OPM register info
        const kcOct = (kc >> 4) & 0x07;
        const kcNote = kc & 0x0F;
        // OPM note mapping: 0,1,2,4,5,6,8,9,10,12,13,14 -> C,C#,D,D#,E,F,F#,G,G#,A,A#,B
        const opmNoteMap = [0, 1, 2, 2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10, 10, 11];
        noteName = noteNames[opmNoteMap[kcNote] || 0] || '??';
        noteOct = kcOct;
        volStr = fmCh ? fmCh.volume.toString().padStart(3) : '  0';
        displayKc = kc;
      }

      const panR = (panFlCon >> 7) & 1;
      const panL = (panFlCon >> 6) & 1;
      const panStr = (panL ? 'L' : '-') + (panR ? 'R' : '-');

      // Info display (yellow if MIDI, dimmed if muted)
      if (isMuted) {
        ctx.fillStyle = '#303050';
      } else if (isMidiActive) {
        ctx.fillStyle = midiState && midiState.keyOn ? '#ffff80' : '#808000'; // Yellow for MIDI
      } else {
        ctx.fillStyle = fmCh && fmCh.keyOn ? '#e0e0ff' : this.colors.text;
      }
      ctx.font = "8px 'Share Tech Mono', monospace";
      ctx.fillText(`${noteName}${noteOct} V${volStr} ${panStr} KC${displayKc.toString(16).toUpperCase().padStart(2,'0')}`, infoX, y + 12);
    }

    // Draw PCM/ADPCM channels
    const pcmStartY = this.numFmChannels * this.channelHeight + 4;

    // Separator line
    ctx.strokeStyle = this.colors.keyBorder;
    ctx.beginPath();
    ctx.moveTo(0, pcmStartY - 2);
    ctx.lineTo(width, pcmStartY - 2);
    ctx.stroke();

    for (let ch = 0; ch < this.numPcmChannels; ch++) {
      const y = pcmStartY + ch * this.channelHeight;
      const kbHeight = this.channelHeight - 2;
      const isMuted = this.muteState.pcm[ch];

      // Channel label (dimmed if muted)
      ctx.fillStyle = isMuted ? '#304030' : '#80c080';
      ctx.font = "8px 'Share Tech Mono', monospace";
      ctx.fillText(`PCM${ch + 1}`, 2, y + 12);

      // Get PCM channel data
      const pcmCh = channelData.pcm ? channelData.pcm[ch] : null;
      let activeKey = -1;
      let vol = 0;

      if (pcmCh && pcmCh.keyOn) {
        activeKey = this.noteToKeyIndex(pcmCh.note);
        vol = pcmCh.volume;
        if (vol & 0x80) {
          vol = (0x7F - (vol & 0x7F)) * 2;
        } else {
          vol = (vol & 0xF) * 0x11;
        }
      }

      // Draw keyboard with active key (green tint for PCM, pass mute state)
      this.drawKeyboard(labelWidth, y + 1, kbWidth, kbHeight, activeKey, vol, true, isMuted);

      // Info display (dimmed if muted)
      if (isMuted) {
        ctx.fillStyle = '#304030';
      } else {
        ctx.fillStyle = pcmCh && pcmCh.keyOn ? '#c0ffc0' : '#608060';
      }
      ctx.font = "8px 'Share Tech Mono', monospace";
      const volStr = pcmCh ? pcmCh.volume.toString().padStart(3) : '  0';
      const noteVal = pcmCh ? pcmCh.note : 0;
      ctx.fillText(`N:${noteVal.toString().padStart(4)} V${volStr}`, infoX, y + 12);
    }
  }
}

// ========================================
// Level Meter (MMDSP Style - Segmented Lines with PANPOT)
// ========================================
class LevelMeter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.numChannels = 16; // FM 0-7 + PCM 0-7
    // simple_mdx_player style: 2-layer level meters
    this.keyOnLevel = new Array(16).fill(0);   // 明: 高速減衰 (31/32)
    this.keyOffLevel = new Array(16).fill(0);  // 暗: 低速減衰 (127/128)
    // Peak hold
    this.peakHold = new Array(16).fill(0);
    this.peakDecay = new Array(16).fill(0);
    this.opmRegs = new Array(256).fill(0);

    // Spectrum Analyzer style colors (blue gradient)
    this.colors = {
      bg: '#000010',
      // Same as SpectrumAnalyzer
      barLow: '#2060a0',
      barMid: '#40a0ff',
      barHigh: '#80ffff',
      barLowMuted: '#102030',
      barMidMuted: '#183050',
      barHighMuted: '#204060',
      peak: '#ffffff',
      peakMuted: '#404060',
      // MIDI: yellow
      barMidiLow: '#606000',
      barMidiMid: '#c0c000',
      barMidiHigh: '#ffff00',
      text: '#6080c0',
      textDim: '#304080',
      grid: '#101830',
      gridMuted: '#080818',
      label: '#5080c0',
      labelMuted: '#303050',
      panL: '#80c0ff',
      panR: '#80c0ff',
      panOff: '#303050'
    };

    this.segmentHeight = 3;
    this.segmentGap = 2;

    // Mute state for each FM channel (synced with KeyboardVisualizer)
    this.muteState = new Array(8).fill(false);
  }

  // Set mute state (called from outside to sync with KeyboardVisualizer)
  setMuteState(channel, muted) {
    if (channel >= 0 && channel < 8) {
      this.muteState[channel] = muted;
    }
  }

  decay() {
    // simple_mdx_player style decay
    for (let i = 0; i < 16; i++) {
      // keyOnLevel: fast decay (31/32)
      this.keyOnLevel[i] = Math.floor(this.keyOnLevel[i] * 31 / 32);
      // keyOffLevel: slow decay (127/128)
      this.keyOffLevel[i] = Math.floor(this.keyOffLevel[i] * 127 / 128);
      // Peak decay
      if (this.peakDecay[i] > 0) {
        this.peakDecay[i]--;
      } else {
        this.peakHold[i] = Math.max(0, this.peakHold[i] - 4);
      }
    }
    // Re-render with decayed values
    this.renderDecay();
  }

  hasActiveLevel() {
    for (let i = 0; i < 16; i++) {
      if (this.keyOnLevel[i] > 0 || this.keyOffLevel[i] > 0 || this.peakHold[i] > 0) return true;
    }
    return false;
  }

  renderDecay() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, width, height);

    const headerHeight = 15;
    const footerHeight = 28;
    const barWidth = 28;
    const barGap = 10;
    const startX = 20;
    const maxBarHeight = height - headerHeight - footerHeight;
    const barTop = headerHeight;
    const totalSegments = Math.floor(maxBarHeight / (this.segmentHeight + this.segmentGap));

    // Draw header labels
    ctx.fillStyle = this.colors.label;
    ctx.font = "9px 'Share Tech Mono', monospace";
    for (let ch = 0; ch < 8; ch++) {
      ctx.fillText(`${ch + 1}`, startX + ch * (barWidth + barGap) + barWidth / 2 - 3, 11);
    }

    // Draw each channel meter (simple_mdx_player style with gradient)
    for (let ch = 0; ch < 8; ch++) {
      const x = startX + ch * (barWidth + barGap);

      // Draw background grid
      ctx.fillStyle = this.colors.grid;
      for (let s = 0; s < totalSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (this.segmentHeight + this.segmentGap);
        ctx.fillRect(x, segY, barWidth, this.segmentHeight);
      }

      // Layer 1: KeyOff level (dimmed gradient, slow decay)
      const keyOffSegments = Math.floor((this.keyOffLevel[ch] / 255) * totalSegments);
      for (let s = 0; s < keyOffSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (this.segmentHeight + this.segmentGap);
        const ratio = s / totalSegments;
        ctx.fillStyle = ratio > 0.8 ? '#406080' : ratio > 0.5 ? '#305060' : '#203040';
        ctx.fillRect(x, segY, barWidth, this.segmentHeight);
      }

      // Layer 2: KeyOn level (bright gradient, fast decay)
      const keyOnSegments = Math.floor((this.keyOnLevel[ch] / 255) * totalSegments);
      for (let s = 0; s < keyOnSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (this.segmentHeight + this.segmentGap);
        const ratio = s / totalSegments;
        ctx.fillStyle = ratio > 0.8 ? this.colors.barHigh : ratio > 0.5 ? this.colors.barMid : this.colors.barLow;
        ctx.fillRect(x, segY, barWidth, this.segmentHeight);
      }

      // Peak indicator
      if (this.peakHold[ch] > 0) {
        const peakSegment = Math.floor((this.peakHold[ch] / 255) * totalSegments);
        if (peakSegment > 0) {
          const peakY = barTop + maxBarHeight - peakSegment * (this.segmentHeight + this.segmentGap);
          ctx.fillStyle = this.colors.peak;
          ctx.fillRect(x, peakY, barWidth, this.segmentHeight);
        }
      }
    }

    // Draw PANPOT footer (dimmed)
    const panY = height - footerHeight + 5;
    ctx.fillStyle = this.colors.textDim;
    ctx.font = "8px 'Share Tech Mono', monospace";
    ctx.fillText('PAN', 2, panY + 6);
    for (let ch = 0; ch < 8; ch++) {
      const x = startX + ch * (barWidth + barGap);
      const indicatorWidth = barWidth / 2 - 1;
      ctx.fillStyle = this.colors.panOff;
      ctx.fillRect(x, panY, indicatorWidth, 10);
      ctx.fillRect(x + indicatorWidth + 2, panY, indicatorWidth, 10);
      ctx.fillStyle = this.colors.textDim;
      ctx.font = "7px 'Share Tech Mono', monospace";
      ctx.fillText('L', x + 3, panY + 8);
      ctx.fillText('R', x + indicatorWidth + 5, panY + 8);
    }
  }

  normalizeVolume(volume) {
    if (volume & 0x80) {
      return (0x7F - (volume & 0x7F)) * 2;
    }
    return (volume & 0xF) * 0x11;
  }

  render(channelData, opmRegs) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Update OPM registers if provided
    if (opmRegs) {
      this.opmRegs = opmRegs;
    }

    // Update MIDI state if provided
    const midiChannelActive = channelData && channelData.midiChannelActive !== undefined
      ? channelData.midiChannelActive : 0;
    const midiKeyState = channelData && channelData.midiKeyState
      ? channelData.midiKeyState : [];

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, width, height);

    if (!channelData || !channelData.fm) return;

    const headerHeight = 15;
    const footerHeight = 28;
    const barWidth = 28;
    const barGap = 10;
    const startX = 20;
    const maxBarHeight = height - headerHeight - footerHeight;
    const barTop = headerHeight;

    // Calculate number of segments
    const totalSegments = Math.floor(maxBarHeight / (this.segmentHeight + this.segmentGap));

    // Draw header labels (dimmed for muted channels)
    ctx.font = "9px 'Share Tech Mono', monospace";
    for (let ch = 0; ch < 8; ch++) {
      ctx.fillStyle = this.muteState[ch] ? this.colors.labelMuted : this.colors.label;
      ctx.fillText(`${ch + 1}`, startX + ch * (barWidth + barGap) + barWidth / 2 - 3, 11);
    }

    // ========================================
    // FM channels (0-7) - simple_mdx_player style
    // ========================================
    for (let ch = 0; ch < 8; ch++) {
      const x = startX + ch * (barWidth + barGap);
      const fmCh = channelData.fm[ch];
      const isMuted = this.muteState[ch];

      // Check if MIDI is active on this channel
      const isMidiActive = (midiChannelActive & (1 << ch)) !== 0;
      const midiState = midiKeyState[ch];

      // Get volume (same as simple_mdx_player)
      let volume = 0;
      let isMidi = false;
      let currentKeyOn = false;
      let logicalSumOfKeyOn = false;

      if (isMidiActive && midiState && midiState.keyOn) {
        // MIDI key is on - full level (even when muted)
        volume = 255;
        isMidi = true;
        logicalSumOfKeyOn = true;
        currentKeyOn = true;
      } else if (fmCh && !isMuted) {
        // MDX level
        volume = this.normalizeVolume(fmCh.volume);
        currentKeyOn = fmCh.keyOn;
        logicalSumOfKeyOn = fmCh.logicalSumOfKeyOn;
      }

      // simple_mdx_player style level update
      // キーオフ中はkeyOffLevelを減衰
      if (!currentKeyOn) {
        this.keyOffLevel[ch] = Math.floor(this.keyOffLevel[ch] * 127 / 128);
      }
      // logicalSumOfKeyOnで両方のレベルを更新
      if (logicalSumOfKeyOn) {
        this.keyOnLevel[ch] = volume;
        this.keyOffLevel[ch] = volume;
      }
      // keyOnLevelは常に減衰 (31/32)
      this.keyOnLevel[ch] = Math.floor(this.keyOnLevel[ch] * 31 / 32);

      // Draw background grid (dimmed for muted channels)
      ctx.fillStyle = isMuted ? this.colors.gridMuted : this.colors.grid;
      for (let s = 0; s < totalSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (this.segmentHeight + this.segmentGap);
        ctx.fillRect(x, segY, barWidth, this.segmentHeight);
      }

      // Layer 1: KeyOff level (dimmed gradient, slow decay)
      const keyOffSegments = Math.floor((this.keyOffLevel[ch] / 255) * totalSegments);
      for (let s = 0; s < keyOffSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (this.segmentHeight + this.segmentGap);
        const ratio = s / totalSegments;
        if (isMidi) {
          ctx.fillStyle = ratio > 0.8 ? '#606020' : ratio > 0.5 ? '#505010' : '#404000';
        } else if (isMuted) {
          ctx.fillStyle = ratio > 0.8 ? this.colors.barHighMuted : ratio > 0.5 ? this.colors.barMidMuted : this.colors.barLowMuted;
        } else {
          ctx.fillStyle = ratio > 0.8 ? '#406080' : ratio > 0.5 ? '#305060' : '#203040';
        }
        ctx.fillRect(x, segY, barWidth, this.segmentHeight);
      }

      // Layer 2: KeyOn level (bright gradient, fast decay)
      const keyOnSegments = Math.floor((this.keyOnLevel[ch] / 255) * totalSegments);
      for (let s = 0; s < keyOnSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (this.segmentHeight + this.segmentGap);
        const ratio = s / totalSegments;
        if (isMidi) {
          ctx.fillStyle = ratio > 0.8 ? this.colors.barMidiHigh : ratio > 0.5 ? this.colors.barMidiMid : this.colors.barMidiLow;
        } else if (isMuted) {
          ctx.fillStyle = ratio > 0.8 ? this.colors.barHighMuted : ratio > 0.5 ? this.colors.barMidMuted : this.colors.barLowMuted;
        } else {
          ctx.fillStyle = ratio > 0.8 ? this.colors.barHigh : ratio > 0.5 ? this.colors.barMid : this.colors.barLow;
        }
        ctx.fillRect(x, segY, barWidth, this.segmentHeight);
      }

      // Peak hold tracking
      const currentMax = Math.max(this.keyOnLevel[ch], this.keyOffLevel[ch]);
      if (currentMax > this.peakHold[ch]) {
        this.peakHold[ch] = currentMax;
        this.peakDecay[ch] = 30; // Hold for 30 frames
      } else if (this.peakDecay[ch] > 0) {
        this.peakDecay[ch]--;
      } else {
        this.peakHold[ch] = Math.max(0, this.peakHold[ch] - 4);
      }

      // Draw peak indicator
      if (this.peakHold[ch] > 0) {
        const peakSegment = Math.floor((this.peakHold[ch] / 255) * totalSegments);
        if (peakSegment > 0) {
          const peakY = barTop + maxBarHeight - peakSegment * (this.segmentHeight + this.segmentGap);
          ctx.fillStyle = isMidi ? this.colors.barMidiHigh : (isMuted ? this.colors.peakMuted : this.colors.peak);
          ctx.fillRect(x, peakY, barWidth, this.segmentHeight);
        }
      }
    }

    // Draw PANPOT footer
    const panY = height - footerHeight + 5;
    ctx.fillStyle = this.colors.textDim;
    ctx.font = "8px 'Share Tech Mono', monospace";
    ctx.fillText('PAN', 2, panY + 6);

    for (let ch = 0; ch < 8; ch++) {
      const x = startX + ch * (barWidth + barGap);
      // Get PAN from OPM register 0x20+ch (bits 7-6)
      const panFlCon = this.opmRegs[0x20 + ch] || 0;
      const panR = (panFlCon >> 7) & 1; // Right enable
      const panL = (panFlCon >> 6) & 1; // Left enable

      // Draw L/R indicators
      const indicatorWidth = barWidth / 2 - 1;

      // Left indicator
      ctx.fillStyle = panL ? this.colors.panL : this.colors.panOff;
      ctx.fillRect(x, panY, indicatorWidth, 10);
      ctx.fillStyle = panL ? '#002040' : this.colors.textDim;
      ctx.font = "7px 'Share Tech Mono', monospace";
      ctx.fillText('L', x + 3, panY + 8);

      // Right indicator
      ctx.fillStyle = panR ? this.colors.panR : this.colors.panOff;
      ctx.fillRect(x + indicatorWidth + 2, panY, indicatorWidth, 10);
      ctx.fillStyle = panR ? '#002040' : this.colors.textDim;
      ctx.fillText('R', x + indicatorWidth + 5, panY + 8);
    }
  }
}

// ========================================
// Web MIDI Manager
// ========================================
class MIDIManager {
  constructor(mdxPlayer) {
    this._mdxPlayer = mdxPlayer;
    this._midiAccess = null;
    this._selectedInput = null;
    this._isEnabled = true;
    this._selectElement = null;
    this._labelElement = null;
    this._labelTimeout = null;

    // Direct MIDI state tracking for immediate display
    // (not waiting for worklet roundtrip)
    this._midiChannelActive = 0;  // Bitmask: which FM channels have received MIDI
    this._midiKeyState = new Array(8).fill(null).map(() => ({ keyOn: false, note: 0 }));
  }

  // Get current MIDI state for direct access by visualizer
  getMidiState() {
    return {
      midiChannelActive: this._midiChannelActive,
      midiKeyState: this._midiKeyState
    };
  }

  async init() {
    console.log('MIDIManager.init() called');

    // Get UI elements
    this._selectElement = document.getElementById('midi-input-select');
    if (this._selectElement) {
      this._selectElement.addEventListener('change', (e) => this._onSelectChange(e));
    }
    this._labelElement = document.querySelector('#midi-control .midi-label');

    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported in this browser');
      this._updateSelectDisabled('Web MIDI not supported');
      return false;
    }

    try {
      console.log('Requesting MIDI access...');
      this._midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      console.log('MIDI Access granted:', this._midiAccess);
      console.log('MIDI inputs:', this._midiAccess.inputs);
      console.log('MIDI inputs size:', this._midiAccess.inputs.size);

      // Log available inputs
      this._logInputs();

      // Auto-select first input device
      const inputs = Array.from(this._midiAccess.inputs.values());
      console.log('Input devices array:', inputs);

      if (inputs.length > 0) {
        // Select first device
        this.selectInput(inputs[0]);
        console.log('Auto-selected first MIDI device:', inputs[0].name);
      } else {
        console.log('No MIDI input devices found. Connect a device and it will be auto-selected.');
      }

      // Update select box with available devices (will show selected device)
      this._updateSelectOptions();

      // Monitor device connection/disconnection
      this._midiAccess.onstatechange = (e) => this._onStateChange(e);

      return true;
    } catch (err) {
      console.error('MIDI Access denied:', err);
      this._updateSelectDisabled('MIDI access denied');
      return false;
    }
  }

  _updateSelectOptions() {
    if (!this._selectElement || !this._midiAccess) return;

    // Remember current selection
    const currentValue = this._selectedInput ? this._selectedInput.id : '';

    // Clear existing options
    this._selectElement.innerHTML = '';

    // Add "No Device" option
    const noDeviceOption = document.createElement('option');
    noDeviceOption.value = '';
    noDeviceOption.textContent = '-- No Device --';
    this._selectElement.appendChild(noDeviceOption);

    // Add available input devices
    let firstDeviceId = null;
    this._midiAccess.inputs.forEach((input, id) => {
      if (!firstDeviceId) firstDeviceId = id;
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${input.name} (${input.manufacturer || 'Unknown'})`;
      this._selectElement.appendChild(option);
    });

    // Restore selection or select first device
    if (currentValue && this._midiAccess.inputs.has(currentValue)) {
      this._selectElement.value = currentValue;
    } else if (firstDeviceId) {
      this._selectElement.value = firstDeviceId;
    }
  }

  _updateSelectDisabled(message) {
    if (!this._selectElement) return;
    this._selectElement.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = message;
    this._selectElement.appendChild(option);
    this._selectElement.disabled = true;
  }

  _onSelectChange(event) {
    const selectedId = event.target.value;
    console.log('MIDI device selection changed:', selectedId);

    if (!selectedId) {
      // "No Device" selected - disconnect current input
      if (this._selectedInput) {
        this._selectedInput.onmidimessage = null;
        this._selectedInput = null;
        console.log('MIDI input disconnected');
      }
      return;
    }

    // Find and select the device
    const input = this._midiAccess.inputs.get(selectedId);
    if (input) {
      this.selectInput(input);
    }
  }

  _logInputs() {
    console.log('MIDI Input Devices:');
    if (this._midiAccess.inputs.size === 0) {
      console.log('  (No MIDI input devices found)');
    } else {
      this._midiAccess.inputs.forEach((input, id) => {
        console.log(`  [${id}] ${input.name} (${input.manufacturer})`);
      });
    }
  }

  selectInput(input) {
    console.log('selectInput called with:', input);

    // Remove listener from previous input
    if (this._selectedInput) {
      this._selectedInput.onmidimessage = null;
      console.log('Removed listener from previous input');
    }

    this._selectedInput = input;
    if (input) {
      console.log(`Setting onmidimessage handler for: ${input.name} (id: ${input.id})`);
      console.log('Input state:', input.state, 'connection:', input.connection);

      input.onmidimessage = (e) => this._onMIDIMessage(e);

      console.log(`MIDI Input selected: ${input.name}`);
      console.log('Handler set:', input.onmidimessage !== null);
    }
  }

  _onStateChange(e) {
    console.log(`MIDI Device ${e.port.type} "${e.port.name}": ${e.port.state}`);

    // Update select box when devices change
    this._updateSelectOptions();

    if (e.port.type === 'input') {
      if (e.port.state === 'connected') {
        // Auto-select if no device is currently selected
        if (!this._selectedInput) {
          this.selectInput(e.port);
          if (this._selectElement) {
            this._selectElement.value = e.port.id;
          }
        }
        this._logInputs();
      } else if (e.port.state === 'disconnected') {
        // If the disconnected device was selected, clear selection
        if (this._selectedInput && this._selectedInput.id === e.port.id) {
          this._selectedInput = null;
          if (this._selectElement) {
            this._selectElement.value = '';
          }
          console.log('Selected MIDI device disconnected');
        }
      }
    }
  }

  _onMIDIMessage(event) {
    if (!this._isEnabled) return;

    // Flash MIDI IN label
    if (this._labelElement) {
      this._labelElement.classList.add('active');
      if (this._labelTimeout) {
        clearTimeout(this._labelTimeout);
      }
      this._labelTimeout = setTimeout(() => {
        this._labelElement.classList.remove('active');
      }, 100);
    }

    const data = event.data;
    const status = data[0];
    const data1 = data[1];
    const data2 = data[2];

    // Build hex string for raw data
    const hexData = Array.from(data).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Decode message type for readable log
    let msgType = '';
    const channel = status & 0x0F;
    const command = status & 0xF0;

    // Channel messages (0x80-0xEF)
    if (status >= 0x80 && status <= 0xEF) {
      switch (command) {
        case 0x80: msgType = `Note Off ch=${channel} note=${data1} vel=${data2}`; break;
        case 0x90: msgType = `Note On ch=${channel} note=${data1} vel=${data2}`; break;
        case 0xA0: msgType = `Poly Aftertouch ch=${channel} note=${data1} pressure=${data2}`; break;
        case 0xB0: msgType = `CC ch=${channel} cc#${data1}=${data2}`; break;
        case 0xC0: msgType = `Program Change ch=${channel} prog=${data1}`; break;
        case 0xD0: msgType = `Channel Aftertouch ch=${channel} pressure=${data1}`; break;
        case 0xE0: msgType = `Pitch Bend ch=${channel} value=${(data2 << 7) | data1}`; break;
      }
    }
    // System messages (0xF0-0xFF)
    else if (status >= 0xF0) {
      switch (status) {
        case 0xF0: msgType = `SysEx Start (${data.length} bytes)`; break;
        case 0xF1: msgType = `MTC Quarter Frame`; break;
        case 0xF2: msgType = `Song Position ${(data2 << 7) | data1}`; break;
        case 0xF3: msgType = `Song Select ${data1}`; break;
        case 0xF6: msgType = `Tune Request`; break;
        case 0xF7: msgType = `SysEx End`; break;
        case 0xF8: msgType = `Timing Clock`; break;
        case 0xFA: msgType = `Start`; break;
        case 0xFB: msgType = `Continue`; break;
        case 0xFC: msgType = `Stop`; break;
        case 0xFE: msgType = `Active Sensing`; break;
        case 0xFF: msgType = `System Reset`; break;
        default: msgType = `System (${status.toString(16).toUpperCase()})`; break;
      }
    }

    // Console log output - all MIDI messages
    console.log(`MIDI In: [${hexData}] ${msgType}`);

    // Process Note On/Off for sound generation
    if (status >= 0x80 && status <= 0xEF) {
      const fmCh = channel % 8;  // Map MIDI channel to FM channel

      switch (command) {
        case 0x90: // Note On
          if (data2 > 0) {
            // Note On (velocity > 0) - velocity is ignored per spec
            // Update local state immediately for display
            this._midiChannelActive |= (1 << fmCh);
            this._midiKeyState[fmCh] = { keyOn: true, note: data1 };

            this._sendToWorklet({
              type: 'MIDI_KEY_ON',
              midiChannel: channel,
              note: data1
            });
          } else {
            // Note On with velocity 0 = Note Off
            // Only update if note matches
            if (this._midiKeyState[fmCh].note === data1) {
              this._midiKeyState[fmCh] = { keyOn: false, note: data1 };
            }

            this._sendToWorklet({
              type: 'MIDI_KEY_OFF',
              midiChannel: channel,
              note: data1
            });
          }
          break;

        case 0x80: // Note Off
          // Only update if note matches
          if (this._midiKeyState[fmCh].note === data1) {
            this._midiKeyState[fmCh] = { keyOn: false, note: data1 };
          }

          this._sendToWorklet({
            type: 'MIDI_KEY_OFF',
            midiChannel: channel,
            note: data1
          });
          break;
      }
    }
  }

  _sendToWorklet(msg) {
    if (this._mdxPlayer._synthNode) {
      this._mdxPlayer._synthNode.port.postMessage(JSON.stringify(msg));
    }
  }

  enable() {
    this._isEnabled = true;
    console.log('MIDI input enabled');
  }

  disable() {
    this._isEnabled = false;
    console.log('MIDI input disabled');
  }

  getInputs() {
    if (!this._midiAccess) return [];
    return Array.from(this._midiAccess.inputs.values());
  }
}

// ========================================
// OPM Register Visualizer
// ========================================
class OPMRegisterVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opmRegs = new Array(256).fill(0);

    // Colors
    this.colors = {
      bg: '#000010',
      text: '#6080c0',
      textDim: '#304080',
      textBright: '#80c0ff',
      textValue: '#4070b0',      // Blue for unchanged
      textChanged: '#e0e0ff',    // White for changed
      headerCol: '#4060a0',      // Dark blue for column header (横)
      headerRow: '#4060a0',      // Dark blue for row header (縦)
      grid: '#101830'
    };

    // Track changed registers
    this.prevRegs = new Array(256).fill(0);
    this.changedRegs = new Array(256).fill(0);
  }

  render(opmRegs) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Update registers
    if (opmRegs) {
      for (let i = 0; i < 256; i++) {
        if (opmRegs[i] !== this.prevRegs[i]) {
          this.changedRegs[i] = 10; // Highlight for 10 frames
          this.prevRegs[i] = opmRegs[i];
        } else if (this.changedRegs[i] > 0) {
          this.changedRegs[i]--;
        }
      }
      this.opmRegs = opmRegs;
    }

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, width, height);

    // Draw registers in 16x16 grid
    const cellWidth = 15;
    const cellHeight = 15;
    const startX = 2;
    const startY = 18;
    const dataStartX = startX + 18;

    // Header row - draw each column header at the same position as data (横)
    ctx.fillStyle = this.colors.headerCol;
    ctx.font = "10px 'Share Tech Mono', monospace";
    for (let col = 0; col < 16; col++) {
      const x = dataStartX + col * cellWidth;
      ctx.fillText(col.toString(16).toUpperCase().padStart(2, '0'), x, 11);
    }

    for (let row = 0; row < 16; row++) {
      // Row header (縦)
      ctx.fillStyle = this.colors.headerRow;
      ctx.font = "10px 'Share Tech Mono', monospace";
      ctx.fillText(row.toString(16).toUpperCase() + '0', startX, startY + row * cellHeight + 9);

      for (let col = 0; col < 16; col++) {
        const regAddr = row * 16 + col;
        const regValue = this.opmRegs[regAddr] || 0;
        const x = dataStartX + col * cellWidth;
        const y = startY + row * cellHeight;

        // Highlight changed registers
        if (this.changedRegs[regAddr] > 0) {
          ctx.fillStyle = this.colors.textChanged;
        } else {
          ctx.fillStyle = this.colors.textValue;
        }

        ctx.font = "10px 'Share Tech Mono', monospace";
        ctx.fillText(regValue.toString(16).toUpperCase().padStart(2, '0'), x, y + 9);
      }
    }

  }
}

// ========================================
// Spectrum Analyzer (MMDSP Style)
// ========================================
class SpectrumAnalyzer {
  constructor(canvas, audioContext) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioContext = audioContext;
    this.analyser = null;
    this.dataArray = null;
    this.peakHold = [];

    // MMDSP Colors
    this.colors = {
      bg: '#000008',
      barLow: '#2060a0',
      barMid: '#40a0ff',
      barHigh: '#80ffff',
      peak: '#ffffff',
      grid: '#101830'
    };
  }

  setup(sourceNode) {
    if (!this.audioContext || !sourceNode) return;

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.75;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    sourceNode.connect(this.analyser);

    // Initialize peak hold and decay values
    this.peakHold = new Array(64).fill(0);
    this.peakDecay = new Array(64).fill(0);
    this.decayValues = new Array(64).fill(0);
  }

  hasActiveLevel() {
    if (!this.decayValues || !this.peakHold) return false;
    for (let i = 0; i < this.decayValues.length; i++) {
      if (this.decayValues[i] > 0 || this.peakHold[i] > 0) return true;
    }
    return false;
  }

  decay() {
    if (!this.decayValues) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, width, height);

    const barCount = 48;
    const barWidth = 4;
    const barGap = 2;
    const startX = (width - barCount * (barWidth + barGap)) / 2;
    const maxHeight = height - 10;

    for (let i = 0; i < barCount; i++) {
      // Decay the values
      this.decayValues[i] = Math.max(0, this.decayValues[i] * 0.85 - 3);

      // Force decay peak hold immediately on stop
      this.peakDecay[i] = 0;
      this.peakHold[i] = Math.max(0, this.peakHold[i] * 0.9 - 4);

      const barHeight = (this.decayValues[i] / 255) * maxHeight;
      const x = startX + i * (barWidth + barGap);

      // Draw segmented bar
      if (barHeight > 0) {
        const segments = Math.ceil(barHeight / 4);
        for (let s = 0; s < segments; s++) {
          const segY = height - 5 - (s + 1) * 4;
          const ratio = s / (maxHeight / 4);
          if (ratio > 0.75) {
            ctx.fillStyle = this.colors.barHigh;
          } else if (ratio > 0.4) {
            ctx.fillStyle = this.colors.barMid;
          } else {
            ctx.fillStyle = this.colors.barLow;
          }
          ctx.fillRect(x, segY, barWidth, 3);
        }
      }

      // Draw peak
      if (this.peakHold[i] > 0) {
        const peakY = height - 5 - (this.peakHold[i] / 255) * maxHeight;
        ctx.fillStyle = this.colors.peak;
        ctx.fillRect(x, peakY - 1, barWidth, 2);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, width, height);

    if (!this.analyser || !this.dataArray) {
      // Draw placeholder grid
      ctx.strokeStyle = this.colors.grid;
      for (let i = 0; i < 64; i++) {
        const x = 5 + i * 5;
        ctx.beginPath();
        ctx.moveTo(x, 5);
        ctx.lineTo(x, height - 5);
        ctx.stroke();
      }
      ctx.fillStyle = '#304080';
      ctx.font = "10px 'Share Tech Mono', monospace";
      ctx.fillText('CLICK PLAY TO START', width / 2 - 70, height / 2);
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    const barCount = 48;
    const barWidth = 4;
    const barGap = 2;
    const startX = (width - barCount * (barWidth + barGap)) / 2;
    const maxHeight = height - 10;

    for (let i = 0; i < barCount; i++) {
      // Use logarithmic frequency distribution
      const binStart = Math.floor(Math.pow(i / barCount, 1.5) * this.dataArray.length);
      const binEnd = Math.floor(Math.pow((i + 1) / barCount, 1.5) * this.dataArray.length);
      let sum = 0;
      let count = 0;
      for (let j = binStart; j < binEnd && j < this.dataArray.length; j++) {
        sum += this.dataArray[j];
        count++;
      }
      const value = count > 0 ? sum / count : 0;

      // Store for decay
      if (this.decayValues) {
        this.decayValues[i] = value;
      }

      // Peak hold
      if (value > this.peakHold[i]) {
        this.peakHold[i] = value;
        this.peakDecay[i] = 30;
      } else if (this.peakDecay[i] > 0) {
        this.peakDecay[i]--;
      } else {
        this.peakHold[i] = Math.max(0, this.peakHold[i] - 3);
      }

      const barHeight = (value / 255) * maxHeight;
      const x = startX + i * (barWidth + barGap);
      const y = height - 5 - barHeight;

      // Draw segmented bar (MMDSP style)
      if (barHeight > 0) {
        const segments = Math.ceil(barHeight / 4);
        for (let s = 0; s < segments; s++) {
          const segY = height - 5 - (s + 1) * 4;
          const ratio = s / (maxHeight / 4);

          // Color gradient based on height
          if (ratio > 0.75) {
            ctx.fillStyle = this.colors.barHigh;
          } else if (ratio > 0.4) {
            ctx.fillStyle = this.colors.barMid;
          } else {
            ctx.fillStyle = this.colors.barLow;
          }
          ctx.fillRect(x, segY, barWidth, 3);
        }
      }

      // Draw peak indicator
      if (this.peakHold[i] > 0) {
        const peakY = height - 5 - (this.peakHold[i] / 255) * maxHeight;
        ctx.fillStyle = this.colors.peak;
        ctx.fillRect(x, peakY - 1, barWidth, 2);
      }
    }
  }
}

// ========================================
// Playlist Item
// ========================================
class PlaylistItem {
  constructor(mdxFilename, mdxData, pdxFilename = null, pdxData = null) {
    this.id = crypto.randomUUID();
    this.mdxFilename = mdxFilename;
    this.mdxData = mdxData;         // ArrayBuffer
    this.pdxFilename = pdxFilename;
    this.pdxData = pdxData;         // ArrayBuffer (optional)
    this.title = null;              // Loaded after playing
  }
}

// ========================================
// Playlist Manager
// ========================================
class Playlist {
  constructor() {
    this.items = [];
    this.currentIndex = -1;    // Selected index
    this.playingIndex = -1;    // Currently playing index
    this.isAutoPlay = true;    // Auto-play next song
  }

  add(item) {
    this.items.push(item);
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
    }
    return this.items.length - 1;
  }

  remove(index) {
    if (index < 0 || index >= this.items.length) return;
    this.items.splice(index, 1);
    // Adjust indices
    if (this.currentIndex >= this.items.length) {
      this.currentIndex = this.items.length - 1;
    }
    if (this.playingIndex >= this.items.length) {
      this.playingIndex = -1;
    } else if (this.playingIndex > index) {
      this.playingIndex--;
    }
  }

  clear() {
    this.items = [];
    this.currentIndex = -1;
    this.playingIndex = -1;
  }

  select(index) {
    if (index >= 0 && index < this.items.length) {
      this.currentIndex = index;
      return this.items[index];
    }
    return null;
  }

  selectNext() {
    if (this.items.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % this.items.length;
    return this.items[this.currentIndex];
  }

  selectPrev() {
    if (this.items.length === 0) return null;
    this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
    return this.items[this.currentIndex];
  }

  next() {
    if (this.playingIndex < this.items.length - 1) {
      this.playingIndex++;
      this.currentIndex = this.playingIndex;
      return this.items[this.playingIndex];
    }
    return null;
  }

  prev() {
    if (this.playingIndex > 0) {
      this.playingIndex--;
      this.currentIndex = this.playingIndex;
      return this.items[this.playingIndex];
    }
    return null;
  }

  getCurrent() {
    if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
      return this.items[this.currentIndex];
    }
    return null;
  }

  getPlaying() {
    if (this.playingIndex >= 0 && this.playingIndex < this.items.length) {
      return this.items[this.playingIndex];
    }
    return null;
  }

  hasNext() {
    return this.playingIndex < this.items.length - 1;
  }

  getCount() {
    return this.items.length;
  }
}

// ========================================
// Main MDX Player Class
// ========================================
class MDXPlayer {
  constructor() {
    this._container = null;
    this._toggleButton = null;
    this._context = null;
    this._synthNode = null;
    this._toggleState = false;
    this._isStopped = false;

    // Visualizers
    this._keyboardVis = null;
    this._levelMeter = null;
    this._spectrumAnalyzer = null;
    this._opmRegisterVis = null;

    // MIDI
    this._midiManager = null;

    // Animation
    this._animationId = null;

    // Playlist
    this._playlist = new Playlist();
    this._lastLoopCount = 0;
    this._autoPlayLoopLimit = 2;  // Auto-play next after N loops
  }

  _initializeView() {
    // Get new UI elements
    this._toggleButton = document.getElementById('btn-play');
    const pauseBtn = document.getElementById('btn-pause');
    const stopBtn = document.getElementById('btn-stop');
    const fadeoutBtn = document.getElementById('btn-fadeout');
    const dropZone = document.getElementById('drop-zone');

    // Start with blinking PLAY button
    this._toggleButton.classList.add('blink');

    // Button events
    this._toggleButton.addEventListener('click', () => this.play());
    pauseBtn.addEventListener('click', () => this.pause());
    stopBtn.addEventListener('click', () => this.stop());
    fadeoutBtn.addEventListener('click', () => this.fadeout());

    // Initialize visualizers
    const keyboardCanvas = document.getElementById('keyboard-canvas');
    const levelCanvas = document.getElementById('level-canvas');
    const spectrumCanvas = document.getElementById('spectrum-canvas');
    const opmRegisterCanvas = document.getElementById('opm-register-canvas');

    if (keyboardCanvas) {
      this._keyboardVis = new KeyboardVisualizer(keyboardCanvas);

      // Add click handler for mute toggle
      keyboardCanvas.style.cursor = 'pointer';
      keyboardCanvas.addEventListener('click', (e) => {
        const rect = keyboardCanvas.getBoundingClientRect();
        // Scale click position to canvas coordinates
        const scaleX = keyboardCanvas.width / rect.width;
        const scaleY = keyboardCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const channel = this._keyboardVis.getChannelFromPosition(x, y);
        if (channel) {
          const muted = this._keyboardVis.toggleMute(channel.type, channel.channel);
          console.log(`${channel.type.toUpperCase()}${channel.channel + 1} ${muted ? 'MUTED' : 'UNMUTED'}`);

          // Sync mute state to LevelMeter (FM only)
          if (this._levelMeter && channel.type === 'fm') {
            this._levelMeter.setMuteState(channel.channel, muted);
          }

          // Send mute state to synth if needed
          if (this._synthNode) {
            this._synthNode.port.postMessage(JSON.stringify({
              type: 'MUTE',
              channelType: channel.type,
              channel: channel.channel,
              muted: muted
            }));
          }
        }
      });
    }
    if (levelCanvas) {
      this._levelMeter = new LevelMeter(levelCanvas);
    }
    if (spectrumCanvas) {
      this._spectrumAnalyzer = new SpectrumAnalyzer(spectrumCanvas, null);
    }
    if (opmRegisterCanvas) {
      this._opmRegisterVis = new OPMRegisterVisualizer(opmRegisterCanvas);
    }

    // Setup drag and drop on drop zone
    this._setupDragDrop(dropZone);

    // Also setup drag drop on body for convenience
    this._setupDragDrop(document.body);

    // Keyboard shortcut: 1-8 keys toggle FM1-8 mute, 9 toggles PCM1 mute
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;
      if (key >= '1' && key <= '8') {
        // FM channels 1-8
        const channel = parseInt(key) - 1; // 0-7
        if (this._keyboardVis) {
          const muted = this._keyboardVis.toggleMute('fm', channel);
          console.log(`FM${channel + 1} ${muted ? 'MUTED' : 'UNMUTED'}`);

          // Sync mute state to LevelMeter
          if (this._levelMeter) {
            this._levelMeter.setMuteState(channel, muted);
          }

          // Send mute state to synth
          if (this._synthNode) {
            this._synthNode.port.postMessage(JSON.stringify({
              type: 'MUTE',
              channelType: 'fm',
              channel: channel,
              muted: muted
            }));
          }
        }
      } else if (key === '9') {
        // PCM channel 1
        if (this._keyboardVis) {
          const muted = this._keyboardVis.toggleMute('pcm', 0);
          console.log(`PCM1 ${muted ? 'MUTED' : 'UNMUTED'}`);

          // Send mute state to synth
          if (this._synthNode) {
            this._synthNode.port.postMessage(JSON.stringify({
              type: 'MUTE',
              channelType: 'pcm',
              channel: 0,
              muted: muted
            }));
          }
        }
      }
    });

    // Initialize playlist UI
    this._initializePlaylist();
  }

  _initializePlaylist() {
    const playlistContainer = document.getElementById('playlist-container');
    const playlistList = document.getElementById('playlist-list');
    const autoplayBtn = document.getElementById('btn-autoplay');
    const clearBtn = document.getElementById('btn-clear-playlist');

    if (!playlistContainer || !playlistList) return;

    // Auto-play toggle
    if (autoplayBtn) {
      autoplayBtn.addEventListener('click', () => {
        this._playlist.isAutoPlay = !this._playlist.isAutoPlay;
        autoplayBtn.classList.toggle('active', this._playlist.isAutoPlay);
      });
    }

    // Clear playlist
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._playlist.clear();
        this._updatePlaylistUI();
      });
    }

    // Click to select
    playlistList.addEventListener('click', (e) => {
      const item = e.target.closest('.playlist-item');
      if (item) {
        const index = parseInt(item.dataset.index, 10);
        this._playlist.select(index);
        this._updatePlaylistUI();
      }
    });

    // Double-click to play
    playlistList.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.playlist-item');
      if (item) {
        const index = parseInt(item.dataset.index, 10);
        this._playlist.select(index);
        this._playSelectedItem();
      }
    });

    // Keyboard navigation
    playlistContainer.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this._playlist.selectPrev();
          this._updatePlaylistUI();
          this._scrollToSelected();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this._playlist.selectNext();
          this._updatePlaylistUI();
          this._scrollToSelected();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          this._playSelectedItem();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          this._removeSelectedItem();
          break;
      }
    });
  }

  _updatePlaylistUI() {
    const playlistList = document.getElementById('playlist-list');
    const playlistCount = document.getElementById('playlist-count');

    if (!playlistList) return;

    // Update count
    if (playlistCount) {
      const current = this._playlist.playingIndex >= 0 ? this._playlist.playingIndex + 1 : 0;
      const total = this._playlist.getCount();
      playlistCount.textContent = `[${String(current).padStart(2, '0')}/${String(total).padStart(2, '0')}]`;
    }

    // Clear and rebuild list
    playlistList.innerHTML = '';

    this._playlist.items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'playlist-item';
      li.dataset.index = index;

      if (index === this._playlist.currentIndex) {
        li.classList.add('selected');
      }
      if (index === this._playlist.playingIndex) {
        li.classList.add('playing');
      }

      const numberSpan = document.createElement('span');
      numberSpan.className = 'item-number';
      numberSpan.textContent = String(index + 1).padStart(2, '0');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'item-title';
      titleSpan.textContent = item.title || item.mdxFilename;

      const filenameSpan = document.createElement('span');
      filenameSpan.className = 'item-filename';
      filenameSpan.textContent = item.mdxFilename;

      li.appendChild(numberSpan);
      li.appendChild(titleSpan);
      if (!item.title) {
        // Only show filename if no title yet
      } else {
        li.appendChild(filenameSpan);
      }

      playlistList.appendChild(li);
    });
  }

  _scrollToSelected() {
    const playlistContainer = document.getElementById('playlist-container');
    const selected = playlistContainer?.querySelector('.playlist-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  _playSelectedItem() {
    const item = this._playlist.getCurrent();
    if (!item) return;

    this._playlist.playingIndex = this._playlist.currentIndex;
    this._lastLoopCount = 0;
    this._playItem(item);
  }

  _playItem(item) {
    if (!item) return;

    // Load and play MDX (PDX should already be loaded in WASM from drop time)
    this.loadMDX(item.mdxFilename, item.mdxData);
    this._updatePlaylistUI();
  }

  _updatePlayingItemTitle(titleBytes) {
    if (!titleBytes || titleBytes.length === 0) return;

    const playingItem = this._playlist.getPlaying();
    if (!playingItem || playingItem.title) return;  // Already has title

    try {
      const decoder = new TextDecoder('shift-jis');
      const title = decoder.decode(new Uint8Array(titleBytes));
      if (title) {
        playingItem.title = title;
        this._updatePlaylistUI();
      }
    } catch (e) {
      // Ignore decode errors
    }
  }

  _removeSelectedItem() {
    if (this._playlist.currentIndex >= 0) {
      this._playlist.remove(this._playlist.currentIndex);
      this._updatePlaylistUI();
    }
  }

  _onPlaybackEnd() {
    if (this._playlist.isAutoPlay && this._playlist.hasNext()) {
      const nextItem = this._playlist.next();
      if (nextItem) {
        this._lastLoopCount = 0;
        this._playItem(nextItem);
      }
    }
  }

  _checkAutoPlay(loopCount) {
    // Check if we should auto-play next song
    if (loopCount >= this._autoPlayLoopLimit && this._lastLoopCount < this._autoPlayLoopLimit) {
      this._onPlaybackEnd();
    }
    this._lastLoopCount = loopCount;
  }

  async _processDroppedFiles(files) {
    const fileArray = Array.from(files);

    // Separate files by type
    const zipFiles = fileArray.filter(f => f.name.match(/\.zip$/i));
    const mdxFiles = fileArray.filter(f => f.name.match(/\.mdx$/i));
    const pdxFiles = fileArray.filter(f => f.name.match(/\.pdx$/i));

    // Process ZIP files
    for (const zipFile of zipFiles) {
      await this._processZipFile(zipFile);
    }

    // Initialize audio context if we have PDX files (needed for loadPDX)
    if (pdxFiles.length > 0 && !this._synthNode) {
      await this._initializeAudio();
    }

    // Load PDX files directly to WASM (not by filename matching)
    for (const pdxFile of pdxFiles) {
      const data = await this._readFileAsync(pdxFile);
      console.log('PDX -> WASM:', pdxFile.name, 'size:', data.byteLength);
      this.loadPDX(pdxFile.name, data);
    }

    // Process MDX files (PDX is already in WASM)
    for (const mdxFile of mdxFiles) {
      const mdxData = await this._readFileAsync(mdxFile);

      const item = new PlaylistItem(
        mdxFile.name,
        mdxData,
        null,  // PDX is managed by WASM, not playlist
        null
      );

      this._playlist.add(item);
    }

    this._updatePlaylistUI();

    // Auto-play first item if this is the first drop
    if (this._playlist.playingIndex === -1 && this._playlist.getCount() > 0) {
      this._playlist.select(0);
      this._playSelectedItem();
    }
  }

  async _processZipFile(zipFile) {
    if (typeof JSZip === 'undefined') {
      console.error('JSZip not loaded');
      return;
    }

    try {
      // Initialize audio context first (needed for loadPDX)
      if (!this._synthNode) {
        await this._initializeAudio();
      }

      const zip = await JSZip.loadAsync(zipFile);
      const mdxEntries = [];

      // First pass: collect MDX and load PDX directly to WASM
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        const filename = path.split('/').pop();
        if (filename.match(/\.mdx$/i)) {
          mdxEntries.push({ path, filename, zipEntry });
        } else if (filename.match(/\.pdx$/i)) {
          const data = await zipEntry.async('arraybuffer');
          console.log('ZIP PDX -> WASM:', filename, 'size:', data.byteLength);
          this.loadPDX(filename, data);
        }
      }

      // Second pass: create playlist items (MDX only, PDX is in WASM)
      for (const mdx of mdxEntries) {
        const mdxData = await mdx.zipEntry.async('arraybuffer');

        const item = new PlaylistItem(
          mdx.filename,
          mdxData,
          null,  // PDX is managed by WASM
          null
        );

        this._playlist.add(item);
      }
    } catch (err) {
      console.error('ZIP processing error:', err);
    }
  }

  _readFileAsync(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  _setupDragDrop(element) {
    if (!element) return;

    const isValid = e => e.dataTransfer.types.indexOf("Files") >= 0;

    element.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!isValid(e)) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      e.dataTransfer.dropEffect = "copy";
      if (element.id === 'drop-zone') {
        element.classList.add('drag-over');
      }
    });

    element.addEventListener('dragleave', e => {
      e.stopPropagation();
      if (element.id === 'drop-zone') {
        element.classList.remove('drag-over');
      }
    });

    element.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      if (element.id === 'drop-zone') {
        element.classList.remove('drag-over');
      }

      const files = e.dataTransfer.files;
      this._processDroppedFiles(files);
    });
  }

  async _initializeAudio() {
    this._context = new AudioContext({
      latencyHint: "interactive",
      sampleRate: 48000
    });

    await this._context.audioWorklet.addModule('./mdx.wasm.js');
    this._synthNode = new AudioWorkletNode(this._context, 'wasm-synth', {
      outputChannelCount: [2]
    });

    this._synthNode.connect(this._context.destination);

    // Setup spectrum analyzer with audio context
    if (this._spectrumAnalyzer) {
      this._spectrumAnalyzer.audioContext = this._context;
      this._spectrumAnalyzer.setup(this._synthNode);
    }

    // Handle messages from worklet
    this._synthNode.port.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle TITLE message (sent immediately after loadMDX)
        if (data.type === "TITLE") {
          this._updateTitle(data.titleBytes);
        }
        // Handle CHANNEL message (sent during playback)
        else if (data.type === "CHANNEL") {
          // Merge local MIDI state from MIDIManager for immediate response
          // (don't wait for worklet roundtrip)
          if (this._midiManager) {
            const localMidi = this._midiManager.getMidiState();
            data.midiChannelActive = localMidi.midiChannelActive;
            data.midiKeyState = localMidi.midiKeyState;
          }

          // Update visualizers
          if (this._keyboardVis) this._keyboardVis.render(data, data.opmRegs);
          if (this._levelMeter) this._levelMeter.render(data, data.opmRegs);
          if (this._opmRegisterVis) this._opmRegisterVis.render(data.opmRegs);

          // Update time/loop/tempo display
          this._updateTimeDisplay(data.playTime, data.loopCount, data.tempo);

          // Update title if available (Shift-JIS decode)
          this._updateTitle(data.titleBytes);

          // Update playlist item title
          this._updatePlayingItemTitle(data.titleBytes);

          // Check for auto-play next song
          this._checkAutoPlay(data.loopCount);
        }
      } catch (e) {
        // OPM register dump (legacy)
        const element = document.getElementById("opmreg");
        if (element) element.innerHTML = event.data;
      }
    };

    // Start render loop
    this._startRenderLoop();

    // Request initial title (for embedded default MDX)
    this._synthNode.port.postMessage("GET_TITLE");

    if (!this._toggleState) this._context.suspend();
  }

  _startRenderLoop() {
    const render = () => {
      // Request channel data
      if (this._synthNode && this._toggleState) {
        this._synthNode.port.postMessage("CHANNEL");
      }

      // Render spectrum (uses Web Audio API directly)
      if (this._spectrumAnalyzer && this._toggleState) {
        this._spectrumAnalyzer.render();
      }

      this._animationId = requestAnimationFrame(render);
    };
    render();
  }

  _updateTimeDisplay(playTime, loopCount, tempo) {
    const timeDisplay = document.getElementById('time-display');
    const loopDisplay = document.getElementById('loop-display');
    const tempoDisplay = document.getElementById('tempo-display');

    if (timeDisplay) {
      // PLAYTIME to milliseconds: PLAYTIME * 1024 / 4000
      const playTimeMs = (playTime * 1024 / 4000);
      const seconds = Math.floor(playTimeMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timeDisplay.textContent =
        `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    if (loopDisplay) {
      loopDisplay.textContent = String(loopCount || 0).padStart(2, '0');
    }

    if (tempoDisplay) {
      tempoDisplay.textContent = String(tempo || 0).padStart(3, '0');
    }
  }

  _updateTitle(titleBytes) {
    if (!titleBytes || titleBytes.length === 0) return;
    try {
      const decoder = new TextDecoder('shift-jis');
      const title = decoder.decode(new Uint8Array(titleBytes));
      const titleEl = document.getElementById("title");
      if (titleEl && titleEl.textContent !== title) {
        titleEl.textContent = title;
      }
    } catch (e) {
      console.log("Title decode error:", e);
    }
  }

  play() {
    if (!this._context) return;

    console.log("play() called, isStopped:", this._isStopped);

    // If stopped, replay from beginning
    if (this._isStopped) {
      console.log("Sending REPLAY command");
      this._synthNode.port.postMessage("REPLAY");
      this._isStopped = false;
    }

    // Resume audio context
    this._context.resume();

    this._toggleState = true;
    this._toggleButton.classList.remove('blink');
    this._toggleButton.classList.add('active');
  }

  pause() {
    if (!this._context) return;

    // Toggle pause/resume
    if (this._context.state === 'running') {
      this._context.suspend();
      this._toggleState = false;
      this._toggleButton.classList.remove('active');
    } else if (this._context.state === 'suspended' && !this._isStopped) {
      this._context.resume();
      this._toggleState = true;
      this._toggleButton.classList.add('active');
    }
  }

  stop() {
    if (!this._synthNode) return;
    console.log("stop() called");
    this._synthNode.port.postMessage("STOP");
    this._isStopped = true;
    this._toggleState = false;
    this._toggleButton.classList.remove('active');
    console.log("isStopped set to true");

    // Start decay animation for visualizers
    this._startDecayAnimation();
  }

  _startDecayAnimation() {
    const decayLoop = () => {
      if (!this._isStopped) return;

      // Decay level meter
      if (this._levelMeter) {
        this._levelMeter.decay();
      }

      // Decay spectrum analyzer
      if (this._spectrumAnalyzer) {
        this._spectrumAnalyzer.decay();
      }

      // Continue until fully decayed
      const levelActive = this._levelMeter && this._levelMeter.hasActiveLevel();
      const spectrumActive = this._spectrumAnalyzer && this._spectrumAnalyzer.hasActiveLevel();

      if (levelActive || spectrumActive) {
        requestAnimationFrame(decayLoop);
      }
    };
    requestAnimationFrame(decayLoop);
  }

  fadeout() {
    if (!this._synthNode) return;
    this._synthNode.port.postMessage("FADEOUT");
  }

  loadMDX(filename, data, autoPlay = true) {
    this._synthNode.port.postMessage("MDX");
    this._synthNode.port.postMessage(data);

    // Set filename in MDX file info
    document.getElementById("mdxfile").textContent = filename;
    // Title will be updated by TITLE message from worklet
    if (autoPlay) {
      this.play();
    } else {
      // Mark as stopped so PLAY button will send REPLAY command
      this._isStopped = true;
    }
  }

  loadPDX(filename, data) {
    this._synthNode.port.postMessage(filename);
    this._synthNode.port.postMessage(data);

    document.getElementById("pdxfile").textContent = filename;
  }

  async onWindowLoad() {
    console.log("WASM MDX Player Loading...");
    this._initializeView();
    await this._initializeAudio();

    // Initialize MIDI
    this._midiManager = new MIDIManager(this);
    const midiSupported = await this._midiManager.init();
    if (midiSupported) {
      console.log('Web MIDI initialized successfully');
    } else {
      console.log('Web MIDI not available');
    }

    // Initial render of visualizers (empty state)
    this._renderInitialState();

    // Load MDX/PDX from URL parameters if specified
    await this._loadFromURLParams();

    console.log("WASM MDX Player Ready!");
  }

  async _loadFromURLParams() {
    const params = new URLSearchParams(window.location.search);
    const mdxUrl = params.get('mdx') || 'ds02.mdx';  // Default to ds02.mdx
    const pdxUrl = params.get('pdx');

    console.log('Loading MDX:', { mdx: mdxUrl, pdx: pdxUrl });

    try {
      // Load PDX first if specified
      if (pdxUrl) {
        const pdxResponse = await fetch(pdxUrl);
        if (pdxResponse.ok) {
          const pdxData = await pdxResponse.arrayBuffer();
          const pdxFilename = pdxUrl.split('/').pop() || 'unknown.pdx';
          console.log('Loaded PDX:', pdxFilename, 'size:', pdxData.byteLength);
          this.loadPDX(pdxFilename, pdxData);
        } else {
          console.warn('Failed to load PDX:', pdxUrl, pdxResponse.status);
        }
      }

      // Load MDX
      const mdxResponse = await fetch(mdxUrl);
      if (mdxResponse.ok) {
        const mdxData = await mdxResponse.arrayBuffer();
        const mdxFilename = mdxUrl.split('/').pop() || 'unknown.mdx';
        console.log('Loaded MDX:', mdxFilename, 'size:', mdxData.byteLength);
        // Don't auto-play (browser autoplay policy requires user gesture)
        this.loadMDX(mdxFilename, mdxData, false);
      } else {
        console.error('Failed to load MDX:', mdxUrl, mdxResponse.status);
      }
    } catch (e) {
      console.error('Error loading from URL params:', e);
    }
  }

  _renderInitialState() {
    // Create empty channel data for initial display
    const emptyChannelData = {
      fm: Array(8).fill(null).map(() => ({ note: 0, volume: 0, keyOn: false })),
      pcm: Array(8).fill(null).map(() => ({ note: 0, volume: 0, keyOn: false }))
    };
    const emptyOpmRegs = new Array(256).fill(0);

    // Render all visualizers with empty data
    if (this._keyboardVis) {
      this._keyboardVis.render(emptyChannelData, emptyOpmRegs);
    }
    if (this._levelMeter) {
      this._levelMeter.render(emptyChannelData, emptyOpmRegs);
    }
    if (this._opmRegisterVis) {
      this._opmRegisterVis.render(emptyOpmRegs);
    }
  }
}

// ========================================
// Initialize
// ========================================
const mdxplayer = new MDXPlayer();
window.addEventListener('load', () => mdxplayer.onWindowLoad());
