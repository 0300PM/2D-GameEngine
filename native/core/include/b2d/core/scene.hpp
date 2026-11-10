#pragma once

#include "b2d/core/component.hpp"
#include "b2d/core/math.hpp"
#include "b2d/core/world.hpp"

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace b2d::core {

struct SceneStats {
  std::size_t objects = 0;
  std::size_t activeObjects = 0;
  std::size_t components = 0;
  std::size_t componentsDirty = 0;
  std::size_t queuedDestroy = 0;
  std::size_t pendingFixedSteps = 0;
  double lastFrameMs = 0.0;
};

class Scene {
 public:
  Scene(std::uint32_t id, std::uint32_t width, std::uint32_t height)
      : id_(id), width_(width), height_(height), world_(64), schedule_() {}

  [[nodiscard]] std::uint32_t id() const noexcept { return id_; }
  [[nodiscard]] std::uint32_t width() const noexcept { return width_; }
  [[nodiscard]] std::uint32_t height() const noexcept { return height_; }
  [[nodiscard]] World& world() noexcept { return world_; }
  [[nodiscard]] const World& world() const noexcept { return world_; }
  [[nodiscard]] SceneSchedule& schedule() noexcept { return schedule_; }
  [[nodiscard]] const SceneStats& stats() const noexcept { return stats_; }
  [[nodiscard]] SceneStats& stats() noexcept { return stats_; }
  [[nodiscard]] std::uint32_t ticks() const noexcept { return ticks_; }

  void resize(std::uint32_t width, std::uint32_t height) noexcept {
    width_ = width;
    height_ = height;
  }

  [[nodiscard]] ObjectId createObject(ObjectId parent, const Transform& local, bool active) {
    return world_.spawn(parent, local, active);
  }

  [[nodiscard]] bool destroyObject(ObjectId id) { return world_.destroy(id); }

  void queueDestroy(ObjectId id) {
    if (id == nullObject) return;
    for (const auto queued : destroyQueue_) {
      if (queued == id) return;
    }
    destroyQueue_.push_back(id);
    stats_.queuedDestroy = destroyQueue_.size();
  }

  [[nodiscard]] std::size_t flushDestroyQueue() {
    std::size_t destroyed = 0;
    for (const auto id : destroyQueue_) {
      if (world_.destroy(id)) ++destroyed;
    }
    destroyQueue_.clear();
    stats_.queuedDestroy = 0;
    return destroyed;
  }

  [[nodiscard]] std::uint32_t addComponent(std::uint32_t componentId, ObjectId owner, ComponentPhase phase, int order) {
    const auto sequence = registry_.attach(componentId, owner, phase, order);
    schedule_.add(componentId, phase, order, sequence);
    schedule_.ordered();
    stats_.components = schedule_.size();
    return sequence;
  }

  [[nodiscard]] bool removeComponent(std::uint32_t componentId) {
    const bool removed = registry_.detach(componentId);
    if (removed) schedule_.remove(componentId);
    stats_.components = schedule_.size();
    return removed;
  }

  [[nodiscard]] bool setComponentEnabled(std::uint32_t componentId, bool enabled) {
    return registry_.setEnabled(componentId, enabled);
  }

  [[nodiscard]] bool setComponentPhase(std::uint32_t componentId, ComponentPhase phase) {
    schedule_.setPhase(componentId, phase);
    return registry_.setPhase(componentId, phase);
  }

  [[nodiscard]] bool setComponentOrder(std::uint32_t componentId, int order) {
    schedule_.setOrder(componentId, order);
    return registry_.setOrder(componentId, order);
  }

  [[nodiscard]] const ComponentRegistry& registry() const noexcept { return registry_; }

  [[nodiscard]] std::vector<std::uint32_t> componentOrder() { return schedule_.ordered(); }

  [[nodiscard]] std::vector<std::uint32_t> phaseOrder(ComponentPhase phase) {
    const auto& ordered = schedule_.ordered();
    std::vector<std::uint32_t> out;
    out.reserve(ordered.size());
    for (const auto componentId : ordered) {
      const auto* slot = registry_.find(componentId);
      if (slot != nullptr && slot->enabled && slot->phase == phase) out.push_back(componentId);
    }
    return out;
  }

  [[nodiscard]] std::size_t activeComponents() const noexcept {
    std::size_t total = 0;
    for (const auto& slot : registry_.slots) {
      if (!slot.enabled || !world_.activeInHierarchy(slot.owner)) continue;
      ++total;
    }
    return total;
  }

  void markDirty() noexcept { stats_.componentsDirty += 1; }

  [[nodiscard]] bool step() noexcept {
    const auto started = clock::now();
    ++ticks_;
    flushDestroyQueue();
    stats_.objects = world_.count();
    stats_.activeObjects = world_.visibleCount();
    stats_.components = schedule_.size();
    stats_.lastFrameMs = std::chrono::duration<double, std::milli>(clock::now() - started).count();
    return true;
  }

  void clear() noexcept {
    world_.clear();
    registry_.clear();
    schedule_.clear();
    destroyQueue_.clear();
    stats_ = SceneStats{};
    ticks_ = 0;
  }

 private:
  using clock = std::chrono::steady_clock;

  std::uint32_t id_;
  std::uint32_t width_;
  std::uint32_t height_;
  World world_;
  ComponentRegistry registry_;
  SceneSchedule schedule_;
  std::vector<ObjectId> destroyQueue_;
  SceneStats stats_{};
  std::uint32_t ticks_ = 0;
};

class SceneManager {
 public:
  [[nodiscard]] Scene& registerScene(std::uint32_t id, std::uint32_t width, std::uint32_t height) {
    for (auto& scene : scenes_) {
      if (scene->id() == id) return *scene;
    }
    scenes_.push_back(std::make_unique<Scene>(id, width, height));
    return *scenes_.back();
  }

  [[nodiscard]] Scene* get(std::uint32_t id) noexcept {
    for (auto& scene : scenes_) {
      if (scene->id() == id) return scene.get();
    }
    return nullptr;
  }

  [[nodiscard]] bool start(std::uint32_t id) {
    Scene* target = get(id);
    if (target == nullptr) return false;
    if (active_ != 0u && active_ != id) {
      if (Scene* previous = get(active_); previous != nullptr) previous->clear();
    }
    active_ = id;
    return true;
  }

  [[nodiscard]] bool stop(std::uint32_t id) {
    Scene* target = get(id);
    if (target == nullptr) return false;
    target->clear();
    if (active_ == id) active_ = 0u;
    return true;
  }

  [[nodiscard]] std::uint32_t activeId() const noexcept { return active_; }
  [[nodiscard]] Scene* active() noexcept { return active_ == 0u ? nullptr : get(active_); }
  [[nodiscard]] std::size_t size() const noexcept { return scenes_.size(); }
  [[nodiscard]] std::vector<std::uint32_t> ids() const {
    std::vector<std::uint32_t> out;
    out.reserve(scenes_.size());
    for (const auto& scene : scenes_) out.push_back(scene->id());
    return out;
  }

  void clear() noexcept {
    scenes_.clear();
    active_ = 0u;
  }

 private:
  std::vector<std::unique_ptr<Scene>> scenes_;
  std::uint32_t active_ = 0u;
};

}
