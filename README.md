# GOROman.github.io

GOROmanの個人ホームページ（GitHub Pages）

## MDX Player

WebAssemblyを使用したX68000のMDX音楽形式プレーヤー。

### ビルド方法

#### 前提条件

Emscripten (`emcc`) が必要です。

```bash
# macOS (Homebrew)
brew install emscripten

# PATHに追加（必要な場合）
export PATH="/opt/homebrew/opt/emscripten/bin:$PATH"
```

#### サブモジュールの初期化

```bash
git submodule update --init --recursive
```

#### ビルド

```bash
cd mdx
make build
```

#### Emscriptenオプション（メモリ関連）

Emscripten 4.x以降では、以下のオプションが必要です（Makefileに設定済み）:

```makefile
# メモリ操作関数のエクスポート（WASMAudioBufferで使用）
-sEXPORTED_FUNCTIONS=['_malloc','_free']

# ランタイムメソッドのエクスポート（HEAPF32はAudioWorkletで使用）
-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32']
```

| オプション | 説明 |
|-----------|------|
| `_malloc`, `_free` | WASMヒープのメモリ確保・解放 |
| `HEAPF32` | Float32配列ビュー（オーディオバッファ用） |
| `ccall`, `cwrap` | C関数呼び出しラッパー |

#### ローカルで実行

```bash
cd mdx
python3 -m http.server 8080
# ブラウザで http://localhost:8080/ を開く
```
