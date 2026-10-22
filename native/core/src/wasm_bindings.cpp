#include "pathfinding.hpp"
#include <emscripten/bind.h>
using namespace emscripten;
using namespace b2d;
EMSCRIPTEN_BINDINGS(core){
  value_object<Vec2i>("Vec2i").field("x",&Vec2i::x).field("y",&Vec2i::y);
  value_object<Grid>("Grid").field("width",&Grid::width).field("height",&Grid::height).field("blocked",&Grid::blocked);
  function("findPathAStar",&findPathAStar);
  function("manhattan",&manhattan);
}
