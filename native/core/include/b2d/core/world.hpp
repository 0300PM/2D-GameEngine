#pragma once

#include "b2d/core/math.hpp"

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace b2d::core {

using ObjectId = std::uint32_t;
constexpr ObjectId nullObject = 0u;

struct WorldEntry {
  double x = 0.0;
  double y = 0.0;
  double rotation = 0.0;
  double scaleX = 1.0;
  double scaleY = 1.0;
};

class World {
 public:
  explicit World(std::size_t capacity = 64) { slots_.reserve(capacity); }

  [[nodiscard]] ObjectId spawn(std::uint32_t parent, const Transform& local, bool active) {
    const ObjectId id = nextId_++;
    if (id >= slots_.size()) slots_.resize(id + 1);
    auto& slot = slots_[id];
    slot.alive = true;
    slot.parent = parent;
    slot.local = local;
    slot.active = active;
    slot.activeInHierarchy = active;
    slot.worldDirty = true;
    slot.depth = 0;
    if (parent != nullObject) {
      slot.depth = slots_[parent].depth + 1;
      slots_[parent].children.push_back(id);
      slot.activeInHierarchy = active && slots_[parent].activeInHierarchy;
    }
    ++count_;
    return id;
  }

  [[nodiscard]] bool destroy(ObjectId id) {
    if (!alive(id)) return false;
    std::vector<ObjectId> stack{id};
    while (!stack.empty()) {
      const ObjectId current = stack.back();
      stack.pop_back();
      auto& slot = slots_[current];
      if (!slot.alive) continue;
      for (const auto child : slot.children) stack.push_back(child);
      slot.children.clear();
      slot.alive = false;
      slot.parent = nullObject;
      slot.componentCount = 0;
      slot.tags.clear();
      slot.groups.clear();
      --count_;
    }
    return true;
  }

  [[nodiscard]] bool alive(ObjectId id) const noexcept { return id < slots_.size() && slots_[id].alive; }
  [[nodiscard]] std::size_t count() const noexcept { return count_; }
  [[nodiscard]] ObjectId capacity() const noexcept { return static_cast<ObjectId>(slots_.size()); }

  [[nodiscard]] const WorldEntry& world(ObjectId id) noexcept {
    auto& slot = slots_[id];
    if (slot.worldDirty) {
      slot.world = slot.parent == nullObject ? slot.local : compose(world(slot.parent), slot.local);
      slot.worldDirty = false;
    }
    return slot.world;
  }

  [[nodiscard]] const Transform& local(ObjectId id) const noexcept { return slots_[id].local; }
  [[nodiscard]] ObjectId parent(ObjectId id) const noexcept { return slots_[id].parent; }
  [[nodiscard]] bool activeInHierarchy(ObjectId id) const noexcept { return slots_[id].activeInHierarchy; }
  [[nodiscard]] std::uint32_t depth(ObjectId id) const noexcept { return slots_[id].depth; }

  void setPosition(ObjectId id, double x, double y) noexcept {
    auto& slot = slots_[id];
    slot.local.x = x;
    slot.local.y = y;
    markDirty(id);
  }

  void translate(ObjectId id, double dx, double dy) noexcept {
    auto& slot = slots_[id];
    slot.local.x += dx;
    slot.local.y += dy;
    markDirty(id);
  }

  void setRotation(ObjectId id, double radians) noexcept {
    slots_[id].local.rotation = radians;
    markDirty(id);
  }

  void setScale(ObjectId id, double scaleX, double scaleY) noexcept {
    auto& slot = slots_[id];
    slot.local.scaleX = scaleX;
    slot.local.scaleY = scaleY;
    markDirty(id);
  }

  void setLocal(ObjectId id, const Transform& transform) noexcept {
    slots_[id].local = transform;
    markDirty(id);
  }

  [[nodiscard]] bool setActive(ObjectId id, bool active) noexcept {
    if (!alive(id)) return false;
    auto& slot = slots_[id];
    if (slot.active == active) return false;
    slot.active = active;
    recomputeActivation(id);
    return true;
  }

  [[nodiscard]] bool attach(ObjectId child, ObjectId parent) {
    if (!alive(child) || !alive(parent) || child == parent) return false;
    for (ObjectId cursor = parent; cursor != nullObject; cursor = slots_[cursor].parent) {
      if (cursor == child) return false;
    }
    if (slots_[child].parent != nullObject) detach(child);
    slots_[child].parent = parent;
    slots_[child].depth = slots_[parent].depth + 1;
    slots_[parent].children.push_back(child);
    recomputeActivation(child);
    markDirty(child);
    return true;
  }

  [[nodiscard]] bool detach(ObjectId child) {
    if (!alive(child)) return false;
    const ObjectId parent = slots_[child].parent;
    if (parent == nullObject) return false;
    auto& siblings = slots_[parent].children;
    for (std::size_t index = 0; index < siblings.size(); ++index) {
      if (siblings[index] != child) continue;
      siblings[index] = siblings.back();
      siblings.pop_back();
      break;
    }
    slots_[child].parent = nullObject;
    slots_[child].depth = 0;
    recomputeActivation(child);
    markDirty(child);
    return true;
  }

  [[nodiscard]] const std::vector<ObjectId>& children(ObjectId id) const noexcept { return slots_[id].children; }

  [[nodiscard]] bool addTag(ObjectId id, std::uint32_t tag) {
    auto& tags = slots_[id].tags;
    for (const auto existing : tags) {
      if (existing == tag) return false;
    }
    tags.push_back(tag);
    return true;
  }

  [[nodiscard]] bool removeTag(ObjectId id, std::uint32_t tag) {
    auto& tags = slots_[id].tags;
    for (std::size_t index = 0; index < tags.size(); ++index) {
      if (tags[index] != tag) continue;
      tags[index] = tags.back();
      tags.pop_back();
      return true;
    }
    return false;
  }

  [[nodiscard]] bool hasTag(ObjectId id, std::uint32_t tag) const noexcept {
    for (const auto existing : slots_[id].tags) {
      if (existing == tag) return true;
    }
    return false;
  }

  [[nodiscard]] const std::vector<std::uint32_t>& tags(ObjectId id) const noexcept { return slots_[id].tags; }

  [[nodiscard]] std::uint32_t componentCount(ObjectId id) const noexcept { return slots_[id].componentCount; }
  void setComponentCount(ObjectId id, std::uint32_t value) noexcept { slots_[id].componentCount = value; }

  [[nodiscard]] std::vector<ObjectId> live() const {
    std::vector<ObjectId> out;
    out.reserve(count_);
    for (std::size_t index = 1; index < slots_.size(); ++index) {
      if (slots_[index].alive) out.push_back(static_cast<ObjectId>(index));
    }
    return out;
  }

  [[nodiscard]] std::size_t visibleCount() const noexcept {
    std::size_t total = 0;
    for (std::size_t index = 1; index < slots_.size(); ++index) {
      if (slots_[index].alive && slots_[index].activeInHierarchy) ++total;
    }
    return total;
  }

  void clear() noexcept {
    slots_.clear();
    count_ = 0;
    nextId_ = 1;
  }

 private:
  struct Slot {
    Transform local;
    WorldEntry world;
    std::vector<ObjectId> children;
    std::vector<std::uint32_t> tags;
    std::vector<std::uint32_t> groups;
    ObjectId parent = nullObject;
    std::uint32_t depth = 0;
    std::uint32_t componentCount = 0;
    bool alive = false;
    bool active = true;
    bool activeInHierarchy = true;
    bool worldDirty = true;
  };

  void markDirty(ObjectId id) noexcept {
    std::vector<ObjectId> stack{id};
    while (!stack.empty()) {
      const ObjectId current = stack.back();
      stack.pop_back();
      auto& slot = slots_[current];
      if (!slot.worldDirty) slot.worldDirty = true;
      for (const auto child : slot.children) stack.push_back(child);
    }
  }

  void recomputeActivation(ObjectId id) noexcept {
    std::vector<ObjectId> stack{id};
    while (!stack.empty()) {
      const ObjectId current = stack.back();
      stack.pop_back();
      auto& slot = slots_[current];
      slot.activeInHierarchy = slot.active && (slot.parent == nullObject || slots_[slot.parent].activeInHierarchy);
      for (const auto child : slot.children) stack.push_back(child);
    }
  }

  std::vector<Slot> slots_;
  std::size_t count_ = 0;
  ObjectId nextId_ = 1;
};

class ObjectIndex {
 public:
  [[nodiscard]] std::uint32_t intern(std::string_view key) {
    if (const auto found = lookup_.find(std::string(key)); found != lookup_.end()) return found->second;
    const auto id = static_cast<std::uint32_t>(keys_.size());
    keys_.emplace_back(key);
    lookup_.emplace(keys_.back(), id);
    return id;
  }

  [[nodiscard]] bool has(std::uint32_t key) const noexcept { return key < keys_.size(); }
  [[nodiscard]] std::string_view key(std::uint32_t id) const { return keys_.at(id); }
  [[nodiscard]] std::size_t size() const noexcept { return keys_.size(); }

  void clear() noexcept {
    keys_.clear();
    lookup_.clear();
  }

 private:
  std::vector<std::string> keys_;
  std::unordered_map<std::string, std::uint32_t> lookup_;
};

}
