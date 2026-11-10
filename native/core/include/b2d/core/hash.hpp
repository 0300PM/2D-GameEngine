#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>

namespace b2d::core {

constexpr std::uint32_t fnv1a32(std::string_view text) noexcept {
  std::uint32_t hash = 0x811c9dc5u;
  for (const char character : text) {
    hash ^= static_cast<std::uint8_t>(character);
    hash *= 0x01000193u;
  }
  return hash;
}

constexpr std::uint32_t fnv1a32(std::uint32_t hash, std::string_view text) noexcept {
  for (const char character : text) {
    hash ^= static_cast<std::uint8_t>(character);
    hash *= 0x01000193u;
  }
  return hash;
}

constexpr std::uint64_t fnv1a64(std::string_view text) noexcept {
  std::uint64_t hash = 0xcbf29ce484222325ull;
  for (const char character : text) {
    hash ^= static_cast<std::uint8_t>(character);
    hash *= 0x100000001b3ull;
  }
  return hash;
}

inline std::string hex8(std::uint32_t value) {
  static constexpr char digits[] = "0123456789abcdef";
  std::string out(8, '0');
  for (int index = 7; index >= 0; --index) {
    out[static_cast<std::size_t>(index)] = digits[value & 0xfu];
    value >>= 4;
  }
  return out;
}

}
