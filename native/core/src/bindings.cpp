#include "b2d/core/component.hpp"
#include "b2d/core/engine_loop.hpp"
#include "b2d/core/hash.hpp"
#include "b2d/core/math.hpp"
#include "b2d/core/random.hpp"
#include "b2d/core/scene.hpp"
#include "b2d/core/time.hpp"

#include <cstdint>
#include <memory>
#include <string>
#include <string_view>

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
#endif

namespace {

using namespace b2d::core;

constexpr std::size_t timeSlotCount = 8;
constexpr std::size_t randomSlotCount = 8;

struct Registry {
  Time time[timeSlotCount];
  Random random[randomSlotCount];
  SceneManager scenes;
  ObjectIndex index;
  std::vector<std::unique_ptr<EngineLoop>> loops;
  std::string scratch;
  std::string scratchUtf8;
  std::vector<std::uint32_t> output;
  std::vector<double> numbers;
};

Registry& registry() {
  static Registry instance;
  return instance;
}

Time* timeAt(std::uint32_t slot) noexcept { return slot < timeSlotCount ? &registry().time[slot] : nullptr; }
Random* randomAt(std::uint32_t slot) noexcept { return slot < randomSlotCount ? &registry().random[slot] : nullptr; }

void resetAll() {
  auto& state = registry();
  for (auto& time : state.time) time = Time();
  for (auto& random : state.random) random = Random();
  state.scenes.clear();
  state.index.clear();
  state.loops.clear();
  state.output.clear();
  state.numbers.clear();
}

}

