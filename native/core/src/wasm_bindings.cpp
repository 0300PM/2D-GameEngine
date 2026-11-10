#include "b2d/core/component.hpp"
#include "b2d/core/engine_loop.hpp"
#include "b2d/core/hash.hpp"
#include "b2d/core/math.hpp"
#include "b2d/core/random.hpp"
#include "b2d/core/scene.hpp"
#include "b2d/core/time.hpp"
#include "pathfinding.hpp"

#include <emscripten/bind.h>

using namespace emscripten;

EMSCRIPTEN_BINDINGS(b2d_core_types) {
  value_object<b2d::Vec2i>("Vec2i").field("x", &b2d::Vec2i::x).field("y", &b2d::Vec2i::y);
  value_object<b2d::Grid>("Grid").field("width", &b2d::Grid::width).field("height", &b2d::Grid::height).field("blocked", &b2d::Grid::blocked);
  function("findPathAStar", &b2d::findPathAStar);
  function("manhattan", &b2d::manhattan);
  value_object<b2d::core::TimeState>("TimeState")
      .field("elapsed", &b2d::core::TimeState::elapsed)
      .field("realElapsed", &b2d::core::TimeState::realElapsed)
      .field("deltaTime", &b2d::core::TimeState::deltaTime)
      .field("frame", &b2d::core::TimeState::frame);
}
