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

#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <assert.h>
#include <sys/stat.h>
#ifdef _WIN32
#include <Windows.h>
#else
#include <libgen.h> /* for dirname() */
#endif
#include <string.h>

#include "mdx_util.h"
#include "mxdrv.h"
#include "mxdrv_context.h"

static const char MDXDATA[] = {
#include "mdxdata.inc"
};
static const char PDXDATA[] = {
#include "bos.pdx.inc"
};

#include <emscripten/bind.h>
#include "Synthesizer.h"

using namespace emscripten;

class SynthesizerWrapper : public Synthesizer
{
  MxdrvContext context;

public:
  SynthesizerWrapper(int32_t sampleRate)
      : Synthesizer(sampleRate)
  {

    puts("SimpleKernel::SimpleKernel()");

    /* MDX ファイルの読み込み */
    uint32_t mdxFileImageSizeInBytes = sizeof(MDXDATA);
    void *mdxFileImage = (void *)MDXDATA;

    /* MDX タイトルの取得 */
    char mdxTitle[256];
    MdxGetTitle(
        mdxFileImage, mdxFileImageSizeInBytes,
        mdxTitle, sizeof(mdxTitle));
    printf("mdx title = %s\n", mdxTitle);

    /* PDX ファイルを要求するか？ */
    bool hasPdx;
    if (
        MdxHasPdxFileName(
            mdxFileImage, mdxFileImageSizeInBytes,
            &hasPdx) == false)
    {
      printf("MdxHasPdxFileName failed.\n");
      exit(EXIT_FAILURE);
    }

    /* PDX ファイルの読み込み */
    uint32_t pdxFileImageSizeInBytes = 0;
    void *pdxFileImage = NULL;
    if (hasPdx)
    {
      char pdxFileName[FILENAME_MAX] = {0};
      if (
          MdxGetPdxFileName(
              mdxFileImage, mdxFileImageSizeInBytes,
              pdxFileName, sizeof(pdxFileName)) == false)
      {
        printf("MdxGetPdxFileName failed.\n");
        exit(EXIT_FAILURE);
      }
      printf("pdx filename = %s\n", pdxFileName);

#ifdef _WIN32
#else
      const char *mdxDirName = dirname(NULL);

      /*
        ファイル名の大文字小文字が区別される環境では
          大文字ファイル名 + 大文字拡張子
          大文字ファイル名 + 小文字拡張子
          小文字ファイル名 + 大文字拡張子
          小文字ファイル名 + 小文字拡張子
        の 4 通りで PDX ファイル読み込みを試す必要がある。
      */
      for (int retryCount = 0; retryCount < 4; retryCount++)
      {
        char modifiedPdxFileName[FILENAME_MAX];
        memcpy(modifiedPdxFileName, pdxFileName, FILENAME_MAX);
        if (retryCount & 1)
        {
          /* ファイル名部分の大文字小文字反転 */
          for (char *p = modifiedPdxFileName; *p != '\0' && *p != '.'; p++)
          {
            if ('a' <= *p && *p <= 'z' || 'A' <= *p && *p <= 'Z')
              *p ^= 0x20;
          }
        }
        if (retryCount & 2)
        {
          /* 拡張子部分の大文字小文字反転 */
          char *p = modifiedPdxFileName;
          while (strchr(p, '.') != NULL)
            p = strchr(p, '.') + 1;
          for (; *p != '\0'; p++)
          {
            if ('a' <= *p && *p <= 'z' || 'A' <= *p && *p <= 'Z')
              *p ^= 0x20;
          }
        }

        char pdxFilePath[FILENAME_MAX];
        sprintf(pdxFilePath, "%s/%s", mdxDirName, modifiedPdxFileName);
        printf("read %s ... ", pdxFilePath);
        pdxFileImageSizeInBytes = sizeof(PDXDATA);
        pdxFileImage = (void *)PDXDATA; // NULL; // mallocReadFile(pdxFilePath, &pdxFileImageSizeInBytes);
        if (pdxFileImage != NULL)
        {
          printf("succeeded.\n");
          break;
        }
        else
        {
          printf("failed.\n");
        }
      }
#endif
    }
    /* MDX PDX バッファの要求サイズを求める */
    uint32_t mdxBufferSizeInBytes = 0;
    uint32_t pdxBufferSizeInBytes = 0;
    if (
        MdxGetRequiredBufferSize(
            mdxFileImage,
            mdxFileImageSizeInBytes, pdxFileImageSizeInBytes,
            &mdxBufferSizeInBytes, &pdxBufferSizeInBytes) == false)
    {
      printf("MdxGetRequiredBufferSize failed.\n");
      exit(EXIT_FAILURE);
    }
    printf("mdxBufferSizeInBytes = %d\n", mdxBufferSizeInBytes);
    printf("pdxBufferSizeInBytes = %d\n", pdxBufferSizeInBytes);

    /* MDX PDX バッファの確保 */
    void *mdxBuffer = NULL;
    mdxBuffer = (uint8_t *)malloc(mdxBufferSizeInBytes);
    if (mdxBuffer == NULL)
    {
      printf("malloc mdxBuffer failed.\n");
      exit(EXIT_FAILURE);
    }
    void *pdxBuffer = NULL;
    printf("!!\n");
    if (hasPdx)
    {
      printf("!!\n");
      pdxBuffer = (uint8_t *)malloc(pdxBufferSizeInBytes);
      if (pdxBuffer == NULL)
      {
        printf("malloc pdxBuffer failed.\n");
        exit(EXIT_FAILURE);
      }
    }

    /* MDX PDX バッファを作成 */
    if (
        MdxUtilCreateMdxPdxBuffer(
            mdxFileImage, mdxFileImageSizeInBytes,
            pdxFileImage, pdxFileImageSizeInBytes,
            mdxBuffer, mdxBufferSizeInBytes,
            pdxBuffer, pdxBufferSizeInBytes) == false)
    {
      printf("MdxUtilCreateMdxPdxBuffer failed.\n");
      exit(EXIT_FAILURE);
    }

    /* この時点でファイルイメージは破棄してよい */
    if (pdxFileImage != NULL)
      free(pdxFileImage);

/* コンテキストの初期化 */
#define MDX_BUFFER_SIZE 1 * 1024 * 1024
#define PDX_BUFFER_SIZE 2 * 1024 * 1024
#define MEMORY_POOL_SIZE 8 * 1024 * 1024
    if (MxdrvContext_Initialize(&context, MEMORY_POOL_SIZE) == false)
    {
      printf("MxdrvContext_Initialize failed.\n");
      exit(EXIT_FAILURE);
    }

    /* MXDRV の初期化 */
    //#define NUM_SAMPLES_PER_SEC 48000
    {
      int ret = MXDRV_Start(
          &context,
          sampleRate,
          0, 0, 0,
          MDX_BUFFER_SIZE,
          PDX_BUFFER_SIZE,
          0);
      if (ret != 0)
      {
        printf("MXDRV_Start failed. return code = %d\n", ret);
        exit(EXIT_FAILURE);
      }
    }

    /* PCM8 を有効化 */
    uint8_t *pcm8EnableFlag = (uint8_t *)MXDRV_GetWork(&context, MXDRV_WORK_PCM8);
    *(pcm8EnableFlag) = 1;

    /* 音量設定 */
    MXDRV_TotalVolume(&context, 256);

    /* 再生時間を求める */
    float songDurationInSeconds = MXDRV_MeasurePlayTime(
                                      &context,
                                      mdxBuffer, mdxBufferSizeInBytes,
                                      pdxBuffer, pdxBufferSizeInBytes,
                                      1, 0) /
                                  1000.0f;
    printf("song duration %.1f(sec)\n", songDurationInSeconds);

    /* MDX 再生 */
    MXDRV_Play(
        &context,
        mdxBuffer, mdxBufferSizeInBytes,
        pdxBuffer, pdxBufferSizeInBytes);
  }

