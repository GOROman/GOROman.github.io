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
#include <string>

#include "mdx_util.h"
#include "mxdrv.h"
#include "mxdrv_context.h"

//static const char MDXDATA[] = {
//#include "ds02.inc"
//};

//static const char PDXDATA[] = {
//#include "bos.pdx.inc"
//};

#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "Synthesizer.h"

using namespace emscripten;

static char upper(char c){
    if('a' <= c && c <= 'z'){
        c = c - ('a' - 'A');
    }
    return c;
}
static void upperstring(char *out, const char *in){
    int i;

    i = 0;
    while(in[i] != '\0'){
        out[i] = upper(in[i]);
        i++;
    }
}

static void *mallocReadFile(
	const char *fileName,
	uint32_t *sizeRet
){
#ifdef _WIN32
	int wcharFileNameSize = MultiByteToWideChar(CP_UTF8, 0, fileName, -1, NULL, 0);
	wchar_t *wcharFileName = calloc(wcharFileNameSize, sizeof(wchar_t));
	if (MultiByteToWideChar(CP_UTF8, 0, fileName, -1, wcharFileName, wcharFileNameSize) == 0) {
		free(wcharFileName);
		return NULL;
	}
	FILE *fd; _wfopen_s(&fd, wcharFileName, L"rb");
	free(wcharFileName);
#else
	FILE *fd = fopen(fileName, "rb");
#endif
	if (fd == NULL) return NULL;
	struct stat stbuf;
#ifdef _WIN32
	if (fstat(_fileno(fd), &stbuf) == -1) {
#else
	if (fstat(fileno(fd), &stbuf) == -1) {
#endif
		fclose(fd);
		return NULL;
	}
	assert(stbuf.st_size < 0x100000000LL);
	uint32_t size = (uint32_t)stbuf.st_size;
	void *buffer = malloc(size);
	if (buffer == NULL) {
		fclose(fd);
		return NULL;
	}
	fread(buffer, 1, size, fd);
	*sizeRet = size;
	fclose(fd);
	return buffer;
}

class SynthesizerWrapper : public Synthesizer
{
  MxdrvContext context;
    char mdxTitle[256];

  void *mdxBuffer = NULL;
  void *pdxBuffer = NULL;
  uint32_t mdxBufferSize = 0;
  uint32_t pdxBufferSize = 0;

public:
  SynthesizerWrapper(int32_t sampleRate)
      : Synthesizer(sampleRate)
  {

    puts("SimpleKernel::SimpleKernel()");

    char* mdxFilePath = "ds02.mdx";
    printf("Filename:%s\n", mdxFilePath);

    /* MDX ファイルの読み込み */
#if 1
    uint32_t mdxFileImageSizeInBytes = 0;
    void *mdxFileImage = mallocReadFile(mdxFilePath, &mdxFileImageSizeInBytes);
    if (mdxFileImage == NULL) {
      printf("mallocReadFile '%s' failed.\n", mdxFilePath);
      exit(EXIT_FAILURE);
    }
#else
  void* mdxFileImage = (void*)MDXDATA;
  uint32_t mdxFileImageSizeInBytes = sizeof(MDXDATA);
#endif

    /* コンテキストの初期化 */
#define MDX_BUFFER_SIZE 1 * 1024 * 1024
#define PDX_BUFFER_SIZE 2 * 1024 * 1024
#define MEMORY_POOL_SIZE 8 * 1024 * 1024
    if (MxdrvContext_Initialize(&context, MEMORY_POOL_SIZE) == false)
    {
      printf("MxdrvContext_Initialize failed.\n");
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


    loadMDX((uintptr_t)mdxFileImage, mdxFileImageSizeInBytes);
  }

  virtual ~SynthesizerWrapper()
  {
    MXDRV_End(&context);
    MxdrvContext_Terminate(&context);
    reset();
  }

  void reset() {
    if (pdxBuffer != NULL) {
      free(pdxBuffer);
      pdxBuffer = NULL;
    }
    if (mdxBuffer != NULL) {
      free(mdxBuffer);
      mdxBuffer = NULL;
    }
    
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

  // チャンネルデータ取得API
  virtual uint16_t getFmNote(uint8_t ch) {
    if (ch >= 8) return 0;
    const MXWORK_CH *fmChannels = (const MXWORK_CH *)MXDRV_GetWork(&context, MXDRV_WORK_FM);
    return fmChannels[ch].S0012;
  }

  virtual uint16_t getFmNoteBend(uint8_t ch) {
    if (ch >= 8) return 0;
    const MXWORK_CH *fmChannels = (const MXWORK_CH *)MXDRV_GetWork(&context, MXDRV_WORK_FM);
    return fmChannels[ch].S0014;
  }

  virtual uint8_t getFmVolume(uint8_t ch) {
    if (ch >= 8) return 0;
    const MXWORK_CH *fmChannels = (const MXWORK_CH *)MXDRV_GetWork(&context, MXDRV_WORK_FM);
    return fmChannels[ch].S0022;
  }

  virtual bool getFmKeyOn(uint8_t ch) {
    if (ch >= 8) return false;
    const MXWORK_CH *fmChannels = (const MXWORK_CH *)MXDRV_GetWork(&context, MXDRV_WORK_FM);
    return (fmChannels[ch].S0016 & 0x08) != 0;
  }

  virtual uint16_t getPcmNote(uint8_t ch) {
    if (ch >= 8) return 0;
    const MXWORK_CH *pcmChannels = (const MXWORK_CH *)MXDRV_GetWork(&context, MXDRV_WORK_PCM);
    return pcmChannels[ch].S0012;
  }

  virtual uint8_t getPcmVolume(uint8_t ch) {
    if (ch >= 8) return 0;
    const MXWORK_CH *pcmChannels = (const MXWORK_CH *)MXDRV_GetWork(&context, MXDRV_WORK_PCM);
    return pcmChannels[ch].S0022;
  }

  virtual bool getPcmKeyOn(uint8_t ch) {
    if (ch >= 8) return false;
    const MXWORK_CH *pcmChannels = (const MXWORK_CH *)MXDRV_GetWork(&context, MXDRV_WORK_PCM);
    return (pcmChannels[ch].S0016 & 0x08) != 0;
  }

  virtual uint32_t getPlayTime() {
    const MXWORK_GLOBAL *global = (const MXWORK_GLOBAL *)MXDRV_GetWork(&context, MXDRV_WORK_GLOBAL);
    return global->PLAYTIME;
  }

  virtual uint16_t getLoopCount() {
    const MXWORK_GLOBAL *global = (const MXWORK_GLOBAL *)MXDRV_GetWork(&context, MXDRV_WORK_GLOBAL);
    return global->L002246;
  }

  virtual void stop() {
    MXDRV_Stop(&context);
  }

  virtual void replay() {
    printf("replay() called, mdxBuffer=%p, mdxBufferSize=%d\n", mdxBuffer, mdxBufferSize);
    if (mdxBuffer != NULL) {
      MXDRV_Play(
          &context,
          mdxBuffer, mdxBufferSize,
          pdxBuffer, pdxBufferSize);
      printf("MXDRV_Play called\n");
    }
  }

  virtual void fadeout() {
    MXDRV_Fadeout(&context);
  }

  virtual void setChannelMask(uint16_t mask) {
    // Channel Mask: bit 0-7 = FM ch 1-8, bit 8 = PCM
    // 1 = muted, 0 = playing
    X68REG reg;
    reg.d0 = 0x0e;  // Function code for channel mask
    reg.d1 = mask;
    MXDRV(&context, &reg);
  }

  virtual uint16_t getChannelMask() {
    MXWORK_GLOBAL *global = (MXWORK_GLOBAL *)MXDRV_GetWork(&context, MXDRV_WORK_GLOBAL);
    return global->L001e1c;
  }

  virtual std::string getTitle() {
    return std::string(mdxTitle);
  }

  virtual val getTitleBytes() {
    size_t len = strlen(mdxTitle);
    return val(typed_memory_view(len, (uint8_t*)mdxTitle));
  }

  virtual void loadPDX(uintptr_t output_ptr,int32_t pdxFileImageSizeInBytes, uintptr_t filename)
  {
//    printf("loadPDX()\n");
    FILE* fp = fopen( (char*)filename, "wb" );
    fwrite((void*)output_ptr, 1, pdxFileImageSizeInBytes, fp);
    fclose(fp);
  }
  virtual void loadMDX(uintptr_t output_ptr,int32_t mdxFileImageSizeInBytes)
  {
    reset();

    	 EM_ASM({
//  document.getElementById('mdxfile').innerHTML = "Hello, world!";
  console.log("loadMDX!");
 });

    
    uint8_t* mdxFileImage = (uint8_t*)output_ptr;
//    uint8_t* mdxFileImage = new uint8_t[mdxFileImageSizeInBytes];
//    memcpy(mdxFileImage, a, mdxFileImageSizeInBytes);
//    printf("load %02x %d bytes\n", mdxFileImage[0], mdxFileImageSizeInBytes);

    /* MDX タイトルの取得 */
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
      }
      printf("pdx filename = %s\n", pdxFileName);

#ifdef _WIN32
#else
      const char *mdxDirName = dirname(NULL);

      for (int retryCount = 0; retryCount < 1; retryCount++)
      {
        char modifiedPdxFileName[FILENAME_MAX] = {0};
        upperstring(modifiedPdxFileName, pdxFileName);
//        memcpy(modifiedPdxFileName, pdxFileName, FILENAME_MAX);
 
        char pdxFilePath[FILENAME_MAX];
        sprintf(pdxFilePath, "%s/%s", mdxDirName, modifiedPdxFileName);
        printf("read %s ... ", pdxFilePath);
//       pdxFileImageSizeInBytes = sizeof(PDXDATA);
        pdxFileImage = (void *)mallocReadFile(pdxFilePath, &pdxFileImageSizeInBytes);
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
    }
    printf("mdxBufferSizeInBytes = %d\n", mdxBufferSizeInBytes);
    printf("pdxBufferSizeInBytes = %d\n", pdxBufferSizeInBytes);

    /* MDX PDX バッファの確保 */
    mdxBuffer = (uint8_t *)malloc(mdxBufferSizeInBytes);
    if (mdxBuffer == NULL)
    {
      printf("malloc mdxBuffer failed.\n");
    }
    if (hasPdx)
    {
      pdxBuffer = (uint8_t *)malloc(pdxBufferSizeInBytes);
      if (pdxBuffer == NULL)
      {
        printf("malloc pdxBuffer failed.\n");
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
    }

    /* この時点でファイルイメージは破棄してよい */
    if (pdxFileImage != NULL) {
      free(pdxFileImage);
    }

	free(mdxFileImage);

#if 0
    /* 再生時間を求める */
    float songDurationInSeconds = MXDRV_MeasurePlayTime(
                                      &context,
                                      mdxBuffer, mdxBufferSizeInBytes,
                                      pdxBuffer, pdxBufferSizeInBytes,
                                      1, 0) /
                                  1000.0f;
    printf("song duration %.1f(sec)\n", songDurationInSeconds);
#endif
    /* バッファサイズを保存 */
    mdxBufferSize = mdxBufferSizeInBytes;
    pdxBufferSize = pdxBufferSizeInBytes;

    /* MDX 再生 */
    MXDRV_Play(
        &context,
        mdxBuffer, mdxBufferSize,
        pdxBuffer, pdxBufferSize);

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
      .function("getReg", &Synthesizer::getReg)
  ;

  // Then expose the overridden `render` method from the wrapper class.
  class_<SynthesizerWrapper, base<Synthesizer>>("Synthesizer")
      .constructor<int32_t>()
      .function("render", &SynthesizerWrapper::render, allow_raw_pointers())
      .function("loadMDX", &SynthesizerWrapper::loadMDX, allow_raw_pointers())
      .function("loadPDX", &SynthesizerWrapper::loadPDX, allow_raw_pointers())
      // チャンネルデータ取得API
      .function("getFmNote", &SynthesizerWrapper::getFmNote)
      .function("getFmNoteBend", &SynthesizerWrapper::getFmNoteBend)
      .function("getFmVolume", &SynthesizerWrapper::getFmVolume)
      .function("getFmKeyOn", &SynthesizerWrapper::getFmKeyOn)
      .function("getPcmNote", &SynthesizerWrapper::getPcmNote)
      .function("getPcmVolume", &SynthesizerWrapper::getPcmVolume)
      .function("getPcmKeyOn", &SynthesizerWrapper::getPcmKeyOn)
      .function("getPlayTime", &SynthesizerWrapper::getPlayTime)
      .function("getLoopCount", &SynthesizerWrapper::getLoopCount)
      .function("stop", &SynthesizerWrapper::stop)
      .function("replay", &SynthesizerWrapper::replay)
      .function("fadeout", &SynthesizerWrapper::fadeout)
      .function("getTitle", &SynthesizerWrapper::getTitle)
      .function("getTitleBytes", &SynthesizerWrapper::getTitleBytes)
      .function("setChannelMask", &SynthesizerWrapper::setChannelMask)
      .function("getChannelMask", &SynthesizerWrapper::getChannelMask)
  ;
}
