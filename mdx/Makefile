# Copyright 2019 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#!/bin/bash

DEPS = \
	src/portable_mdx/src/mxdrv/mxdrv.cpp	\
	src/portable_mdx/src/mxdrv/mxdrv_context.cpp	\
	src/portable_mdx/src/mxdrv/sound_iocs.cpp	\
	src/portable_mdx/src/x68sound/x68sound.cpp	\
	src/portable_mdx/src/x68sound/x68sound_adpcm.cpp	\
	src/portable_mdx/src/x68sound/x68sound_context.cpp	\
	src/portable_mdx/src/x68sound/x68sound_lfo.cpp	\
	src/portable_mdx/src/x68sound/x68sound_op.cpp	\
	src/portable_mdx/src/x68sound/x68sound_opm.cpp	\
	src/portable_mdx/src/x68sound/x68sound_pcm8.cpp	\
	src/portable_mdx/src/mdx_util.c

build: $(DEPS)
	@emcc \
		--bind \
		--post-js ./export-es6.js \
		-I src/portable_mdx/include \
		-Wno-c++11-narrowing \
		-Wno-tautological-constant-out-of-range-compare \
		-s ENVIRONMENT=shell \
		-s SINGLE_FILE=1 \
		-s WASM=1 \
		-s WASM_ASYNC_COMPILATION=0 \
		-o ./mdx.wasm.js \
		--embed-file ./src/fs@ \
		./src/synth_bind.cc $(DEPS)

#			--preload-file ./src/fs \
