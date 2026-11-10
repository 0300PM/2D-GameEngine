#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <string_view>
#include <vector>

namespace b2d::core {

class Random {
 public:
  explicit Random(std::uint32_t seed = 0x9e3779b9u) noexcept
      : initialSeed_(seed == 0u ? 1u : seed), state_(initialSeed_) {}

  [[nodiscard]] std::uint32_t seed() const noexcept { return initialSeed_; }
  [[nodiscard]] std::uint32_t state() const noexcept { return state_; }

  void setState(std::uint32_t state) noexcept { state_ = state; }
  void reset() noexcept { state_ = initialSeed_; }

  [[nodiscard]] double next() noexcept {
    state_ = state_ + 0x6d2b79f5u;
    std::uint32_t value = state_;
    value = (value ^ (value >> 15)) * (value | 1u);
    value ^= value + (value ^ (value >> 7)) * (value | 61u);
    return static_cast<double>((value ^ (value >> 14))) / 4294967296.0;
  }

  [[nodiscard]] double floatRange(double min, double max) {
    if (max < min) throw std::invalid_argument("Random::floatRange: max must be >= min");
    return min + next() * (max - min);
  }

  [[nodiscard]] int intRange(int min, int max) {
    if (max < min) throw std::invalid_argument("Random::intRange: max must be >= min");
    const double span = static_cast<double>(max) - static_cast<double>(min) + 1.0;
    return min + static_cast<int>(next() * span);
  }

  [[nodiscard]] bool boolChance(double probability = 0.5) noexcept { return next() < probability; }
  [[nodiscard]] int sign() noexcept { return next() < 0.5 ? -1 : 1; }

  [[nodiscard]] std::size_t index(std::size_t size) {
    if (size == 0) throw std::invalid_argument("Random::index: empty collection");
    const auto value = static_cast<std::size_t>(next() * static_cast<double>(size));
    return value < size ? value : size - 1;
  }

  [[nodiscard]] std::vector<std::uint32_t> shuffle(std::vector<std::uint32_t> values) {
    for (std::size_t index = values.size(); index > 1; --index) {
      const std::size_t swap = static_cast<std::size_t>(next() * static_cast<double>(index));
      const std::size_t target = swap < index ? swap : index - 1;
      const std::uint32_t temporary = values[index - 1];
      values[index - 1] = values[target];
      values[target] = temporary;
    }
    return values;
  }

  [[nodiscard]] Random fork(std::string_view salt) const noexcept {
    std::uint32_t hash = 2166136261u;
    for (const char character : salt) {
      hash ^= static_cast<std::uint8_t>(character);
      hash *= 16777619u;
    }
    return Random(state_ ^ hash);
  }

  [[nodiscard]] std::vector<double> sample(std::size_t count) {
    std::vector<double> out(count);
    for (auto& value : out) value = next();
    return out;
  }

 private:
  std::uint32_t initialSeed_;
  std::uint32_t state_;
};

}
