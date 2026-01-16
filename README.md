# GOROman.github.io

GOROmanの個人ホームページ（GitHub Pages）

## MDX Player

WebAssemblyを使用したX68000のMDX音楽形式プレーヤー。

### 技術スタック

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Audio**: Web Audio API (AudioWorklet)
- **Synth**: WebAssembly (Emscripten)
- **MIDI**: Web MIDI API

### 機能

- MDX/PDXファイルのドラッグ＆ドロップ再生
- FM音源8ch + ADPCM音源8chのビジュアライザー
- スペクトラムアナライザー / レベルメーター
- OPM (YM2151) レジスタ表示
- MIDI入力対応（MIDIキーボードでFM音源を演奏可能）
- モバイルレスポンシブ対応

### セットアップ

#### 前提条件

- Node.js 18+
- Emscripten (`emcc`) - WASMビルド用

```bash
# macOS (Homebrew)
brew install emscripten node

# PATHに追加（必要な場合）
export PATH="/opt/homebrew/opt/emscripten/bin:$PATH"
```

#### サブモジュールの初期化

```bash
git submodule update --init --recursive
```

#### 依存関係のインストール

```bash
npm install
```

#### WASMビルド

```bash
cd mdx
make build
```

ビルド後、`mdx.wasm.js`が`public/`に自動コピーされます。

### 開発

```bash
# 開発サーバー起動
npm run dev
# http://localhost:5173/ を開く

# 本番ビルド
npm run build

# プレビュー
npm run preview
```

### Emscriptenオプション（メモリ関連）

Emscripten 4.x以降では、以下のオプションが必要です（Makefileに設定済み）:

```makefile
# メモリ操作関数のエクスポート（WASMAudioBufferで使用）
-sEXPORTED_FUNCTIONS=['_malloc','_free']

# ランタイムメソッドのエクスポート（HEAPF32はAudioWorkletで使用）
-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32','HEAPU8','HEAP8']
```

| オプション | 説明 |
|-----------|------|
| `_malloc`, `_free` | WASMヒープのメモリ確保・解放 |
| `HEAPF32` | Float32配列ビュー（オーディオバッファ用） |
| `HEAPU8`, `HEAP8` | Uint8/Int8配列ビュー（ファイル読み込み用） |
| `ccall`, `cwrap` | C関数呼び出しラッパー |

### MIDI対応

- Web MIDI API対応ブラウザで利用可能
- MIDIデバイスは自動検出・選択
- MIDIチャンネル1-8 → FM1-8にマッピング
- MIDI入力時は該当FMチャンネルのMDX再生を自動ミュート
- STOP→PLAYで全ミュート状態をリセット

### ライセンス

MDXプレーヤーは [portable_mdx](https://github.com/yosshin4004/portable_mdx) を使用しています。
