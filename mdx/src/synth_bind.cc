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
#include "portable_mdx/src/mxdrv/sound_iocs.h"

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

    /* No default MDX file - will be loaded via JavaScript */
    void *mdxFileImage = NULL;
    uint32_t mdxFileImageSizeInBytes = 0;

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

    /* Skip initial MDX load - will be loaded via JavaScript */
    // loadMDX((uintptr_t)mdxFileImage, mdxFileImageSizeInBytes);
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

  // LogicalSumOfKeyOn: フレーム間の全キーオンイベントのOR（読み取り後クリア）
  // simple_mdx_playerと同じ方式のレベルメーター用
  virtual val getFmKeyOnEx(uint8_t ch) {
    val result = val::object();
    if (ch >= 8) {
      result.set("currentKeyOn", false);
      result.set("logicalSumOfKeyOn", false);
      return result;
    }
    bool currentKeyOn = false;
    bool logicalSumOfKeyOn = false;
    MxdrvContext_GetFmKeyOn(&context, ch, &currentKeyOn, &logicalSumOfKeyOn);
    result.set("currentKeyOn", currentKeyOn);
    result.set("logicalSumOfKeyOn", logicalSumOfKeyOn);
    return result;
  }

  virtual bool getPcmKeyOnLogicalSum(uint8_t ch) {
    if (ch >= 8) return false;
    bool logicalSumOfKeyOn = false;
    MxdrvContext_GetPcmKeyOn(&context, ch, &logicalSumOfKeyOn);
    return logicalSumOfKeyOn;
  }

  virtual uint32_t getPlayTime() {
    const MXWORK_GLOBAL *global = (const MXWORK_GLOBAL *)MXDRV_GetWork(&context, MXDRV_WORK_GLOBAL);
    return global->PLAYTIME;
  }

  virtual uint16_t getLoopCount() {
    const MXWORK_GLOBAL *global = (const MXWORK_GLOBAL *)MXDRV_GetWork(&context, MXDRV_WORK_GLOBAL);
    return global->L002246;
  }

  virtual uint8_t getTempo() {
    const MXWORK_GLOBAL *global = (const MXWORK_GLOBAL *)MXDRV_GetWork(&context, MXDRV_WORK_GLOBAL);
    return global->L001e0c;  // @t tempo value
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

  // ========================================
  // MIDI Support Functions
  // ========================================

  // OPMレジスタ直接書き込み
  virtual void setOpmReg(uint8_t addr, uint8_t data) {
    _iocs_opmset(&context, addr, data);
  }

  // MIDIノート → OPM KeyCode 変換テーブル (8オクターブ×12音)
  static const uint8_t MidiToOpmKeyCode[96];

  // 各チャンネルのスロットマスクを取得
  // OPM Key On register 0x08: bits 3-6 = slot enable (4 bits)
  // Key Onでは全オペレーターを同時にトリガーする必要がある
  // S0019はキャリアスロット（TL調整用）であり、Key On用ではない
  virtual uint8_t getSlotMask(uint8_t ch) {
    (void)ch; // unused
    // 常に全スロット (0x0F) を使用
    return 0x0F;
  }

  // MIDIキーオン
  virtual void midiKeyOn(uint8_t ch, uint8_t midiNote) {
    if (ch >= 8) return;

    // MIDIノートをOPM KeyCodeに変換 (0-95の範囲にクランプ)
    uint8_t noteIndex = (midiNote < 96) ? midiNote : 95;
    uint8_t kc = MidiToOpmKeyCode[noteIndex];

    // KC (Key Code) 設定 - レジスタ 0x28 + ch
    _iocs_opmset(&context, 0x28 + ch, kc);

    // KF (Key Fraction) = 0 - レジスタ 0x30 + ch
    _iocs_opmset(&context, 0x30 + ch, 0);

    // Key On - レジスタ 0x08
    // MDXの音色で使用しているスロットマスクを取得
    uint8_t slotMask = getSlotMask(ch);
    _iocs_opmset(&context, 0x08, (slotMask << 3) | ch);
  }

  // MIDIキーオフ
  virtual void midiKeyOff(uint8_t ch) {
    if (ch >= 8) return;
    // Key Off - スロットマスク = 0, チャンネル番号のみ
    _iocs_opmset(&context, 0x08, ch);
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

// MIDIノート → OPM KeyCode 変換テーブル (8オクターブ×12音 = 96エントリ)
// OPM KeyCode: 上位3ビット=オクターブ、下位4ビット=ノート (C,C#,D...B)
// ノートは 0,1,2,4,5,6,8,9,10,12,13,14 の順 (3,7,11,15は未使用)
const uint8_t SynthesizerWrapper::MidiToOpmKeyCode[96] = {
  // Octave 0 (MIDI note 0-11)
  0x00, 0x01, 0x02, 0x04, 0x05, 0x06, 0x08, 0x09, 0x0a, 0x0c, 0x0d, 0x0e,
  // Octave 1 (MIDI note 12-23)
  0x10, 0x11, 0x12, 0x14, 0x15, 0x16, 0x18, 0x19, 0x1a, 0x1c, 0x1d, 0x1e,
  // Octave 2 (MIDI note 24-35)
  0x20, 0x21, 0x22, 0x24, 0x25, 0x26, 0x28, 0x29, 0x2a, 0x2c, 0x2d, 0x2e,
  // Octave 3 (MIDI note 36-47)
  0x30, 0x31, 0x32, 0x34, 0x35, 0x36, 0x38, 0x39, 0x3a, 0x3c, 0x3d, 0x3e,
  // Octave 4 (MIDI note 48-59)
  0x40, 0x41, 0x42, 0x44, 0x45, 0x46, 0x48, 0x49, 0x4a, 0x4c, 0x4d, 0x4e,
  // Octave 5 (MIDI note 60-71) - Middle C (C4) is MIDI note 60
  0x50, 0x51, 0x52, 0x54, 0x55, 0x56, 0x58, 0x59, 0x5a, 0x5c, 0x5d, 0x5e,
  // Octave 6 (MIDI note 72-83)
  0x60, 0x61, 0x62, 0x64, 0x65, 0x66, 0x68, 0x69, 0x6a, 0x6c, 0x6d, 0x6e,
  // Octave 7 (MIDI note 84-95)
  0x70, 0x71, 0x72, 0x74, 0x75, 0x76, 0x78, 0x79, 0x7a, 0x7c, 0x7d, 0x7e,
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
      .function("getFmKeyOnEx", &SynthesizerWrapper::getFmKeyOnEx)
      .function("getPcmKeyOnLogicalSum", &SynthesizerWrapper::getPcmKeyOnLogicalSum)
      .function("getPlayTime", &SynthesizerWrapper::getPlayTime)
      .function("getLoopCount", &SynthesizerWrapper::getLoopCount)
      .function("getTempo", &SynthesizerWrapper::getTempo)
      .function("stop", &SynthesizerWrapper::stop)
      .function("replay", &SynthesizerWrapper::replay)
      .function("fadeout", &SynthesizerWrapper::fadeout)
      .function("getTitle", &SynthesizerWrapper::getTitle)
      .function("getTitleBytes", &SynthesizerWrapper::getTitleBytes)
      .function("setChannelMask", &SynthesizerWrapper::setChannelMask)
      .function("getChannelMask", &SynthesizerWrapper::getChannelMask)
      // MIDI support
      .function("setOpmReg", &SynthesizerWrapper::setOpmReg)
      .function("midiKeyOn", &SynthesizerWrapper::midiKeyOn)
      .function("midiKeyOff", &SynthesizerWrapper::midiKeyOff)
  ;
}
