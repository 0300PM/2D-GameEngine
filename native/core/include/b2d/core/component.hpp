#pragma once

#include <algorithm>
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
    for (std::size_t index = 0; index < count_; ++index) {
      if (buffer_[index].componentId != componentId) continue;
      buffer_[index].phase = phase;
      buffer_[index].order = order;
      buffer_[index].sequence = sequence;
      ++revision_;
      dirty_ = true;
      return;
    }
    if (count_ == buffer_.size()) buffer_.push_back(Entry{componentId, phase, order, sequence});
    else buffer_[count_] = Entry{componentId, phase, order, sequence};
    ++count_;
    ++revision_;
    dirty_ = true;
  }

  void remove(std::uint32_t componentId) {
    for (std::size_t index = 0; index < count_; ++index) {
      if (buffer_[index].componentId != componentId) continue;
      --count_;
      buffer_[index] = buffer_[count_];
      ++revision_;
      dirty_ = true;
      return;
    }
  }

  void setPhase(std::uint32_t componentId, ComponentPhase phase) {
    for (std::size_t index = 0; index < count_; ++index) {
      Entry& entry = buffer_[index];
      if (entry.componentId != componentId) continue;
      if (entry.phase == phase) return;
      entry.phase = phase;
      ++revision_;
      dirty_ = true;
      return;
    }
  }

  void setOrder(std::uint32_t componentId, int order) {
    for (std::size_t index = 0; index < count_; ++index) {
      Entry& entry = buffer_[index];
      if (entry.componentId != componentId) continue;
      if (entry.order == order) return;
      entry.order = order;
      ++revision_;
      dirty_ = true;
      return;
    }
  }

  [[nodiscard]] bool has(std::uint32_t componentId) const noexcept {
    for (std::size_t index = 0; index < count_; ++index) {
      if (buffer_[index].componentId == componentId) return true;
    }
    return false;
  }

  void clear() noexcept {
    count_ = 0;
    order_.resize(0);
    ++revision_;
    dirty_ = true;
  }

  [[nodiscard]] std::size_t size() const noexcept { return count_; }
  [[nodiscard]] bool dirty() const noexcept { return dirty_; }
  [[nodiscard]] std::uint32_t revision() const noexcept { return revision_; }

  [[nodiscard]] const std::vector<std::uint32_t>& ordered() {
    if (!dirty_) return order_;
    if (order_.size() < count_) order_.resize(count_);
    for (std::size_t index = 0; index < count_; ++index) order_[index] = static_cast<std::uint32_t>(index);
    std::printf("DBG before sort slots:");
    for (std::size_t i = 0; i < count_; ++i) std::printf(" %u(rank %zu/order %d/seq %u)", buffer_[i].componentId, phaseRank(buffer_[i].phase), buffer_[i].order, buffer_[i].sequence);
    std::printf("\n");
    const Entry* base = buffer_.data();
    const std::size_t count = count_;
    std::sort(order_.begin(), order_.begin() + static_cast<std::ptrdiff_t>(count),
              [base, count](std::uint32_t left, std::uint32_t right) {
                const Entry& a = base[left];
                const Entry& b = base[right];
                const auto aRank = phaseRank(a.phase);
                const auto bRank = phaseRank(b.phase);
                if (aRank != bRank) return aRank < bRank;
                if (a.order != b.order) return a.order < b.order;
                return a.sequence < b.sequence;
              });
    order_.resize(count_);
    std::printf("DBG resize count=%zu size=%zu:", count_, order_.size());
    for (auto v : order_) std::printf(" %u", v);
    std::printf("\n");
    ++revision_;
    dirty_ = false;
    return order_;
  }

  [[nodiscard]] std::vector<std::uint32_t> phase(ComponentPhase phase) {
    ordered();
    std::vector<std::uint32_t> out;
    out.reserve(count_);
    for (std::size_t index = 0; index < count_; ++index) {
      const auto slot = order_[index];
      if (buffer_[slot].phase != phase) continue;
      out.push_back(buffer_[slot].componentId);
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

  [[nodiscard]] static bool before(const Entry& left, const Entry& right) noexcept {
    const auto leftRank = phaseRank(left.phase);
    const auto rightRank = phaseRank(right.phase);
    if (leftRank != rightRank) return leftRank < rightRank;
    if (left.order != right.order) return left.order < right.order;
    return left.sequence < right.sequence;
  }

  std::vector<Entry> buffer_;
  std::vector<std::uint32_t> order_;
  std::size_t count_ = 0;
  bool dirty_ = true;
  std::uint32_t revision_ = 0;
};

}