extern "C" {

std::uint32_t b2d_abi_version() noexcept { return 1u; }

std::uint32_t b2d_fnv1a32(const char* text) noexcept {
  if (text == nullptr) return fnv1a32(std::string_view{});
  return fnv1a32(std::string_view{text});
}

std::uint32_t b2d_hex32(std::uint32_t value) {
  auto& scratch = registry().scratch;
  scratch = hex8(value);
  return static_cast<std::uint32_t>(scratch.size());
}

void b2d_reset() { resetAll(); }

double b2d_time_update(std::uint32_t slot, double rawDeltaMs) noexcept {
  auto* time = timeAt(slot);
  if (time == nullptr) return 0.0;
  time->update(rawDeltaMs);
  return time->deltaTime();
}

double b2d_time_get(std::uint32_t slot, std::uint32_t field) noexcept {
  auto* time = timeAt(slot);
  if (time == nullptr) return 0.0;
  switch (field) {
    case 0:
      return time->elapsed();
    case 1:
      return time->realElapsed();
    case 2:
      return time->deltaTime();
    case 3:
      return time->realDeltaTime();
    case 4:
      return time->rawDeltaTime();
    case 5:
      return time->timeScale();
    case 6:
      return time->fixedDelta();
    case 7:
      return time->fixedAlpha();
    case 8:
      return static_cast<double>(time->frame());
    case 9:
      return static_cast<double>(time->pendingFixedSteps());
    case 10:
      return time->paused() ? 1.0 : 0.0;
    case 11:
      return time->clamped() ? 1.0 : 0.0;
    default:
      return 0.0;
  }
}

void b2d_time_set_scale(std::uint32_t slot, double scale) noexcept {
  if (auto* time = timeAt(slot); time != nullptr) time->setTimeScale(scale);
}

void b2d_time_set_fixed_step(std::uint32_t slot, double hz, std::uint32_t maxSteps) noexcept {
  if (auto* time = timeAt(slot); time != nullptr) time->setFixedStep(hz, maxSteps);
}

void b2d_time_set_max_delta(std::uint32_t slot, double seconds) noexcept {
  if (auto* time = timeAt(slot); time != nullptr) time->setMaxDeltaTime(seconds);
}

void b2d_time_pause(std::uint32_t slot) noexcept {
  if (auto* time = timeAt(slot); time != nullptr) time->pause();
}

void b2d_time_resume(std::uint32_t slot) noexcept {
  if (auto* time = timeAt(slot); time != nullptr) time->resume();
}

void b2d_time_reset(std::uint32_t slot) noexcept {
  if (auto* time = timeAt(slot); time != nullptr) time->reset();
}

std::uint32_t b2d_time_consume_fixed(std::uint32_t slot, std::uint32_t limit) noexcept {
  auto* time = timeAt(slot);
  if (time == nullptr) return 0;
  std::uint32_t steps = 0;
  while (steps < limit && time->consumeFixedStep()) ++steps;
  return steps;
}

void b2d_random_seed(std::uint32_t slot, std::uint32_t seed) noexcept {
  if (auto* random = randomAt(slot); random != nullptr) *random = Random(seed);
}

void b2d_random_state(std::uint32_t slot, std::uint32_t state) noexcept {
  if (auto* random = randomAt(slot); random != nullptr) random->setState(state);
}

std::uint32_t b2d_random_get_state(std::uint32_t slot) noexcept {
  auto* random = randomAt(slot);
  return random == nullptr ? 0u : random->state();
}

void b2d_random_reset(std::uint32_t slot) noexcept {
  if (auto* random = randomAt(slot); random != nullptr) random->reset();
}

std::uint32_t b2d_random_fill(std::uint32_t slot, double* out, std::uint32_t count) noexcept {
  auto* random = randomAt(slot);
  if (random == nullptr || out == nullptr) return 0;
  for (std::uint32_t index = 0; index < count; ++index) out[index] = random->next();
  return count;
}

std::uint32_t b2d_random_skip(std::uint32_t slot, std::uint32_t count) noexcept {
  auto* random = randomAt(slot);
  if (random == nullptr) return 0;
  for (std::uint32_t index = 0; index < count; ++index) random->next();
  return count;
}

std::uint32_t b2d_random_fork(std::uint32_t slot, const char* salt, std::uint32_t length,
                             std::uint32_t target) noexcept {
  auto* random = randomAt(slot);
  auto* destination = randomAt(target);
  if (random == nullptr || destination == nullptr) return 0;
  const std::string_view key = salt == nullptr ? std::string_view{} : std::string_view{salt, length};
  *destination = random->fork(key);
  return destination->state();
}

std::uint32_t b2d_transform_compose(const double* parent, const double* local, double* out) noexcept {
  if (parent == nullptr || local == nullptr || out == nullptr) return 0;
  const Transform result = compose(Transform{parent[0], parent[1], parent[2], parent[3], parent[4]},
                                   Transform{local[0], local[1], local[2], local[3], local[4]});
  out[0] = result.x;
  out[1] = result.y;
  out[2] = result.rotation;
  out[3] = result.scaleX;
  out[4] = result.scaleY;
  return 1;
}

std::uint32_t b2d_scene_register(std::uint32_t sceneId, std::uint32_t width, std::uint32_t height) noexcept {
  registry().scenes.registerScene(sceneId, width, height);
  return sceneId;
}

std::uint32_t b2d_scene_start(std::uint32_t sceneId) noexcept { return registry().scenes.start(sceneId) ? 1u : 0u; }
std::uint32_t b2d_scene_stop(std::uint32_t sceneId) noexcept { return registry().scenes.stop(sceneId) ? 1u : 0u; }
std::uint32_t b2d_scene_active() noexcept { return registry().scenes.activeId(); }
std::uint32_t b2d_scene_count() noexcept { return static_cast<std::uint32_t>(registry().scenes.size()); }

std::uint32_t b2d_scene_resize(std::uint32_t sceneId, std::uint32_t width, std::uint32_t height) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  scene->resize(width, height);
  return 1;
}

std::uint32_t b2d_scene_create_object(std::uint32_t sceneId, std::uint32_t parent, const double* local, double active) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  const Transform transform =
      local == nullptr ? Transform{} : Transform{local[0], local[1], local[2], local[3], local[4]};
  return scene->createObject(parent, transform, active >= 0.5);
}

