#pragma once

#include <cmath>
#include <cstdint>

namespace b2d::core {

struct TimeState {
  double elapsed = 0.0;
  double realElapsed = 0.0;
  double deltaTime = 0.0;
  double realDeltaTime = 0.0;
  double rawDeltaTime = 0.0;
  double timeScale = 1.0;
  double fixedDelta = 0.0;
  double fixedAlpha = 0.0;
  std::uint32_t frame = 0;
  std::uint32_t pendingFixedSteps = 0;
  bool paused = false;
  bool clamped = false;
};

class Time {
 public:
  explicit Time(double maxDeltaTime = 0.1) noexcept : maxDeltaTime_(maxDeltaTime > 0.001 ? maxDeltaTime : 0.001) {}

  void update(double rawDeltaMs) noexcept {
    const double raw = std::isfinite(rawDeltaMs) && rawDeltaMs > 0.0 ? rawDeltaMs / 1000.0 : 0.0;
    rawDeltaTime_ = raw;
    frame_ += 1;
    if (paused_) {
      deltaTime_ = 0.0;
      realDeltaTime_ = 0.0;
      return;
    }
    realDeltaTime_ = raw < maxDeltaTime_ ? raw : maxDeltaTime_;
    deltaTime_ = realDeltaTime_ * timeScale_;
    elapsed_ += deltaTime_;
    realElapsed_ += realDeltaTime_;
    if (fixedDelta_ > 0.0) {
      const double limit = fixedDelta_ * static_cast<double>(maxFixedSteps_);
      accumulator_ += deltaTime_;
      if (accumulator_ > limit) accumulator_ = limit;
    }
  }

  void setTimeScale(double value) noexcept { timeScale_ = std::isfinite(value) ? (value < 0.0 ? 0.0 : value) : 1.0; }

  void setMaxDeltaTime(double value) noexcept { maxDeltaTime_ = value > 0.001 ? value : 0.001; }

  void setFixedStep(double hz, std::uint32_t maxSteps = 5) noexcept {
    if (!(hz > 0.0) || !std::isfinite(hz)) {
      fixedDelta_ = 0.0;
      accumulator_ = 0.0;
      return;
    }
    fixedDelta_ = 1.0 / hz;
    maxFixedSteps_ = maxSteps < 1 ? 1 : maxSteps;
  }

  [[nodiscard]] std::uint32_t pendingFixedSteps() const noexcept {
    if (fixedDelta_ <= 0.0) return 0;
    const auto steps = static_cast<std::uint32_t>(accumulator_ / fixedDelta_);
    return steps > maxFixedSteps_ ? maxFixedSteps_ : steps;
  }

  [[nodiscard]] bool consumeFixedStep() noexcept {
    if (fixedDelta_ <= 0.0 || accumulator_ < fixedDelta_) return false;
    accumulator_ -= fixedDelta_;
    return true;
  }

  void pause() noexcept {
    paused_ = true;
    deltaTime_ = 0.0;
    realDeltaTime_ = 0.0;
  }

  void resume() noexcept {
    paused_ = false;
    accumulator_ = 0.0;
  }

  void reset() noexcept {
    elapsed_ = 0.0;
    realElapsed_ = 0.0;
    deltaTime_ = 0.0;
    realDeltaTime_ = 0.0;
    rawDeltaTime_ = 0.0;
    frame_ = 0;
    paused_ = false;
    accumulator_ = 0.0;
  }

  [[nodiscard]] double elapsed() const noexcept { return elapsed_; }
  [[nodiscard]] double realElapsed() const noexcept { return realElapsed_; }
  [[nodiscard]] double deltaTime() const noexcept { return deltaTime_; }
  [[nodiscard]] double realDeltaTime() const noexcept { return realDeltaTime_; }
  [[nodiscard]] double rawDeltaTime() const noexcept { return rawDeltaTime_; }
  [[nodiscard]] double timeScale() const noexcept { return timeScale_; }
  [[nodiscard]] double fixedDelta() const noexcept { return fixedDelta_; }
  [[nodiscard]] std::uint32_t frame() const noexcept { return frame_; }
  [[nodiscard]] bool paused() const noexcept { return paused_; }
  [[nodiscard]] bool clamped() const noexcept { return rawDeltaTime_ > maxDeltaTime_; }

  [[nodiscard]] double fixedAlpha() const noexcept { return fixedDelta_ > 0.0 ? accumulator_ / fixedDelta_ : 0.0; }

  [[nodiscard]] TimeState snapshot() const noexcept {
    return TimeState{elapsed_,       realElapsed_,    deltaTime_,   realDeltaTime_, rawDeltaTime_, timeScale_,
                     fixedDelta_,    fixedAlpha(),    frame_,       pendingFixedSteps(), paused_,  clamped()};
  }

 private:
  double elapsed_ = 0.0;
  double realElapsed_ = 0.0;
  double deltaTime_ = 0.0;
  double realDeltaTime_ = 0.0;
  double rawDeltaTime_ = 0.0;
  double timeScale_ = 1.0;
  double maxDeltaTime_;
  double fixedDelta_ = 0.0;
  double accumulator_ = 0.0;
  std::uint32_t maxFixedSteps_ = 5;
  std::uint32_t frame_ = 0;
  bool paused_ = false;
};

}
