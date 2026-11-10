#include "b2d/core/component.hpp"
#include "b2d/core/engine_loop.hpp"
#include "b2d/core/hash.hpp"
#include "b2d/core/math.hpp"
#include "b2d/core/random.hpp"
#include "b2d/core/scene.hpp"
#include "b2d/core/world.hpp"

#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

namespace {

using namespace b2d::core;

constexpr std::uint32_t sceneId = 1;
constexpr std::uint32_t width = 1280;
constexpr std::uint32_t height = 720;
constexpr std::uint32_t objects = 2048;
constexpr std::uint32_t frames = 600;
constexpr double fixedHz = 60.0;

}

int main() {
  SceneManager scenes;
  scenes.registerScene(sceneId, width, height);
  scenes.start(sceneId);
  Scene* scene = scenes.get(sceneId);
  if (scene == nullptr) return 1;

  Random random(1337);
  std::vector<ObjectId> ids;
  ids.reserve(objects);
  for (std::uint32_t index = 0; index < objects; ++index) {
    const double x = random.floatRange(0.0, static_cast<double>(width));
    const double y = random.floatRange(0.0, static_cast<double>(height));
    ids.push_back(scene->createObject(nullObject, Transform{x, y, 0.0, 1.0, 1.0}, true));
  }
  for (std::uint32_t index = 0; index < objects; ++index) {
    if (index % 8 != 0) continue;
    scene->world().attach(ids[index], ids[(index + 1) % objects]);
  }
  for (std::uint32_t index = 0; index < objects; ++index) {
    scene->addComponent(index + 1, ids[index],
                        static_cast<ComponentPhase>(index % 5u),
                        static_cast<int>(index % 11));
  }

  EngineLoop loop(sceneId, 0.1, fixedHz, 5);
  std::uint32_t fixedSteps = 0;
  std::uint32_t digest = 0x811c9dc5u;
  for (std::uint32_t frame = 0; frame < frames; ++frame) {
    fixedSteps += loop.advance(scenes, 1000.0 / fixedHz).fixedSteps;
    for (std::uint32_t index = 0; index < objects; index += 64) {
      const WorldEntry& entry = scene->world().world(ids[index]);
      const std::string sample = std::to_string(static_cast<long long>(entry.x * 1000.0)) + ":" +
                                 std::to_string(static_cast<long long>(entry.y * 1000.0));
      digest = fnv1a32(digest, sample);
    }
    for (std::uint32_t index = 0; index < objects; index += 128) {
      scene->world().translate(ids[index], 0.5, 0.25);
    }
  }

  const TimeState state = loop.state();
  std::printf(
      "{\"format\":\"b2d-native-example\",\"scene\":\"native-core\",\"frames\":%u,\"fixedSteps\":%u,"
      "\"objects\":%zu,\"elapsed\":%.3f,\"digest\":\"%s\"}\n",
      state.frame, fixedSteps, scene->world().count(), state.elapsed, hex8(digest).c_str());
  return 0;
}
