/**
 * @license
 * Copyright 2013 The Emscripten Authors
 * SPDX-License-Identifier: MIT
 *
 * This file gets implicatly injected as a `--pre-js` file when
 * emcc is run with `--emrun`
 */

// Route URL GET parameters to argc+argv
if (typeof window == 'object') {
    Module['arguments'] = window.location.search.substr(1).trim().split('&');
    // If no args were passed arguments = [''], in which case kill the single empty string.
    if (!Module['arguments'][0]) {
      Module['arguments'] = ['https://goroman.github.io/mdx/simple_mdx_player/mdxdir/bos04.mdx'];
    }
  }
