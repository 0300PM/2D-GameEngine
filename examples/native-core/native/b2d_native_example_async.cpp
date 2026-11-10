#include "b2d/core/engine_loop.hpp"
#include "b2d/core/hash.hpp"
#include "b2d/core/math.hpp"
#include "b2d/core/random.hpp"
#include "b2d/core/scene.hpp"
#include "b2d/core/time.hpp"
#include "b2d/core/world.hpp"

#include <cstdint>
#include <cstdio>
#include <exception>
#include <string>
#include <vector>

#if defined(__EMSCRIPTEN__)
#include <emscripten.h>
#define B2D_KEEPALIVE EMSCRIPTEN_KEEPALIVE
#else
#define B2D_KEEPALIVE
#endif

namespace {

using namespace b2d::core;

constexpr std::uint32_t sceneId = 7;
constexpr std::uint32_t width = 960;
constexpr std::uint32_t height = 540;
constexpr std::uint32_t objects = 256;
constexpr std::uint32_t frames = 120;
constexpr std::uint32_t batch = 32;
constexpr std::uint32_t rngDraws = 1024;
constexpr double fixedHz = 60.0;

struct Report {
  std::uint32_t frames = 0;
  std::uint32_t fixedSteps = 0;
  std::uint32_t objects = 0;
  std::uint32_t components = 0;
  double elapsed = 0.0;
  std::uint32_t digest = 0x811c9dc5u;
};

Report runAsync() {
  SceneManager scenes;
  scenes.registerScene(sceneId, width, height);
  scenes.start(sceneId);
  Scene* scene = scenes.get(sceneId);
  if (scene == nullptr) throw std::runtime_error("scene registration failed");

  Random random(20260101u);
  std::vector<ObjectId> ids;
  ids.reserve(objects);
  for (std::uint32_t index = 0; index < objects; ++index) {
    const double x = random.floatRange(0.0, static_cast<double>(width));
    const double y = random.floatRange(0.0, static_cast<double>(height));
    ids.push_back(scene->createObject(nullObject, Transform{x, y, 0.0, 1.0, 1.0}, index % 16 != 0));
  }
  for (std::uint32_t index = 0; index < objects; ++index) {
    if (index % 4 != 0) continue;
    scene->world().attach(ids[index], ids[(index + 1) % objects]);
  }
  for (std::uint32_t index = 0; index < objects; ++index) {
    scene->addComponent(index + 1, ids[index], static_cast<ComponentPhase>(index % 5u), static_cast<int>(index % 7));
  }

  EngineLoop loop(sceneId, 0.1, fixedHz, 5);
  const std::vector<double> noise = random.sample(rngDraws);
  Report report;
  for (std::uint32_t frame = 0; frame < frames; ++frame) {
    report.fixedSteps += loop.advance(scenes, 1000.0 / fixedHz).fixedSteps;
    for (std::uint32_t index = 0; index < objects; index += batch) {
      const WorldEntry& entry = scene->world().world(ids[index]);
      const std::string sample = std::to_string(static_cast<long long>(entry.x * 100.0)) + ":" +
                                 std::to_string(static_cast<long long>(entry.y * 100.0));
      report.digest = fnv1a32(report.digest, sample);
    }
    for (std::uint32_t index = 0; index < rngDraws; index += batch) {
      report.digest = fnv1a32(report.digest, hex8(static_cast<std::uint32_t>(noise[index] * 4294967296.0)));
    }
    if (frame % 24 == 0) {
      for (std::uint32_t index = 0; index < objects; index += 32) scene->world().translate(ids[index], 0.25, 0.5);
    }
  }

  const TimeState state = loop.state();
  report.frames = state.frame;
  report.objects = static_cast<std::uint32_t>(scene->world().count());
  report.components = static_cast<std::uint32_t>(scene->stats().components);
  report.elapsed = state.elapsed;
  return report;
}

}

extern "C" {

B2D_KEEPALIVE const char* b2d_example_async_name() noexcept { return "native-core-async"; }

B2D_KEEPALIVE const char* b2d_example_async_run() {
  static std::string output;
  try {
    const Report report = runAsync();
    output = "{\"format\":\"b2d-native-example\",\"scene\":\"native-core-async\",\"frames\":" +
             std::to_string(report.frames) + ",\"fixedSteps\":" + std::to_string(report.fixedSteps) +
             ",\"objects\":" + std::to_string(report.objects) + ",\"components\":" + std::to_string(report.components) +
             ",\"elapsed\":" + std::to_string(report.elapsed) + ",\"digest\":\"" + hex8(report.digest) + "\"}";
  } catch (const std::exception& error) {
    output = std::string("{\"format\":\"b2d-native-example\",\"scene\":\"native-core-async\",\"error\":\"") + error.what() + "\"}";
  }
  return output.c_str();
}

}

#if !defined(__EMSCRIPTEN__)
int main() {
  std::printf("%s\n", b2d_example_async_run());
  return 0;
}
#endif
