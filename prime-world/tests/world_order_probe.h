// Adapters for World.cpp's intrusive ring and diagnostics. The four includes
// are generated from the original register, subscribe, traverse and flush
// paths.
#include <array>
#include <iterator>
#include <vector>
namespace cross_unit {
struct WorldRing;
struct WorldObjectBase {
  using Ring = WorldRing;
  struct Link {
    WorldRing *ring = nullptr;
    bool isLinked() const { return ring != nullptr; }
  } ringPart;
  std::function<void(float)> update;
  void Step(float dt) { update(dt); }
  int GetObjectId() const { return 1; }
  bool NeedToBeStepped() const { return true; }
};
struct WorldRing {
  std::list<WorldObjectBase *> objects;
  WorldObjectBase *first() const { return empty() ? nullptr : objects.front(); }
  WorldObjectBase *last() const { return nullptr; }
  bool empty() const { return objects.empty(); }
  void addLast(WorldObjectBase *obj) {
    assert(!obj->ringPart.isLinked());
    objects.push_back(obj);
    obj->ringPart.ring = this;
  }
  static WorldObjectBase *next(WorldObjectBase *obj) {
    auto &list = obj->ringPart.ring->objects;
    auto it = std::next(std::find(list.begin(), list.end(), obj));
    return it == list.end() ? nullptr : *it;
  }
  static void remove(WorldObjectBase *obj) {
    obj->ringPart.ring->objects.remove(obj);
    obj->ringPart.ring = nullptr;
  }
};
namespace ring {
template <class R> struct Range {
  WorldObjectBase *current;
  explicit Range(R &ring) : current(ring.first()) {}
  explicit operator bool() const { return current != nullptr; }
  WorldObjectBase &operator*() const { return *current; }
  void operator++() { current = R::next(current); }
};
} // namespace ring
#define NI_ASSERT(cond, msg) assert(cond)
#define NI_ASSERT_TRACE(cond, msg) assert(cond);
#define NI_VERIFY(cond, msg, on_error)                                         \
  if (!(cond)) {                                                               \
    on_error                                                                   \
  }
#define WORLD_OBJECTS_CHECK_LIST_VERIFY
struct World {
  WorldRing objectsForStep, addedObjects, removedObjects;
  WorldObjectBase *pCurrentObjectIsBeingStepped = nullptr;
  struct {
    void SetValue(int) {}
  } mainPerf_WOStepped;
  void SubscribeObject(WorldObjectBase *);
  void registerUnit(WorldObjectBase *pObject, bool immediately = false) {
    int realWObj = 1;
#include "world_register.inc"
  }
  bool ProcessAddRemove() {
#include "world_pending.inc"
    return true;
  }
  bool Step(float, float);
};
#include "world_step.inc"
#include "world_subscribe.inc"
#undef NI_ASSERT
#undef NI_ASSERT_TRACE
#undef NI_VERIFY
#undef WORLD_OBJECTS_CHECK_LIST_VERIFY

void verify() {
  // Three pre-existing units. A pet preceding the caster may belong to another
  // owner.
  std::array<int, 3> order{0, 1, 2};
  do {
    World world;
    std::array<WorldObjectBase, 3> units;
    std::array<StepRing, 3> received;
    std::array<PFApplStatus, 2> effects;
    for (auto &effect : effects)
      effect.duration = 4;
    std::vector<int> visits;
    for (int actor : order) {
      units[actor].update = [&, actor](float dt) {
        visits.push_back(actor);
        if (actor == 0) {
          for (int receiver : {1, 2})
            received[receiver].addLast(&effects[receiver - 1]);
        }
        auto tick = [&](PFBaseApplicator *base) {
          assert(!static_cast<PFApplStatus *>(base)->Step(dt));
        };
        ForallRingSafe(received[actor], tick);
      };
      world.registerUnit(&units[actor]);
    }
    world.ProcessAddRemove();
    assert(world.Step(.125f, 0));
    assert(
        std::equal(order.begin(), order.end(), visits.begin(), visits.end()));
    for (int receiver : {1, 2}) {
      bool visitedAfterCaster =
          std::find(order.begin(), order.end(), receiver) >
          std::find(order.begin(), order.end(), 0);
      assert(effects[receiver - 1].duration ==
             (visitedAfterCaster ? 3.875f : 4.f));
    }
  } while (std::next_permutation(order.begin(), order.end()));

  World world;
  WorldObjectBase caster, pet;
  PFApplStatus onPet;
  StepRing petEffects;
  int petVisits = 0;
  bool spawned = false;
  pet.update = [&](float dt) {
    ++petVisits;
    auto tick = [&](PFBaseApplicator *) { assert(!onPet.Step(dt)); };
    ForallRingSafe(petEffects, tick);
  };
  caster.update = [&](float) {
    if (spawned)
      return;
    spawned = true;
    world.registerUnit(&pet);
    onPet.lifetime = onPet.duration = 4;
    petEffects.addLast(&onPet);
  };
  world.registerUnit(&caster);
  world.ProcessAddRemove();
  assert(world.Step(.125f, 0) && spawned && petVisits == 0 &&
         onPet.duration == 4);
  assert(world.Step(.125f, 0) && petVisits == 1 && onPet.duration == 3.875f);
  std::cout << "PASS world subscription permutations and deferred summon first "
               "update\n";
}
} // namespace cross_unit
