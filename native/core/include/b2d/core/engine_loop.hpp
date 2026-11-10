#pragma once

#include "b2d/core/scene.hpp"
#include "b2d/core/time.hpp"

#include <cstdint>
#include <vector>

namespace b2d::core {

struct LoopFrame {
  double rawDeltaMs = 0.0;
  std::uint32_t fixedSteps = 0;
  std::uint32_t frame = 0;
};

class EngineLoop {
 public:
  EngineLoop(std::uint32_t sceneId, double maxDeltaTime, double fixedHz, std::uint32_t maxSteps)
      : sceneId_(sceneId), time_(maxDeltaTime) {
    time_.setFixedStep(fixedHz, maxSteps);
  }

  [[nodiscard]] LoopFrame advance(SceneManager& scenes, double rawDeltaMs) noexcept {
    time_.update(rawDeltaMs);
    LoopFrame frame;
    frame.rawDeltaMs = time_.rawDeltaTime();
    frame.frame = time_.frame();
    Scene* scene = scenes.activeId() == sceneId_ ? scenes.active() : scenes.get(sceneId_);
    if (scene != nullptr) scene->stats().pendingFixedSteps = time_.pendingFixedSteps();
    while (time_.consumeFixedStep()) {
      frame.fixedSteps += 1;
      if (scene != nullptr) scene->markDirty();
    }
    if (scene != nullptr) scene->step();
    return frame;
  }

  [[nodiscard]] Time& time() noexcept { return time_; }
  [[nodiscard]] const Time& time() const noexcept { return time_; }
  [[nodiscard]] std::uint32_t sceneId() const noexcept { return sceneId_; }

  void bind(std::uint32_t sceneId) noexcept { sceneId_ = sceneId; }

  [[nodiscard]] TimeState state() const noexcept { return time_.snapshot(); }

 private:
  std::uint32_t sceneId_;
  Time time_;
};

}
