#pragma once
#include <vector>
#include <cstdint>
#include <optional>

namespace b2d {

struct Vec2i { int x; int y; bool operator==(const Vec2i& o) const { return x==o.x && y==o.y; } };
struct Grid { int width; int height; std::vector<uint8_t> blocked; bool isBlocked(int x,int y) const; };

std::vector<Vec2i> findPathAStar(const Grid& grid, Vec2i start, Vec2i goal);
int manhattan(Vec2i a, Vec2i b);
}
