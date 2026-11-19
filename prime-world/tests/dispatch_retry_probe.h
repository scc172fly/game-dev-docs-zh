#pragma once
// Native engine methods use unit targets here. Record only effects that start.
namespace dispatch_retry {
struct PFDispatch;
struct Unit {
  bool alive = true, open = true, veto = false;
  int deliveries = 0;
  bool IsDead() const { return !alive; }
  bool CanApplyDispatch() const { return open; }
  bool OnDispatchApply(const PFDispatch &) {
    ++deliveries;
    return !veto;
  }
};
struct Target {
  Unit *unit;
  bool IsUnit() const { return true; }
  bool IsPosition() const { return false; }
  bool IsObject() const { return false; }
  bool IsObjectValid() const { return false; }
  Unit *const &GetUnit() const { return unit; }
};
using PFBaseUnit = Unit;
namespace NDb {
constexpr int ABILITYFLAGS_APPLYTODEAD = 4;
}
struct PFAbilityData {
  struct {
    int flags;
  } db{};
  const auto *GetDBDesc() const { return &db; }
  bool IsTargetValid(const Target &, bool = false) const;
};
struct Ability {
  PFAbilityData data;
  PFAbilityData *GetData() { return &data; }
  void NotifyAbilityEnd() {}
};
struct PFBaseApplicator {
  PFBaseApplicator *next = nullptr;
  bool pending = true, veto = false;
  std::function<void()> start;
  struct AppliedRing {
    static void remove(PFBaseApplicator *a) { a->pending = false; }
  };
};
struct PFBaseUnitApplicatorAppliedEvent {
  PFBaseApplicator *app;
  explicit PFBaseUnitApplicatorAppliedEvent(PFBaseApplicator *a) : app(a) {}
  bool cancelled = false;
  bool IsApplicatorCancelled() const { return cancelled; }
};
void EventHappened(PFBaseUnitApplicatorAppliedEvent &evt) {
  evt.cancelled = evt.app->veto;
}
bool ActivateApplicator(PFBaseApplicator *pApplicator, Ability *) {
#include "single_effect_veto.inc"
  pApplicator->start();
  return true;
}
struct PFDispatch {
  enum {
    STATE_PROCEED,
    STATE_WAIT_TO_APPLY,
    STATE_APPLIED
  } state = STATE_PROCEED;
  bool dead = false;
  struct DB {
    bool alwaysApply = false, dieAfterApply = true;
  } db, *pDBDispatch = &db;
  Unit unit;
  Target target{&unit}, originalTarget{&unit};
  Ability ability, *pAbility = &ability;
  PFBaseApplicator *pParentApplicator = nullptr;
  struct {
    PFBaseApplicator item;
    PFBaseApplicator *first() { return &item; }
    PFBaseApplicator *last() { return nullptr; }
    PFBaseApplicator *next(PFBaseApplicator *a) { return a->next; }
    bool empty() {
      for (auto *a = &item; a; a = a->next)
        if (a->pending)
          return false;
      return true;
    }
  } applicators;
  auto *GetDBBase() { return &db; }
  bool IsObjectDead() const { return dead; }
  void Die() { dead = true; }
  void _ApplyInternal();
  bool Step(float);
};
#define LogDispatch(...) ((void)0)
#define NI_VERIFY(cond, msg, on_error)                                         \
  if (!(cond)) {                                                               \
    on_error;                                                                  \
  }
#define NI_ASSERT(cond, msg) assert(cond)
#include "retry_methods.inc"
#undef NI_ASSERT
#undef NI_VERIFY
#undef LogDispatch

void verify() {
  for (int mask = 0; mask < 8; ++mask) {
    PFDispatch d;
    PFBaseApplicator summon, clear;
    auto &first = d.applicators.item;
    first.next = &summon;
    summon.next = &clear;
    int deadFlag = 1, layers = 1, saved = 2;
    std::vector<int> order;
    first.start = [&] {
      order.push_back(0);
      deadFlag = 0;
    };
    summon.start = [&] {
      order.push_back(1);
      layers += saved;
    };
    clear.start = [&] {
      order.push_back(2);
      saved = 0;
    };
    first.veto = mask & 1;
    summon.veto = mask & 2;
    clear.veto = mask & 4;
    d._ApplyInternal();
    std::vector<int> expected;
    for (int i = 0; i < 3; ++i)
      if (!(mask & (1 << i)))
        expected.push_back(i);
    assert(order == expected && deadFlag == (mask & 1 ? 1 : 0));
    assert(layers == (mask & 2 ? 1 : 3) && saved == (mask & 4 ? 2 : 0));
    assert(!first.pending && !summon.pending && !clear.pending);
  }
  std::cout << "PASS original multi-effect dispatch loop and per-effect veto\n";
  for (int flags : {1, 4, 5})
    for (bool deadTarget : {false, true})
      for (bool veto : {false, true}) {
        PFDispatch d;
        d.ability.data.db.flags = flags;
        int layers = 2, reads = 0, seen = -1;
        d.applicators.item.start = [&] {
          ++reads;
          seen = layers;
        };
        d.unit.open = false;
        d._ApplyInternal();
        d.unit.alive = !deadTarget;
        d.Step(.125f);
        assert(d.state == PFDispatch::STATE_WAIT_TO_APPLY && !reads &&
               !d.unit.deliveries);
        layers = 0;
        d.unit.open = true;
        d.unit.veto = veto;
        d.Step(.125f);
        bool valid = !deadTarget || (flags & 4);
        assert(d.dead && d.unit.deliveries == int(valid));
        assert(reads == int(valid && !veto) && seen == (reads ? 0 : -1));
        d.unit.alive = true;
        d.unit.veto = false;
        d.Step(.125f);
        assert(reads == int(valid && !veto));
      }
  std::cout << "PASS original dispatch wait, target revalidation, veto and "
               "terminal retry\n";
}
} // namespace dispatch_retry
