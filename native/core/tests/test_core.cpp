#include "b2d/core/hash.hpp"
#include "b2d/core/random.hpp"
#include "b2d/core/time.hpp"

#include <cmath>
#include <cstdio>
#include <string>

namespace {

int failures = 0;

void expect(bool condition, const char* label) {
  if (condition) return;
  ++failures;
  std::printf("FAIL %s\n", label);
}

void expectNear(double actual, double expected, double tolerance, const char* label) {
  if (std::fabs(actual - expected) <= tolerance) return;
  ++failures;
  std::printf("FAIL %s: got %.17g expected %.17g\n", label, actual, expected);
}

void testTime() {
  b2d::core::Time time;
  time.update(16.0);
  expectNear(time.deltaTime(), 0.016, 1e-9, "time.deltaTime");
  expectNear(time.rawDeltaTime(), 0.016, 1e-9, "time.rawDeltaTime");
  expect(time.frame() == 1, "time.frame");

  time.setTimeScale(0.5);
  time.update(20.0);
  time.update(20.0);
  expectNear(time.elapsed(), 0.016 + 0.02, 1e-9, "time.elapsed");
  expectNear(time.realElapsed(), 0.016 + 0.04, 1e-9, "time.realElapsed");

  b2d::core::Time clamped(0.1);
  clamped.update(1000.0);
  expect(clamped.clamped(), "time.clamped");
  expectNear(clamped.deltaTime(), 0.1, 1e-9, "time.clamp.deltaTime");

  b2d::core::Time paused;
  paused.pause();
  paused.update(16.0);
  paused.update(16.0);
  expectNear(paused.deltaTime(), 0.0, 1e-12, "time.paused.deltaTime");
  expect(paused.frame() == 2, "time.paused.frame");
  paused.resume();
  paused.update(16.0);
  expectNear(paused.deltaTime(), 0.016, 1e-9, "time.resumed.deltaTime");

  b2d::core::Time invalid;
  invalid.update(std::nan(""));
  expectNear(invalid.deltaTime(), 0.0, 1e-12, "time.nan");
  invalid.update(-5.0);
  expectNear(invalid.deltaTime(), 0.0, 1e-12, "time.negative");

  b2d::core::Time scaled;
  scaled.setTimeScale(-2.0);
  expectNear(scaled.timeScale(), 0.0, 1e-12, "time.scale.floor");
  scaled.setTimeScale(std::nan(""));
  expectNear(scaled.timeScale(), 1.0, 1e-12, "time.scale.nan");
}

void testFixedStep() {
  const auto run = [] {
    b2d::core::Time time(0.1);
    time.setFixedStep(60.0, 5);
    std::string trace;
    for (int frame = 0; frame < 10; ++frame) {
      time.update(16.6667);
      int steps = 0;
      while (time.consumeFixedStep()) ++steps;
      trace.push_back(static_cast<char>('0' + steps));
    }
    return trace;
  };
  expect(run() == run(), "time.fixedStep.deterministic");

  b2d::core::Time limited(0.1);
  limited.setFixedStep(60.0, 3);
  limited.update(1000.0);
  expect(limited.pendingFixedSteps() <= 3, "time.fixedStep.maxSteps");

  b2d::core::Time alpha;
  alpha.setFixedStep(10.0, 5);
  alpha.update(50.0);
  expect(alpha.fixedAlpha() >= 0.0 && alpha.fixedAlpha() < 1.0, "time.fixedAlpha");

  b2d::core::Time disabled;
  disabled.setFixedStep(0.0);
  disabled.update(100.0);
  expect(disabled.fixedDelta() == 0.0, "time.fixedStep.disabled");
  expect(disabled.consumeFixedStep() == false, "time.fixedStep.consume.disabled");
}

void testRandom() {
  b2d::core::Random first(1337);
  b2d::core::Random second(1337);
  for (int index = 0; index < 32; ++index) {
    expectNear(first.next(), second.next(), 0.0, "random.deterministic");
  }

  b2d::core::Random random(42);
  for (int index = 0; index < 256; ++index) {
    const double value = random.next();
    if (value < 0.0 || value >= 1.0) {
      expect(false, "random.range");
      break;
    }
  }

  b2d::core::Random forked = random.fork("spawner");
  expect(forked.seed() != random.seed(), "random.fork.seed");

  random.reset();
  b2d::core::Random replay(42);
  expectNear(random.next(), replay.next(), 0.0, "random.reset");

  const std::string_view salt = "level-1";
  b2d::core::Random parent(99);
  b2d::core::Random child = parent.fork(salt);
  expect(child.state() == (parent.state() ^ b2d::core::fnv1a32(salt)), "random.fork.hash");
}

void testHash() {
  expect(b2d::core::fnv1a32("") == 0x811c9dc5u, "hash.empty");
  expect(b2d::core::fnv1a32("a") == 0xe40c292cu, "hash.a");
  expect(b2d::core::fnv1a32("abc") == 0x1a47e90bu, "hash.abc");
  expect(b2d::core::hex8(0x811c9dc5u) == "811c9dc5", "hash.hex");
}

}

int main() {
  testTime();
  testFixedStep();
  testRandom();
  testHash();
  if (failures == 0) {
    std::printf("b2d-core: all checks passed\n");
    return 0;
  }
  std::printf("b2d-core: %d check(s) failed\n", failures);
  return 1;
}
