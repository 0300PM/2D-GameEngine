cmake_minimum_required(VERSION 3.20)
project(browser2d_core CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(B2D_CORE_BUILD_TESTS "Build native core tests" ON)
option(B2D_CORE_BUILD_BENCH "Build native core benchmark" ON)
option(B2D_CORE_BUILD_EXAMPLES "Build the native core example" ON)

add_library(core STATIC
  src/bindings.cpp
  src/pathfinding.cpp
)

target_include_directories(core PUBLIC include)
target_compile_features(core PUBLIC cxx_std_23)

if(MSVC)
  target_compile_options(core PRIVATE /W4 /permissive-)
else()
  target_compile_options(core PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(EMSCRIPTEN)
  target_link_options(core PUBLIC
    "-sWASM=1"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sMODULARIZE=1"
    "-sEXPORT_ES6=1"
    "-sEXPORT_NAME=createB2DCore"
    "-sENVIRONMENT=web,worker,node"
    "-sEXPORTED_FUNCTIONS=['_malloc','_free']"
    "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF64','HEAPU32','HEAPU16']"
  )
  add_executable(core_wasm src/wasm_bindings.cpp)
  target_link_libraries(core_wasm PRIVATE core)
  set_target_properties(core_wasm PROPERTIES OUTPUT_NAME "core")
  install(TARGETS core_wasm RUNTIME DESTINATION ".")
endif()

if(B2D_CORE_BUILD_TESTS)
  enable_testing()
  add_executable(test_core tests/test_core.cpp)
  target_link_libraries(test_core PRIVATE core)
  add_test(NAME core COMMAND test_core)
  add_executable(test_scene tests/test_scene.cpp)
  target_link_libraries(test_scene PRIVATE core)
  add_test(NAME scene COMMAND test_scene)
endif()

if(B2D_CORE_BUILD_EXAMPLES)
  add_executable(b2d_native_example ${CMAKE_CURRENT_SOURCE_DIR}/../../examples/native-core/native/main.cpp)
  target_link_libraries(b2d_native_example PRIVATE core)
endif()

if(B2D_CORE_BUILD_BENCH)
  add_executable(bench_core bench/bench_core.cpp)
  target_link_libraries(bench_core PRIVATE core)
endif()
