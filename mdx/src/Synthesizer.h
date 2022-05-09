/*
 * Copyright (C) 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef SYNTHESIZER_H
#define SYNTHESIZER_H

#include <vector>

class Synthesizer
{
public:
  Synthesizer(int32_t sampleRate)
  {
  }

  virtual ~Synthesizer(){};

  void noteOn(uint8_t pitch)
  {
    printf("noteOn: %d\n", pitch);
  }

  void noteOff(uint8_t pitch)
  {
  }

  virtual uint8_t getReg(uint8_t addr)
  {
  }
  virtual void loadMDX(uintptr_t output_ptr, int32_t mdxFileImageSizeInBytes)
  {
  }

  void render(float *output, int32_t numFrames)
  {
  }

private:
};

#endif // SYNTHMARK_SYNTHESIZER_H