  virtual ~SynthesizerWrapper()
  {
    MXDRV_End(&context);
    MxdrvContext_Terminate(&context);
    //	if (pdxBuffer != NULL) free(pdxBuffer);
    //	free(mdxBuffer);
  }
  virtual uint8_t getReg(uint8_t addr)
  {
    //    MXWORK_OPM* opm = (MXWORK_OPM*)MXDRV_GetWork(&context, MXDRV_WORK_OPM);
    //    uint8_t data = *opm[addr];
    uint8_t data = 0;
    bool updated = false;
    MxdrvContext_GetOpmReg(&context, addr, &data, &updated);
    return data;
  }

  //  void render(float* leftOutput, float* rightOutput, int32_t numFrames)
  void render(uintptr_t output_ptr, int32_t numFrames)
  {
    // Use type cast to hide the raw pointer in function arguments.
    float *leftOutput_buffer = reinterpret_cast<float *>(output_ptr);
    float *rightOutput_buffer = leftOutput_buffer+numFrames;

    const int numSamples = numFrames;
    const int numChannels = 2;
    const int wavBufferSizeInBytes = sizeof(int16_t) * numSamples * numChannels;

    int16_t wavBuffer[numSamples * numChannels * 2];
    
    MXDRV_GetPCM(&context, wavBuffer, numSamples);

    for (int i = 0; i < numFrames; ++i)
    {
      leftOutput_buffer[i] = (float)wavBuffer[i * 2 + 0] / 32768.0f;
      rightOutput_buffer[i] = (float)wavBuffer[i * 2 + 1] / 32768.0f;
    }
  }
};

EMSCRIPTEN_BINDINGS(CLASS_Synthesizer)
{
  // First, bind the original Synthesizer class.
  class_<Synthesizer>("SynthesizerBase")
      .constructor<int32_t>()
      .function("noteOff", &Synthesizer::noteOff)
      .function("noteOn", &Synthesizer::noteOn)
      .function("getReg", &Synthesizer::getReg);

  // Then expose the overridden `render` method from the wrapper class.
  class_<SynthesizerWrapper, base<Synthesizer>>("Synthesizer")
      .constructor<int32_t>()
      .function("render", &SynthesizerWrapper::render, allow_raw_pointers());
}