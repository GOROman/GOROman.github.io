#
# Makefile
#

TARGET = simple_mdx_player

TARGET_FILE = $(TARGET)

DIR_ROOT = ../src/portable_mdx
DIR_MXDRV = $(DIR_ROOT)/src/mxdrv/
DIR_UTIL = $(DIR_ROOT)/src/
DIR_X68SOUND = $(DIR_ROOT)/src/x68sound/
DIR_INCLUDE = $(DIR_ROOT)/include

SRC_MXDRV = mxdrv.cpp mxdrv_context.cpp sound_iocs.cpp
SRC_X68SOUND = x68sound_adpcm.cpp x68sound_lfo.cpp x68sound_op.cpp 
SRC_X68SOUND += x68sound_opm.cpp x68sound_pcm8.cpp x68sound.cpp x68sound_context.cpp
SRC_UTIL = mdx_util.c
SRC_MAIN = 

SRCS = $(addprefix $(DIR_MXDRV),$(SRC_MXDRV))
SRCS += $(addprefix $(DIR_X68SOUND),$(SRC_X68SOUND))
SRCS += $(addprefix $(DIR_UTIL),$(SRC_UTIL))
SRCS += $(SRC_MAIN)


all : $(TARGET_DIR) $(TARGET)

clean : 


$(TARGET) : 
		emcc \
		-I $(DIR_INCLUDE) -I/usr/local/include/  \
		-s USE_SDL=2 \
		-Wno-tautological-constant-out-of-range-compare \
		-O3 \
		-o index.html \
		--embed-file mdxdir@ \
		--shell-file shell_minimal.html \
		$(SRCS) main.cpp
