#include "b2d/core/math.hpp"
#include "b2d/core/random.hpp"
#include "b2d/core/scene.hpp"
#include "b2d/core/time.hpp"

#include <chrono>
#include <functional>
#include <cstdint>
#include <cstdio>
#include <vector>

namespace {

using b2d::core::ObjectId;
using b2d::core::Scene;
using b2d::core::Transform;

using Clock = std::chrono::steady_clock;

double measure(const std::function<void()>& body) {
  const auto started = Clock::now();
  body();
  return std::chrono::duration<double, std::milli>(Clock::now() - started).count();
}

void report(const char* name, double milliseconds, std::uint64_t operations) {
  const double perSecond = milliseconds > 0.0 ? static_cast<double>(operations) / (milliseconds / 1000.0) : 0.0;
  std::printf("%-28s %10.3f ms %14.0f ops/s\n", name, milliseconds, perSecond);
}

}

int main() {
  constexpr std::uint32_t objectCount = 20000;
  constexpr std::uint32_t frames = 600;
  constexpr std::uint32_t randomCount = 5000000;

  double timeMs = measure([] {
    b2d::core::Time time(0.1);
    time.setFixedStep(60.0, 5);
    for (int frame = 0; frame < 2000000; ++frame) {
      time.update(16.6667);
      while (time.consumeFixedStep()) {
      }
    }
  });
  report("time.update", timeMs, 2000000);

  double randomMs = measure([] {
    b2d::core::Random random(1337);
    double total = 0.0;
    for (std::uint32_t index = 0; index < randomCount; ++index) total += random.next();
    if (total < 0.0) std::printf("unreachable\n");
  });
  report("random.next", randomMs, randomCount);

  Scene scene(1, 4096, 4096);
  std::vector<ObjectId> objects;
  objects.reserve(objectCount);
  double spawnMs = measure([&] {
    for (std::uint32_t index = 0; index < objectCount; ++index) {
      objects.push_back(scene.createObject(b2d::core::nullObject,
                                           Transform{static_cast<double>(index % 512), static_cast<double>(index / 512), 0.0, 1.0, 1.0},
                                           true));
    }
  });
  report("scene.spawn", spawnMs, objectCount);

  double transformMs = measure([&] {
    for (std::uint32_t frame = 0; frame < frames; ++frame) {
      for (std::uint32_t index = 0; index < objectCount; index += 16) {
        scene.world().translate(objects[index], 0.5, 0.25);
        (void)scene.world().world(objects[index]);
      }
    }
  });
  report("world.translate+world", transformMs, static_cast<std::uint64_t>(frames) * (objectCount / 16));

  double tickMs = measure([&] {
    for (std::uint32_t frame = 0; frame < frames; ++frame) scene.step();
  });
  report("scene.step", tickMs, frames);

  for (std::uint32_t index = 0; index < objectCount; index += 2) {
    scene.addComponent(index + 1, objects[index], b2d::core::ComponentPhase::Behavior, static_cast<int>(index % 7));
  }
  double orderMs = measure([&] {
    for (int iteration = 0; iteration < 1000; ++iteration) {
      scene.setComponentOrder(1, iteration % 5);
      (void)scene.componentOrder();
    }
  });
  report("component.order", orderMs, 1000);

  double destroyMs = measure([&] { scene.world().destroy(objects.front()); });
  report("world.destroy.root", destroyMs, 1);

  std::printf("objects remaining: %zu\n", scene.world().count());
  return 0;
}
