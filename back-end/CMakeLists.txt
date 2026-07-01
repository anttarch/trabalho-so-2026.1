cmake_minimum_required(VERSION 3.15)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT WIN32)
    file(CREATE_LINK
        "${CMAKE_BINARY_DIR}/compile_commands.json"
        "${CMAKE_SOURCE_DIR}/compile_commands.json"
        SYMBOLIC
    )
endif()

project(back-end CXX)

# Padrão em C++20 para suportar recursos usados no código (ex.: inicializadores designados: {.campo = valor}).
# Observação: compilar com C++17 não é suportado sem ajustar o código para remover esses recursos.
set(BACKEND_CXX_STANDARD 20 CACHE STRING "C++ standard used to build the backend")
set_property(CACHE BACKEND_CXX_STANDARD PROPERTY STRINGS 17 20)
set(CMAKE_CXX_STANDARD ${BACKEND_CXX_STANDARD})
set(CMAKE_CXX_STANDARD_REQUIRED ON)

file(GLOB SOURCES
    */*.h
    */*.cc
)

add_executable(server server.cc ${SOURCES})
set_target_properties(server PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
)

include(FetchContent)

# O Visual Studio não deve absorver headers/libs do MSYS2, porque isso mistura
# o runtime do MinGW com o toolchain do MSVC e quebra a compilação no Windows.
if(WIN32)
    set(HTTPLIB_USE_ZSTD_IF_AVAILABLE OFF CACHE BOOL "" FORCE)
    set(HTTPLIB_REQUIRE_ZSTD OFF CACHE BOOL "" FORCE)
endif()

# O build com MinGW no Windows não expõe GetAddrInfoExCancel de forma confiável,
# então o caminho non-blocking do httplib precisa ficar desligado nesse caso.
if(MINGW)
    set(HTTPLIB_USE_NON_BLOCKING_GETADDRINFO OFF CACHE BOOL "" FORCE)
endif()

FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG        v0.48.0
    GIT_SHALLOW    TRUE
)

FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG        v3.12.0
    GIT_SHALLOW    TRUE
)

FetchContent_MakeAvailable(httplib nlohmann_json)

target_link_libraries(server PRIVATE
    httplib::httplib
    nlohmann_json::nlohmann_json
)

find_package(Threads REQUIRED)
target_link_libraries(server PRIVATE Threads::Threads)
if(UNIX)
    target_link_libraries(server PRIVATE m)
endif()