std::uint32_t b2d_scene_destroy_object(std::uint32_t sceneId, std::uint32_t objectId) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->destroyObject(objectId) ? 1u : 0u;
}

std::uint32_t b2d_scene_queue_destroy(std::uint32_t sceneId, std::uint32_t objectId) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  scene->queueDestroy(objectId);
  return 1;
}

std::uint32_t b2d_scene_flush_destroy(std::uint32_t sceneId) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return static_cast<std::uint32_t>(scene->flushDestroyQueue());
}

std::uint32_t b2d_scene_set_position(std::uint32_t sceneId, std::uint32_t objectId, double x, double y) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || !scene->world().alive(objectId)) return 0;
  scene->world().setPosition(objectId, x, y);
  return 1;
}

std::uint32_t b2d_scene_translate(std::uint32_t sceneId, std::uint32_t objectId, double dx, double dy) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || !scene->world().alive(objectId)) return 0;
  scene->world().translate(objectId, dx, dy);
  return 1;
}

std::uint32_t b2d_scene_set_active(std::uint32_t sceneId, std::uint32_t objectId, double active) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->world().setActive(objectId, active >= 0.5) ? 1u : 0u;
}

std::uint32_t b2d_scene_attach(std::uint32_t sceneId, std::uint32_t child, std::uint32_t parent) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->world().attach(child, parent) ? 1u : 0u;
}

std::uint32_t b2d_scene_detach(std::uint32_t sceneId, std::uint32_t child) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->world().detach(child) ? 1u : 0u;
}

std::uint32_t b2d_scene_world_position(std::uint32_t sceneId, std::uint32_t objectId, double* out) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || out == nullptr || !scene->world().alive(objectId)) return 0;
  const WorldEntry& entry = scene->world().world(objectId);
  out[0] = entry.x;
  out[1] = entry.y;
  out[2] = entry.rotation;
  out[3] = entry.scaleX;
  out[4] = entry.scaleY;
  return 1;
}

std::uint32_t b2d_scene_add_tag(std::uint32_t sceneId, std::uint32_t objectId, const char* tag) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || tag == nullptr || !scene->world().alive(objectId)) return 0;
  const std::uint32_t interned = registry().index.intern(tag);
  return scene->world().addTag(objectId, interned) ? 1u : 0u;
}

std::uint32_t b2d_scene_remove_tag(std::uint32_t sceneId, std::uint32_t objectId, const char* tag) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || tag == nullptr || !scene->world().alive(objectId)) return 0;
  const std::uint32_t interned = registry().index.intern(tag);
  return scene->world().removeTag(objectId, interned) ? 1u : 0u;
}

std::uint32_t b2d_scene_has_tag(std::uint32_t sceneId, std::uint32_t objectId, const char* tag) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || tag == nullptr || !scene->world().alive(objectId)) return 0;
  const std::uint32_t interned = registry().index.intern(tag);
  return scene->world().hasTag(objectId, interned) ? 1u : 0u;
}

std::uint32_t b2d_scene_object_count(std::uint32_t sceneId) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  return scene == nullptr ? 0u : static_cast<std::uint32_t>(scene->world().count());
}

std::uint32_t b2d_scene_active_objects(std::uint32_t sceneId) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  return scene == nullptr ? 0u : static_cast<std::uint32_t>(scene->world().visibleCount());
}

std::uint32_t b2d_scene_live_objects(std::uint32_t sceneId, std::uint32_t* out, std::uint32_t capacity) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || out == nullptr) return 0;
  const auto live = scene->world().live();
  const auto total = static_cast<std::uint32_t>(live.size());
  const std::uint32_t copied = total < capacity ? total : capacity;
  for (std::uint32_t index = 0; index < copied; ++index) out[index] = live[index];
  return total;
}

