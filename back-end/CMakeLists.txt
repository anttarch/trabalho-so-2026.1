cmake_minimum_required(VERSION 3.15)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
file(CREATE_LINK
    "${CMAKE_BINARY_DIR}/compile_commands.json"
    "${CMAKE_SOURCE_DIR}/compile_commands.json"
    SYMBOLIC
)

project(back-end CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(server server.cc)

include(FetchContent)
FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG        v0.48.0
    GIT_SHALLOW    TRUE
)

FetchContent_MakeAvailable(httplib)
target_link_libraries(server PRIVATE httplib::httplib)

find_package(nlohmann_json 3.12.0 REQUIRED)
target_link_libraries(server PRIVATE nlohmann_json::nlohmann_json)

find_package(Threads REQUIRED)
target_link_libraries(server PRIVATE Threads::Threads)
