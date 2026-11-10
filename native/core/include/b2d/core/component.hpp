#pragma once

#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace b2d::core {

enum class ComponentPhase : std::uint8_t { Input = 0, Behavior = 1, Physics = 2, Animation = 3, Render = 4 };

constexpr std::size_t phaseRank(ComponentPhase phase) noexcept { return static_cast<std::size_t>(phase); }

constexpr std::string_view phaseName(ComponentPhase phase) noexcept {
  switch (phase) {
    case ComponentPhase::Input:
      return "input";
    case ComponentPhase::Behavior:
      return "behavior";
    case ComponentPhase::Physics:
      return "physics";
    case ComponentPhase::Animation:
      return "animation";
    case ComponentPhase::Render:
      return "render";
  }
  return "behavior";
}

struct ComponentSlot {
  std::uint32_t id = 0;
  std::uint32_t owner = 0;
  ComponentPhase phase = ComponentPhase::Behavior;
  int order = 0;
  std::uint32_t sequence = 0;
  bool enabled = true;
};

struct ComponentRegistry {
  std::vector<ComponentSlot> slots;
  std::uint32_t nextSequence = 0;

  [[nodiscard]] std::uint32_t attach(std::uint32_t id, std::uint32_t owner, ComponentPhase phase, int order) {
    for (auto& slot : slots) {
      if (slot.id != id) continue;
      slot.owner = owner;
      slot.phase = phase;
      slot.order = order;
      slot.enabled = true;
      return slot.sequence;
    }
    slots.push_back(ComponentSlot{id, owner, phase, order, nextSequence, true});
    return nextSequence++;
  }

  [[nodiscard]] bool detach(std::uint32_t id) {
    for (std::size_t index = 0; index < slots.size(); ++index) {
      if (slots[index].id != id) continue;
      slots[index] = slots.back();
      slots.pop_back();
      return true;
    }
    return false;
  }

  [[nodiscard]] bool setEnabled(std::uint32_t id, bool enabled) {
    for (auto& slot : slots) {
      if (slot.id != id) continue;
      slot.enabled = enabled;
      return true;
    }
    return false;
  }

  [[nodiscard]] bool setPhase(std::uint32_t id, ComponentPhase phase) {
    for (auto& slot : slots) {
      if (slot.id != id) continue;
      slot.phase = phase;
      return true;
    }
    return false;
  }

  [[nodiscard]] bool setOrder(std::uint32_t id, int order) {
    for (auto& slot : slots) {
      if (slot.id != id) continue;
      slot.order = order;
      return true;
    }
    return false;
  }

  [[nodiscard]] const ComponentSlot* find(std::uint32_t id) const noexcept {
    for (const auto& slot : slots) {
      if (slot.id == id) return &slot;
    }
    return nullptr;
  }

  [[nodiscard]] std::size_t count() const noexcept { return slots.size(); }

  void clear() noexcept {
    slots.clear();
    nextSequence = 0;
  }
};

class SceneSchedule {
 public:
  void add(std::uint32_t componentId, ComponentPhase phase, int order, std::uint32_t sequence) {
    entries_.push_back(Entry{componentId, phase, order, sequence});
    dirty_ = true;
  }

  void remove(std::uint32_t componentId) {
    for (std::size_t index = 0; index < entries_.size(); ++index) {
      if (entries_[index].componentId != componentId) continue;
      entries_[index] = entries_.back();
      entries_.pop_back();
      dirty_ = true;
      return;
    }
  }

  void setPhase(std::uint32_t componentId, ComponentPhase phase) {
    for (auto& entry : entries_) {
      if (entry.componentId != componentId) continue;
      entry.phase = phase;
      dirty_ = true;
      return;
    }
  }

  void setOrder(std::uint32_t componentId, int order) {
    for (auto& entry : entries_) {
      if (entry.componentId != componentId) continue;
      entry.order = order;
      dirty_ = true;
      return;
    }
  }

  void clear() noexcept {
    entries_.clear();
    dirty_ = true;
  }

  [[nodiscard]] std::size_t size() const noexcept { return entries_.size(); }
  [[nodiscard]] bool dirty() const noexcept { return dirty_; }

  [[nodiscard]] const std::vector<std::uint32_t>& ordered() {
    if (dirty_) {
      std::stable_sort(entries_.begin(), entries_.end(), [](const Entry& left, const Entry& right) {
        const auto leftRank = phaseRank(left.phase);
        const auto rightRank = phaseRank(right.phase);
        if (leftRank != rightRank) return leftRank < rightRank;
        if (left.order != right.order) return left.order < right.order;
        return left.sequence < right.sequence;
      });
      order_.resize(entries_.size());
      for (std::size_t index = 0; index < entries_.size(); ++index) order_[index] = entries_[index].componentId;
      dirty_ = false;
    }
    return order_;
  }

  [[nodiscard]] std::vector<std::uint32_t> phase(ComponentPhase phase) {
    const auto& list = ordered();
    std::vector<std::uint32_t> out;
    for (const auto componentId : list) {
      for (const auto& entry : entries_) {
        if (entry.componentId != componentId) continue;
        if (entry.phase == phase) out.push_back(componentId);
        break;
      }
    }
    return out;
  }

 private:
  struct Entry {
    std::uint32_t componentId = 0;
    ComponentPhase phase = ComponentPhase::Behavior;
    int order = 0;
    std::uint32_t sequence = 0;
  };

  std::vector<Entry> entries_;
  std::vector<std::uint32_t> order_;
  bool dirty_ = true;
};

}
