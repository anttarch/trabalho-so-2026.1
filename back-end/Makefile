ifeq ($(OS),Windows_NT)
ifneq ($(strip $(MSYSTEM)$(MINGW_PREFIX)),)
BUILD_DIR = build/mingw
CMAKE_BUILD_FLAGS =
SERVER_BIN = $(firstword $(wildcard $(BUILD_DIR)/server.exe $(BUILD_DIR)/Debug/server.exe) $(BUILD_DIR)/server.exe)
else
BUILD_DIR = build/msvc
CMAKE_BUILD_FLAGS = --config Debug
SERVER_BIN = $(firstword $(wildcard $(BUILD_DIR)/Debug/server.exe $(BUILD_DIR)/server.exe) $(BUILD_DIR)/Debug/server.exe)
endif
else
BUILD_DIR = build/linux
CMAKE_BUILD_FLAGS =
SERVER_BIN = $(BUILD_DIR)/server
endif

compile:
	cmake -E rm -rf $(BUILD_DIR)
	cmake -B $(BUILD_DIR) -S .
	cmake --build $(BUILD_DIR) $(CMAKE_BUILD_FLAGS)

run:
	$(SERVER_BIN)

all:
	$(MAKE) compile
	$(MAKE) run

clean:
	cmake -E rm -rf build server server.exe