std::uint32_t b2d_scene_add_component(std::uint32_t sceneId, std::uint32_t componentId, std::uint32_t owner,
                                     std::uint32_t phase, std::int32_t order) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->addComponent(componentId, owner, static_cast<ComponentPhase>(phase & 7u), order);
}

std::uint32_t b2d_scene_remove_component(std::uint32_t sceneId, std::uint32_t componentId) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->removeComponent(componentId) ? 1u : 0u;
}

std::uint32_t b2d_scene_enable_component(std::uint32_t sceneId, std::uint32_t componentId, double enabled) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->setComponentEnabled(componentId, enabled >= 0.5) ? 1u : 0u;
}

std::uint32_t b2d_scene_set_component_phase(std::uint32_t sceneId, std::uint32_t componentId, std::uint32_t phase) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->setComponentPhase(componentId, static_cast<ComponentPhase>(phase & 7u)) ? 1u : 0u;
}

std::uint32_t b2d_scene_set_component_order(std::uint32_t sceneId, std::uint32_t componentId, std::int32_t order) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  return scene->setComponentOrder(componentId, order) ? 1u : 0u;
}

std::uint32_t b2d_scene_component_order(std::uint32_t sceneId, std::uint32_t* out, std::uint32_t capacity) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || out == nullptr) return 0;
  const auto order = scene->componentOrder();
  const auto total = static_cast<std::uint32_t>(order.size());
  const std::uint32_t copied = total < capacity ? total : capacity;
  for (std::uint32_t index = 0; index < copied; ++index) out[index] = order[index];
  return total;
}

std::uint32_t b2d_scene_phase_order(std::uint32_t sceneId, std::uint32_t phase, std::uint32_t* out,
                                    std::uint32_t capacity) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr || out == nullptr) return 0;
  const auto order = scene->phaseOrder(static_cast<ComponentPhase>(phase & 7u));
  const auto total = static_cast<std::uint32_t>(order.size());
  const std::uint32_t copied = total < capacity ? total : capacity;
  for (std::uint32_t index = 0; index < copied; ++index) out[index] = order[index];
  return total;
}

std::uint32_t b2d_scene_tick(std::uint32_t sceneId) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0;
  scene->step();
  return scene->ticks();
}

double b2d_scene_stat(std::uint32_t sceneId, std::uint32_t field) noexcept {
  Scene* scene = registry().scenes.get(sceneId);
  if (scene == nullptr) return 0.0;
  const auto& stats = scene->stats();
  switch (field) {
    case 0:
      return static_cast<double>(stats.objects);
    case 1:
      return static_cast<double>(stats.activeObjects);
    case 2:
      return static_cast<double>(stats.components);
    case 3:
      return static_cast<double>(stats.queuedDestroy);
    case 4:
      return stats.lastFrameMs;
    case 5:
      return static_cast<double>(scene->activeComponents());
    default:
      return 0.0;
  }
}

std::uint32_t b2d_loop_create(std::uint32_t sceneId, double maxDeltaTime, double fixedHz, std::uint32_t maxSteps) {
  registry().loops.push_back(std::make_unique<EngineLoop>(sceneId, maxDeltaTime, fixedHz, maxSteps));
  return static_cast<std::uint32_t>(registry().loops.size());
}

std::uint32_t b2d_loop_advance(std::uint32_t loopId, double rawDeltaMs) noexcept {
  auto& loops = registry().loops;
  if (loopId == 0 || loopId > loops.size()) return 0;
  const LoopFrame frame = loops[loopId - 1]->advance(registry().scenes, rawDeltaMs);
  return frame.fixedSteps;
}

double b2d_loop_stat(std::uint32_t loopId, std::uint32_t field) noexcept {
  auto& loops = registry().loops;
  if (loopId == 0 || loopId > loops.size()) return 0.0;
  const TimeState state = loops[loopId - 1]->state();
  switch (field) {
    case 0:
      return state.deltaTime;
    case 1:
      return state.elapsed;
    case 2:
      return state.realElapsed;
    case 3:
      return static_cast<double>(state.frame);
    case 4:
      return state.fixedAlpha;
    case 5:
      return state.paused ? 1.0 : 0.0;
    default:
      return 0.0;
  }
}

