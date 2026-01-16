# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

GOROmanの個人ホームページ（GitHub Pages）。レトロなHTML構成と、WebAssemblyベースのMDX音楽プレーヤーを含む。

## ビルドコマンド

### MDX WASMプレーヤーのビルド
```bash
cd mdx
make build
```

### Simple MDX Player（SDL2版）のビルド
```bash
cd mdx/simple_mdx_player
make
```

**前提条件**: Emscripten (`emcc`) がインストールされていること

## アーキテクチャ

### MDX Player (`mdx/`)
WebAssemblyを使用したX68000のMDX音楽形式プレーヤー。

- `mdx.wasm.js` - Emscriptenでコンパイルされたwasmモジュール
- `index.js` - `MDXPlayer`クラス。Web Audio API（AudioWorklet）でwasmを再生
- `SynthProcessor.js` - AudioWorkletProcessor実装
- `src/synth_bind.cc` - Embindによるwasmバインディング
- `src/portable_mdx/` - サブモジュール（[yosshin4004/portable_mdx](https://github.com/yosshin4004/portable_mdx)）

**処理フロー**: ユーザーがMDX/PDXファイルをドラッグ＆ドロップ → `FileReader`で読み込み → `AudioWorkletNode`経由でwasm側へ転送 → OPMエミュレーションで音声生成

### 静的ページ
- `index.html` - メインページ（レトロスタイル）
- `irc.html` - IRCガイドページ
- `RCS/` - バージョン管理履歴

## サブモジュール

```bash
git submodule update --init --recursive
```

portable_mdxサブモジュールは`mdx/src/portable_mdx`に配置。
