#include "b2d/core/component.hpp"
#include "b2d/core/engine_loop.hpp"
#include "b2d/core/math.hpp"
#include "b2d/core/scene.hpp"
#include "b2d/core/world.hpp"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <vector>

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
  std::printf("FAIL %s (%.9f != %.9f)\n", label, actual, expected);
}

using b2d::core::ComponentPhase;
using b2d::core::nullObject;
using b2d::core::ObjectId;
using b2d::core::Scene;
using b2d::core::SceneManager;
using b2d::core::SceneSchedule;
using b2d::core::Transform;

std::vector<std::uint32_t> ids(std::initializer_list<std::uint32_t> values) { return std::vector<std::uint32_t>(values); }

void testSchedule() {
  SceneSchedule schedule;
  schedule.add(1, ComponentPhase::Physics, 0, 1);
  schedule.add(2, ComponentPhase::Input, 5, 2);
  schedule.add(3, ComponentPhase::Render, 0, 3);
  schedule.add(4, ComponentPhase::Behavior, -1, 4);

  expect(schedule.size() == 4, "schedule.size");
  expect(schedule.ordered() == ids({2, 4, 1, 3}), "schedule.phaseOrder");
  expect(schedule.phase(ComponentPhase::Behavior) == ids({4}), "schedule.phase.behavior");
  expect(!schedule.dirty(), "schedule.cleanAfterSort");

  const auto revision = schedule.revision();
  schedule.setOrder(4, 1);
  expect(schedule.revision() == revision + 1, "schedule.revision.setOrder");
  expect(schedule.ordered() == ids({2, 4, 1, 3}), "schedule.orderUnchanged");

  schedule.setOrder(4, 10);
  expect(schedule.ordered() == ids({2, 1, 4, 3}), "schedule.reorder");
  schedule.setOrder(1, -100);
  expect(schedule.ordered() == ids({2, 1, 4, 3}), "schedule.reorderPhysics");
  schedule.setOrder(4, -1);
  expect(schedule.ordered() == ids({2, 4, 1, 3}), "schedule.restore");

  schedule.setPhase(2, ComponentPhase::Render);
  expect(schedule.ordered() == ids({4, 1, 3, 2}), "schedule.rephase");

  expect(schedule.has(4), "schedule.has");
  schedule.remove(4);
  expect(!schedule.has(4), "schedule.removed");
  expect(schedule.size() == 3, "schedule.sizeAfterRemove");
  expect(schedule.ordered() == ids({1, 3, 2}), "schedule.orderAfterRemove");

  schedule.add(4, ComponentPhase::Input, 0, 9);
  expect(schedule.ordered() == ids({4, 1, 3, 2}), "schedule.reAdd");

  schedule.clear();
  expect(schedule.size() == 0 && schedule.ordered().empty(), "schedule.clear");
}

void testWorld() {
  b2d::core::World world(4);
  const ObjectId root = world.spawn(nullObject, Transform{10.0, 5.0, 0.0, 1.0, 1.0}, true);
  const ObjectId child = world.spawn(root, Transform{20.0, 0.0, 0.0, 1.0, 1.0}, true);
  expect(world.count() == 2, "world.count");
  expectNear(world.world(child).x, 30.0, 1e-9, "world.child.x");

  world.translate(child, 1.0, 2.0);
  expectNear(world.world(child).x, 31.0, 1e-9, "world.translate.child.x");
  expectNear(world.world(child).y, 7.0, 1e-9, "world.translate.child.y");

  world.setActive(root, false);
  expect(!world.activeInHierarchy(child), "world.deactivate.child");
  world.setActive(root, true);
  expect(world.activeInHierarchy(child), "world.reactivate.child");

  world.addTag(child, 7);
  expect(world.hasTag(child, 7), "world.tag");
  expect(world.destroy(root), "world.destroy");
  expect(world.count() == 0, "world.destroy.cascade");
}

void testScene() {
  Scene scene(7, 1280, 720);
  const ObjectId player = scene.createObject(nullObject, Transform{32.0, 32.0, 0.0, 1.0, 1.0}, true);
  const ObjectId enemy = scene.createObject(nullObject, Transform{64.0, 32.0, 0.0, 1.0, 1.0}, true);

  scene.addComponent(1, player, ComponentPhase::Physics, 0);
  scene.addComponent(2, player, ComponentPhase::Input, 5);
  scene.addComponent(3, enemy, ComponentPhase::Render, 0);
  scene.addComponent(4, enemy, ComponentPhase::Behavior, -1);

  expect(scene.componentOrder() == ids({2, 4, 1, 3}), "scene.componentOrder.initial");
  scene.setComponentOrder(4, 10);
  expect(scene.componentOrder() == ids({2, 1, 4, 3}), "scene.componentOrder.reorder");
  scene.setComponentOrder(4, -1);
  expect(scene.componentOrder() == ids({2, 4, 1, 3}), "scene.componentOrder.restore");
  scene.addComponent(1, player, ComponentPhase::Physics, 0);
  expect(scene.componentOrder() == ids({2, 4, 1, 3}), "scene.componentOrder.idempotent");

  scene.queueDestroy(enemy);
  expect(scene.world().count() == 2, "scene.queueDestroy.deferred");
  scene.step();
  expect(scene.world().count() == 1, "scene.queueDestroy.flushed");
  expect(scene.componentOrder() == ids({2, 1}), "scene.componentOrder.afterDestroy");

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
  scenes.registerScene(1, 320, 240);
  scenes.registerScene(2, 640, 480);
  expect(scenes.size() == 2, "manager.size");
  expect(scenes.start(1), "manager.start");
  expect(scenes.activeId() == 1u, "manager.active");
  Scene* first = scenes.get(1);
  if (first != nullptr) first->createObject(nullObject, Transform{1.0, 1.0, 0.0, 1.0, 1.0}, true);
  expect(scenes.start(2), "manager.switch");
  expect(scenes.get(1) != nullptr && scenes.get(1)->world().count() == 0, "manager.clearsPrevious");
  expect(scenes.stop(2), "manager.stop");
  expect(scenes.activeId() == 0u, "manager.stopped");
}

}

int main() {
  testSchedule();
  testWorld();
  testScene();
  testSceneManager();

  if (failures == 0) {
    std::printf("b2d-scene: all checks passed\n");
    return 0;
  }
  std::printf("b2d-scene: %d check(s) failed\n", failures);
  return 1;
}
