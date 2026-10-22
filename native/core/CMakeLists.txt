cmake_minimum_required(VERSION 3.20)
project(browser2d_core CXX)
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

add_library(core STATIC
  src/pathfinding.cpp
)

target_include_directories(core PUBLIC include)

if(EMSCRIPTEN)
  set_target_properties(core PROPERTIES LINK_FLAGS "-s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_FUNCTIONS=['_malloc','_free'] -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']")
  add_executable(core_wasm src/wasm_bindings.cpp)
  target_link_libraries(core_wasm core)
endif()

enable_testing()
add_executable(test_pathfinding tests/test_pathfinding.cpp)
target_link_libraries(test_pathfinding core)
add_test(NAME pathfinding COMMAND test_pathfinding)
