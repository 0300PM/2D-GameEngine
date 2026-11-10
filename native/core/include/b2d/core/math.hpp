#pragma once

#include <cmath>
#include <cstdint>

namespace b2d::core {

constexpr double pi = 3.14159265358979323846;

struct Vec2 {
  double x = 0.0;
  double y = 0.0;
};

struct Transform {
  double x = 0.0;
  double y = 0.0;
  double rotation = 0.0;
  double scaleX = 1.0;
  double scaleY = 1.0;

  [[nodiscard]] constexpr bool operator==(const Transform& other) const noexcept {
    return x == other.x && y == other.y && rotation == other.rotation && scaleX == other.scaleX && scaleY == other.scaleY;
  }
};

struct Aabb {
  double x = 0.0;
  double y = 0.0;
  double width = 0.0;
  double height = 0.0;

  [[nodiscard]] constexpr bool overlaps(const Aabb& other) const noexcept {
    return x < other.x + other.width && other.x < x + width && y < other.y + other.height && other.y < y + height;
  }

  [[nodiscard]] constexpr bool contains(double px, double py) const noexcept {
    return px >= x && px <= x + width && py >= y && py <= y + height;
  }
};

[[nodiscard]] constexpr double clamp(double value, double min, double max) noexcept {
  return value < min ? min : (value > max ? max : value);
}

[[nodiscard]] constexpr double lerp(double from, double to, double t) noexcept { return from + (to - from) * t; }

[[nodiscard]] inline bool isFinite(double value) noexcept { return std::isfinite(value); }

[[nodiscard]] inline double wrapAngle(double radians) noexcept {
  constexpr double twoPi = pi * 2.0;
  double value = std::fmod(radians + pi, twoPi);
  if (value < 0.0) value += twoPi;
  return value - pi;
}

[[nodiscard]] inline Transform compose(const Transform& parent, const Transform& local) noexcept {
  const double cosine = std::cos(parent.rotation);
  const double sine = std::sin(parent.rotation);
  const double localX = local.x * parent.scaleX;
  const double localY = local.y * parent.scaleY;
  Transform out;
  out.x = parent.x + localX * cosine - localY * sine;
  out.y = parent.y + localX * sine + localY * cosine;
  out.rotation = parent.rotation + local.rotation;
  out.scaleX = parent.scaleX * local.scaleX;
  out.scaleY = parent.scaleY * local.scaleY;
  return out;
}

}
