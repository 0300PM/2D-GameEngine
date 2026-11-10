#include "b2d/core/component.hpp"
#include "b2d/core/engine_loop.hpp"
#include "b2d/core/math.hpp"
#include "b2d/core/scene.hpp"
#include "b2d/core/world.hpp"

#include <cmath>
#include <cstdio>

namespace {

int failures = 0;

void expect(bool condition, const char* label) {
  if (condition) return;
  ++failures;
  std::printf("FAIL %s\n", label);
}

void expectNear(double actual, double expected, double tolerance, const char* label) {
  if (std::fabs(actual - expected) <= tolerance) return;
  ++failures;
  std::printf("FAIL %s: got %.17g expected %.17g\n", label, actual, expected);
}

using namespace b2d::core;

void testWorld() {
  World world;
  const ObjectId root = world.spawn(nullObject, Transform{100.0, 50.0, 0.0, 1.0, 1.0}, true);
  const ObjectId child = world.spawn(root, Transform{10.0, 0.0, 0.0, 1.0, 1.0}, true);
  expect(world.count() == 2, "world.count");
  expectNear(world.world(child).x, 110.0, 1e-9, "world.child.x");

  world.setRotation(root, b2d::core::pi / 2.0);
  world.world(root);
  const auto& entry = world.world(child);
  expectNear(entry.x, 100.0, 1e-9, "world.rotated.x");
  expectNear(entry.y, 60.0, 1e-9, "world.rotated.y");

  world.setActive(child, false);
  expect(world.activeInHierarchy(child) == false, "world.deactivate");
  world.setActive(child, true);
  expect(world.activeInHierarchy(child) == true, "world.activate");

  const ObjectId grandChild = world.spawn(child, Transform{}, true);
  expect(world.attach(root, grandChild) == false, "world.cycle");
  expect(world.destroy(root), "world.destroy");
  expect(world.count() == 0, "world.destroy.cascade");
  expect(world.alive(grandChild) == false, "world.destroy.grandchild");
}

void testScene() {
  Scene scene(7, 1280, 720);
  const ObjectId player = scene.createObject(nullObject, Transform{32.0, 32.0, 0.0, 1.0, 1.0}, true);
  const ObjectId enemy = scene.createObject(nullObject, Transform{64.0, 32.0, 0.0, 1.0, 1.0}, true);

  scene.addComponent(1, player, ComponentPhase::Physics, 0);
  scene.addComponent(2, player, ComponentPhase::Input, 5);
  scene.addComponent(3, enemy, ComponentPhase::Render, 0);
  scene.addComponent(4, enemy, ComponentPhase::Behavior, -1);

  const auto order = scene.componentOrder();
  expect(order.size() == 4, "scene.componentOrder.size");
  expect(order[0] == 2u, "scene.componentOrder.input");
  expect(order[1] == 4u, "scene.componentOrder.behavior");
  expect(order[2] == 1u, "scene.componentOrder.physics");
  expect(order[3] == 3u, "scene.componentOrder.render");

  scene.setComponentOrder(4, 10);
  const auto reordered = scene.componentOrder();
  expect(reordered[1] == 1u && reordered[2] == 4u, "scene.componentOrder.reorder");

  scene.queueDestroy(enemy);
  expect(scene.world().count() == 2, "scene.queueDestroy.deferred");
  scene.step();
  expect(scene.world().count() == 1, "scene.queueDestroy.flushed");

  scene.world().setPosition(player, 400.0, 300.0);
  expectNear(scene.world().world(player).x, 400.0, 1e-9, "scene.position");
  scene.world().translate(player, 5.0, -5.0);
  expectNear(scene.world().world(player).y, 295.0, 1e-9, "scene.translate");

  scene.world().addTag(player, 11);
  expect(scene.world().hasTag(player, 11), "scene.tag.add");
  expect(scene.world().removeTag(player, 11), "scene.tag.remove");

  scene.step();
  expect(scene.stats().objects == 1, "scene.stats.objects");
}

void testSceneManager() {
  SceneManager scenes;
  scenes.registerScene(1, 800, 600);
  scenes.registerScene(2, 640, 480);
  expect(scenes.size() == 2, "manager.size");
  expect(scenes.start(1), "manager.start");
  expect(scenes.activeId() == 1u, "manager.active");
  Scene* menu = scenes.get(1);
  expect(menu != nullptr, "manager.get");
  menu->createObject(nullObject, Transform{}, true);
  expect(scenes.start(2), "manager.switch");
  expect(menu->world().count() == 0, "manager.previous.cleared");
  expect(scenes.stop(2), "manager.stop");
  expect(scenes.activeId() == 0u, "manager.stopped.active");
}

void testLoop() {
  SceneManager scenes;
  scenes.registerScene(1, 800, 600);
  scenes.start(1);
  EngineLoop loop(1, 0.1, 60.0, 5);
  int totalSteps = 0;
  for (int frame = 0; frame < 60; ++frame) {
    totalSteps += static_cast<int>(loop.advance(scenes, 16.6667).fixedSteps);
  }
  expect(totalSteps >= 58 && totalSteps <= 62, "loop.fixedSteps");
  expect(loop.state().frame == 60u, "loop.frames");
  expectNear(loop.state().elapsed, 1.0, 0.01, "loop.elapsed");
}

}

int main() {
  testWorld();
  testScene();
  testSceneManager();
  testLoop();
  if (failures == 0) {
    std::printf("b2d-scene: all checks passed\n");
    return 0;
  }
  std::printf("b2d-scene: %d check(s) failed\n", failures);
  return 1;
}