double* b2d_buffer(std::uint32_t capacity) {
  auto& numbers = registry().numbers;
  if (numbers.size() < capacity) numbers.resize(capacity);
  return numbers.data();
}

std::uint32_t b2d_scratch(const char* text, std::uint32_t length) {
  auto& scratch = registry().scratch;
  scratch.assign(text == nullptr ? "" : text, length);
  return static_cast<std::uint32_t>(scratch.size());
}

std::uint32_t b2d_write_utf8(const char* text, std::uint32_t length) noexcept {
  if (text == nullptr) return 0;
  std::uint32_t hash = 0x811c9dc5u;
  auto& scratch = registry().scratchUtf8;
  scratch.clear();
  for (std::uint32_t index = 0; index < length; ++index) {
    const std::uint32_t code = static_cast<std::uint8_t>(text[index]);
    scratch.push_back(text[index]);
    hash ^= code;
    hash *= 0x01000193u;
  }
  return hash;
}

std::uint32_t b2d_checksum_utf16(const std::uint16_t* units, std::uint32_t length) noexcept {
  if (units == nullptr) return 0x811c9dc5u;
  std::uint32_t hash = 0x811c9dc5u;
  for (std::uint32_t index = 0; index < length; ++index) {
    const std::uint16_t unit = units[index];
    hash ^= static_cast<std::uint8_t>(unit & 0xffu);
    hash *= 0x01000193u;
    hash ^= static_cast<std::uint8_t>(unit >> 8);
    hash *= 0x01000193u;
  }
  return hash;
}

std::uint32_t b2d_bench_scene(std::uint32_t objectCount, std::uint32_t frames) {
  auto& state = registry();
  Scene scene(1, 1920, 1080);
  std::vector<ObjectId> objects;
  objects.reserve(objectCount);
  for (std::uint32_t index = 0; index < objectCount; ++index) {
    const double x = static_cast<double>(index % 256);
    const double y = static_cast<double>(index / 256);
    objects.push_back(scene.createObject(nullObject, Transform{x, y, 0.0, 1.0, 1.0}, true));
  }
  for (std::uint32_t index = 0; index < objectCount; index += 8) {
    scene.world().setPosition(objects[index], static_cast<double>(index), static_cast<double>(index % 97));
  }
  for (std::uint32_t index = 0; index < objectCount; index += 4) {
    scene.world().setActive(objects[index], index % 8 != 0);
  }
  for (std::uint32_t frame = 0; frame < frames; ++frame) {
    scene.step();
    for (std::uint32_t index = 0; index < objectCount; index += 16) {
      scene.world().translate(objects[index], 0.5, 0.25);
    }
  }
  const auto created = scene.world().count();
  state.scenes.registerScene(1, 1920, 1080);
  return static_cast<std::uint32_t>(created);
}

}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(b2d_core) {
  emscripten::function("b2d_abi_version", &b2d_abi_version);
  emscripten::function("b2d_fnv1a32", &b2d_fnv1a32);
  emscripten::function("b2d_time_update", &b2d_time_update);
  emscripten::function("b2d_time_get", &b2d_time_get);
  emscripten::function("b2d_random_fill", &b2d_random_fill);
  emscripten::function("b2d_random_fork", &b2d_random_fork);
  emscripten::function("b2d_random_skip", &b2d_random_skip);
  emscripten::function("b2d_scene_create_object", &b2d_scene_create_object);
  emscripten::function("b2d_scene_world_position", &b2d_scene_world_position);
  emscripten::function("b2d_scene_component_order", &b2d_scene_component_order);
  emscripten::function("b2d_loop_advance", &b2d_loop_advance);
}
#endif
