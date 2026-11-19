// Minimal object adapters for the original r1117 comparison and stop methods.
// extract_status_probe.py supplies the unmodified method bodies at build time.
#include <algorithm>
#include <cassert>
#include <cmath>
#include <functional>
#include <iostream>
#include <list>
#include <map>
#include <utility>
using std::make_pair;
using std::pair;
namespace nstl = std;
#define NI_PROFILE_FUNCTION
template <class T> bool IsValid(T *p) { return p != nullptr; }

// These probes use whole simulation seconds, away from the engine epsilon
// boundary.
constexpr float EPS_VALUE = 1.e-6f;
namespace NDb {
enum {
  BUFFBEHAVIOR_STOPONDISABLE = 1,
  BUFFBEHAVIOR_DONTSTOPONDEATH = 8,
  BUFFBEHAVIOR_ENABLEDONSENDERDEATH = 16,
  BUFFBEHAVIOR_DONTSTOPONSENDERDEATH = 128,
  STATUSFLAGS_UPDATELIFETIME = 1,
  STATUSFLAGS_STOPSAMECONFLICTED = 4,
  STATUSFLAGS_STOPALLCONFLICTED = 32,
  STACKINGRULE_UNSTACKABLE = 0,
  STACKINGRULE_PARTIALLYSTACKABLE = 1
};
struct BuffApplicator {
  int behaviorFlags = 0;
};
} // namespace NDb
struct ValueWithModifiers {};
struct StepRing;
struct PFBaseUnit;
template <class T> using CPtr = T *;
enum { APPL_STOP_REASON_ONDEATH = 1 };
struct PFBaseApplicator {
  StepRing *ring = nullptr;
  bool enabled = true, blocked = false;
  virtual ~PFBaseApplicator() = default;
  virtual int GetTypeId() const { return 0; }
  bool registered = true;
  int stopReason = 0;
  virtual bool NeedToStopOnDeath() const { return true; }
  virtual bool NeedToStopOnSenderDeath() const { return true; }
  virtual bool NeedToDisableOnDeath() const { return true; }
  virtual void Stop() {}
  void RemoveFromRingsSafe() {
    assert(registered);
    registered = false;
  }
  void SetStopReason(int reason) { stopReason = reason; }
  bool IsEnabled() const { return enabled; }
  void SetEnabled(bool value) { enabled = value; }
  void SetBlocked(bool value) { blocked = value; }
  void Step(float) {}
  virtual void Disable() {}
  virtual void Enable() {}
  void Block();
  void Unblock();
};
struct PFApplStatMod : PFBaseApplicator {
  enum { typeId = 1 };
  ValueWithModifiers *pStat;
  float impact;
  PFApplStatMod(ValueWithModifiers *stat, float amount)
      : pStat(stat), impact(amount) {}
  int GetTypeId() const override { return typeId; }
  float GetAbsModification() const { return std::abs(impact); }
};
struct PFApplBuff : PFBaseApplicator {
  float duration = -1.f;
  NDb::BuffApplicator buff;
  CPtr<PFBaseUnit> pOwner = nullptr, receiver = nullptr;
  bool bPassive = false;
  const CPtr<PFBaseUnit> &GetReceiver() const { return receiver; }
  bool NeedToStopOnDeath() const override;
  bool NeedToStopOnSenderDeath() const override;
  bool NeedToDisableOnDeath() const override;
  template <class T> const T &GetDBAppl() const { return buff; }
  bool Step(float dtInSeconds);
  bool GetRemainingLifeTime(float &time) const;
  virtual void Stop() {
    if (enabled) {
      SetEnabled(false);
      Disable();
    }
  }
};
struct ChildRef {
  PFBaseApplicator *ptr;
  ChildRef(PFBaseApplicator *p) : ptr(p) {}
  PFBaseApplicator *GetPtr() const { return ptr; }
  PFBaseApplicator *operator->() const { return ptr; }
  operator PFBaseApplicator *() const { return ptr; }
  explicit operator PFApplStatMod *() const {
    return static_cast<PFApplStatMod *>(ptr);
  }
};
bool IsValid(ChildRef ref) { return ref.GetPtr() != nullptr; }
struct PFApplStatus : PFApplBuff {
  struct {
    int power = 0, id = 0, flags = 0, stackCount = 0, stackableAcrossUnits = 0;
    int GetDBID() const { return id; }
  } db;
  int owner = 0;
  float lifetime = -1;
  int GetAbilityOwner() const { return owner; }
  float GetLifetime() const { return lifetime; }
  float GetDuration() const { return duration; }
  void SetLifetime(float value) { lifetime = value; }
  void SetDuration(float value) { duration = value; }
  void ForceUpdateLifetime(float newLifetime, float newDuration);
  using TApplicators = std::list<ChildRef>;
  using TApplStatuses = std::list<PFApplStatus *>;
  TApplicators childApplicators;
  TApplStatuses blockApplicators, blockedByApplicators, mergeApplicators;
  const auto &GetDB() const { return db; }
  bool IsComparableByValue() const { return !mergeApplicators.empty(); }
  void CompareByPower(PFApplStatus *pSecond);
  void MergeByValue();
  // Status::Disable clears children before recomputing the remaining merge
  // peers.
  void Disable() override {
    childApplicators.clear();
    MergeByValue();
  }
  void Stop() override;
};

template <class T> using CObj = T *;
struct StatusRef {
  PFApplStatus *ptr;
  PFApplStatus *operator->() const { return ptr; }
  PFApplStatus *GetPtr() const { return ptr; }
  operator PFBaseApplicator *() const { return ptr; }
};
void MemorizeApplicator(PFBaseApplicator *) {}
struct StackingScan {
  PFApplStatus *pNewcomer;
  int statusCount = 0;
  std::list<PFApplStatus *> conflictedApplicators;
  void inspect(StatusRef pAppl) {
#include "same_db_branch.inc"
  }
};

struct PFBaseUnitEvent {};
struct PFBaseUnitEventListener {
  enum EListenerType { LISTENER_SHIELD, LISTENER_DEFAULT };
  enum { FLAGS_REMOVE = 1 };
  EListenerType type;
  float priority;
  std::function<void()> callback;
  EListenerType GetListenerType() const { return type; }
  float GetListenerPriority() const { return priority; }
  bool IsAlive() const { return true; }
  unsigned OnEvent(const PFBaseUnitEvent *) {
    callback();
    return 0;
  }
};
struct PFBaseUnit {
  std::list<PFBaseUnitEventListener *> eventListeners;
  void EventHappened(const PFBaseUnitEvent &evt);
  void add(PFBaseUnitEventListener *item) {
#include "listener_order.inc"
    auto pos = eventListeners.end();
    if (item->type != PFBaseUnitEventListener::LISTENER_DEFAULT)
      pos = std::find_if(eventListeners.begin(), pos, PosFinder(item));
    eventListeners.insert(pos, item);
  }
};
#define NI_ALWAYS_ASSERT(msg) assert(false && msg)
#include "engine_fragments.inc"

void power_case(int oldPower, float oldTime, int newPower, float newTime,
                bool newcomerWins) {
  PFApplStatus old, fresh;
  old.db.power = oldPower;
  old.duration = oldTime;
  fresh.db.power = newPower;
  fresh.duration = newTime;
  fresh.CompareByPower(&old);
  auto *winner = newcomerWins ? &fresh : &old;
  auto *loser = newcomerWins ? &old : &fresh;
  assert(winner->blockApplicators.size() == 1 &&
         winner->blockApplicators.front() == loser);
  loser->Block();
  winner->Stop();
  assert(loser->IsEnabled() && !loser->blocked &&
         loser->blockedByApplicators.empty());
}

// The extracted loop temporarily moves each visited item into a second ring.
// Moving or removing an item must affect its actual current ring.
struct StepRing {
  std::list<PFBaseApplicator *> entries;
  bool empty() const { return entries.empty(); }
  PFBaseApplicator *first() { return entries.front(); }
  void addLast(PFBaseApplicator *item) {
    assert(!item->ring);
    entries.push_back(item);
    item->ring = this;
  }
  static void remove(PFBaseApplicator *item) {
    item->ring->entries.remove(item);
    item->ring = nullptr;
  }
};
#include "step_order.inc"

void check_same_step_refresh(bool apply_first) {
  StepRing ring;
  PFApplStatus old, fresh;
  PFBaseApplicator apply, read;
  old.lifetime = 4;
  old.duration = 0.125f;
  fresh.lifetime = fresh.duration = 4;
  fresh.db.stackCount = 2;
  fresh.db.flags = NDb::STATUSFLAGS_UPDATELIFETIME;
  ring.addLast(apply_first ? &apply : &old);
  ring.addLast(apply_first ? &old : &apply);
  ring.addLast(&read);
  int seen = 0, new_steps = 0;
  auto visit = [&](PFBaseApplicator *item) {
    if (item == &apply) {
      StackingScan scan{&fresh};
      if (old.IsEnabled())
        scan.inspect({&old});
      ring.addLast(&fresh);
    } else if (item == &read) {
      seen = (old.IsEnabled() ? 2 : 0) +
             1; // a two-layer old and one-layer new contribution
    } else {
      auto *status = static_cast<PFApplStatus *>(item);
      if (status == &fresh)
        ++new_steps;
      if (status->Step(0.125f)) {
        status->Stop();
        StepRing::remove(item);
      }
    }
  };
  ForallRingSafe(ring, visit);
  assert(seen == (apply_first ? 3 : 1));
  assert(new_steps == 1 && fresh.duration == 3.875f);
  if (apply_first)
    assert(old.duration == 3.875f);
}

void check_same_step_blockers(bool expire_first) {
  StepRing ring;
  PFApplStatus weak, strong, next;
  PFBaseApplicator apply, read;
  weak.duration = 3;
  strong.duration = 0.125f;
  next.duration = 2;
  strong.db.power = next.db.power = 1;
  strong.CompareByPower(&weak);
  weak.Block();
  ring.addLast(expire_first ? static_cast<PFBaseApplicator *>(&strong)
                            : &apply);
  ring.addLast(&read);
  ring.addLast(expire_first ? &apply
                            : static_cast<PFBaseApplicator *>(&strong));
  auto visit = [&](PFBaseApplicator *item) {
    if (item == &strong) {
      assert(strong.Step(0.125f));
      strong.Stop();
      StepRing::remove(item);
    } else if (item == &apply) {
      // Start scans the active status ring. Disabled weak is absent from it.
      auto &active = weak.IsEnabled() ? weak : strong;
      next.CompareByPower(&active);
      for (auto *loser : next.blockApplicators)
        loser->Block();
      ring.addLast(&next);
    } else if (item == &read) {
      assert(weak.IsEnabled() == expire_first);
    } else if (item == &next) {
      assert(!next.Step(0.125f));
    }
  };
  ForallRingSafe(ring, visit);
  assert(next.IsEnabled());
  assert(weak.IsEnabled() != expire_first);
}

// The two callbacks stand for a state writer and a formula reader, not two
// specific talents.
void check_same_event_read(float writer_priority, float reader_priority,
                           bool writer_first, int expected) {
  PFBaseUnit unit;
  int layers = 1, seen = -1;
  PFBaseUnitEventListener write{PFBaseUnitEventListener::LISTENER_SHIELD,
                                writer_priority, [&] { ++layers; }};
  PFBaseUnitEventListener read{PFBaseUnitEventListener::LISTENER_SHIELD,
                               reader_priority, [&] { seen = layers; }};
  unit.add(writer_first ? &write : &read);
  unit.add(writer_first ? &read : &write);
  unit.EventHappened(PFBaseUnitEvent{});
  assert(seen == expected && layers == 2);
}

void check_receiver_already_stepped(bool target_first) {
  StepRing receiver;
  PFApplStatus fresh;
  fresh.duration = 4;
  int visits = 0;
  auto update = [&](PFBaseApplicator *) {
    ++visits;
    assert(!fresh.Step(0.125f));
  };
  if (target_first)
    ForallRingSafe(receiver, update);
  receiver.addLast(&fresh);
  if (!target_first)
    ForallRingSafe(receiver, update);
  assert(visits == (target_first ? 0 : 1));
  assert(fresh.duration == (target_first ? 4 : 3.875f));
}

#include "world_order_probe.h"

#include "death_callbacks.inc"

void check_death_cleanup() {
  // The world drains deaths in insertion order. A stopped effect disappears
  // from both unit rings, so the second cleanup must skip it.
  for (bool senderFirst : {false, true}) {
    PFApplBuff mark;
    mark.buff.behaviorFlags = 147;
    for (bool sender : {senderFirst, !senderFirst}) {
      if (mark.registered) {
        if (sender)
          StopAndDeleteApplicatorOnSenderDeath_{}(&mark);
        else
          StopAndDeleteApplicatorOnDeath_{}(&mark);
      }
      if (sender && senderFirst)
        assert(mark.registered && mark.IsEnabled());
    }
    assert(!mark.registered && mark.stopReason == APPL_STOP_REASON_ONDEATH);
  }
  for (int flags : {153, 216, 217}) {
    PFApplBuff retained;
    retained.buff.behaviorFlags = flags;
    StopAndDeleteApplicatorOnDeath_{}(&retained);
    StopAndDeleteApplicatorOnSenderDeath_{}(&retained);
    assert(retained.registered && !retained.NeedToDisableOnDeath());
    StopAndDeleteApplicator_{}(&retained);
    assert(!retained.registered);
  }
  struct DemonStatus : PFApplBuff {
    int &layers;
    explicit DemonStatus(int &value) : layers(value) {
      buff.behaviorFlags = 16;
    }
    void Disable() override { --layers; }
  };
  for (bool tickFirst : {false, true}) {
    int layers = 2;
    DemonStatus demon(layers);
    if (tickFirst)
      assert(!demon.Step(.125f));
    assert(layers == 2); // unsummon has queued the receiver
    if (!tickFirst)
      assert(!demon.Step(.125f));
    assert(layers == 2);
    StopAndDeleteApplicatorOnDeath_{}(&demon);
    assert(!demon.registered && layers == 1);
  }
  std::cout << "PASS r1117 receiver/sender death callbacks and full cleanup\n";
}

// A resurrection listener observes the retained effect before the hero's
// ordinary receiver tick in that step. Exercise the r1117 timer and predicates.
void check_resurrection_timers() {
  for (int flags : {153, 216, 217}) {
    for (float initial : {3.f, 4.f, -1.f}) {
      PFApplBuff effect;
      effect.buff.behaviorFlags = flags;
      effect.duration = initial;
      StopAndDeleteApplicatorOnDeath_{}(&effect);
      StopAndDeleteApplicatorOnSenderDeath_{}(&effect);
      for (int deadStep = 0; deadStep < 3; ++deadStep) {
        assert(effect.registered);
        if (effect.Step(1.f))
          StopAndDeleteApplicator_{}(&effect);
      }
      assert(effect.registered == (initial != 3.f));
      if (!effect.registered)
        continue;
      float remaining = 0.f;
      assert(effect.GetRemainingLifeTime(remaining) == (initial != -1.f));
      if (initial == 4.f)
        assert(remaining == 1.f);
      assert(effect.Step(1.f) == (initial == 4.f));
    }
  }
  std::cout
      << "PASS retained r1117 timers through death and resurrection step\n";
}

namespace resurrection_step {
struct Base {
  void Step(float) {}
};
struct PFDispatchImmediate : Base {
  struct {
    bool instantApply;
  } db;
  std::function<void()> apply;
  enum { STATE_PROCEED, APPLIED } state = STATE_PROCEED;
  bool IsObjectDead() const { return state == APPLIED; }
  const auto &GetDB() const { return db; }
  void Apply() {
    apply();
    state = APPLIED;
  }
  void OnStart();
  bool Step(float);
};
#include "immediate_step.inc"

void verify() {
  for (bool instantWrite : {false, true})
    for (bool instantRead : {false, true})
      for (bool readerFirst : {false, true}) {
        cross_unit::World world;
        cross_unit::WorldObjectBase hero, writerObject, readerObject;
        PFBaseUnit listeners;
        PFApplBuff retained;
        retained.duration = .125f;
        int layers = 2, seen = -1;
        bool seenLive = false;
        PFDispatchImmediate writer, reader;
        writer.db.instantApply = instantWrite;
        reader.db.instantApply = instantRead;
        writer.apply = [&] { layers = 0; };
        reader.apply = [&] {
          seen = layers;
          seenLive = retained.registered;
        };
        auto dispatch = [&](cross_unit::WorldObjectBase &obj,
                            PFDispatchImmediate &d) {
          obj.update = [&d](float dt) { d.Step(dt); };
          world.registerUnit(&obj, true);
          d.OnStart();
        };
        PFBaseUnitEventListener write{PFBaseUnitEventListener::LISTENER_DEFAULT,
                                      0,
                                      [&] { dispatch(writerObject, writer); }};
        PFBaseUnitEventListener read{PFBaseUnitEventListener::LISTENER_DEFAULT,
                                     0,
                                     [&] { dispatch(readerObject, reader); }};
        listeners.add(readerFirst ? &read : &write);
        listeners.add(readerFirst ? &write : &read);
        hero.update = [&](float dt) {
          listeners.EventHappened(PFBaseUnitEvent{});
          assert(retained.Step(dt));
          StopAndDeleteApplicator_{}(&retained);
        };
        world.registerUnit(&hero);
        world.ProcessAddRemove();
        assert(world.Step(.125f, 0));
        bool readNew =
            instantRead == instantWrite ? !readerFirst : instantWrite;
        assert(layers == 0 && seen == (readNew ? 0 : 2));
        assert(seenLive == instantRead);
      }
  std::cout << "PASS resurrection listener, dispatch and exact-expiry orders\n";
}
} // namespace resurrection_step

#include "dispatch_retry_probe.h"

#include "program_probe.h"

int main() {
  program_probe::verify();
  dispatch_retry::verify();
  resurrection_step::verify();
  check_resurrection_timers();
  check_death_cleanup();
  cross_unit::verify();
  check_same_event_read(3, 2, false, 2);
  check_same_event_read(2, 3, true, 1);
  check_same_event_read(2, 2, false, 1);
  check_same_event_read(2, 2, true, 2);
  for (bool first : {false, true}) {
    check_receiver_already_stepped(first);
    check_same_step_refresh(first);
    check_same_step_blockers(first);
  }
  PFApplStatus oldest, next, thirdOld, arrival;
  arrival.db.stackCount = 2;
  arrival.db.flags = NDb::STATUSFLAGS_UPDATELIFETIME;
  arrival.lifetime = arrival.duration = 4;
  oldest.duration = 1;
  next.duration = 2;
  thirdOld.duration = 3;
  StackingScan scan{&arrival};
  for (auto *prior : {&oldest, &next, &thirdOld})
    scan.inspect({prior});
  assert(oldest.duration == 4 && next.duration == 4 && thirdOld.duration == 3);
  assert(scan.conflictedApplicators.size() == 1 &&
         scan.conflictedApplicators.front() == &thirdOld);

  power_case(0, 8, 1, 2, true);  // higher priority may expire first
  power_case(1, 2, 0, 8, false); // strength is independent of application order
  power_case(0, 3, 0, 4, true);
  power_case(0, 4, 0, 4, false);
  power_case(0, -1, 0, 4, false); // no finite lifetime for the comparison

  PFApplStatus old, a, b;
  a.CompareByPower(&old); // Same power, infinite duration; old wins.
  b.db.power = 2;
  b.CompareByPower(&a);
  a.Block(); // Two blockers on a: old and b.
  b.Stop();
  assert(!a.IsEnabled() && a.blockedByApplicators.size() == 1);
  old.Stop();
  assert(a.IsEnabled());

  PFApplStatus weaker, stronger;
  stronger.db.power = 1;
  stronger.CompareByPower(&weaker);
  weaker.Block();
  weaker.Stop(); // The suppressed instance expired first.
  assert(stronger.blockApplicators.empty());
  stronger.Stop();
  assert(!weaker.IsEnabled());

  for (bool stopOnDisable : {false, true}) {
    PFApplStatus longWeak, shortStrong;
    longWeak.duration = 8;
    shortStrong.duration = 2;
    shortStrong.db.power = 1;
    longWeak.buff.behaviorFlags =
        stopOnDisable ? NDb::BUFFBEHAVIOR_STOPONDISABLE : 0;
    shortStrong.CompareByPower(&longWeak);
    longWeak.Block();
    if (longWeak.Step(2))
      longWeak.Stop();
    assert(shortStrong.Step(2));
    shortStrong.Stop();
    assert(longWeak.IsEnabled() == !stopOnDisable);
    if (!stopOnDisable)
      assert(longWeak.duration == 6);
  }
  ValueWithModifiers x, y;
  PFApplStatus first, second;
  PFApplStatMod oldX(&x, 1), newX(&x, -2), oldY(&y, 3), newY(&y, 1);
  first.childApplicators = {&oldX, &oldY};
  second.childApplicators = {&newX, &newY};
  first.mergeApplicators = {&second};
  second.mergeApplicators = {&first};
  second.MergeByValue();
  assert(!oldX.IsEnabled() && newX.IsEnabled() && oldY.IsEnabled() &&
         !newY.IsEnabled());
  second.duration = 2;
  first.duration = 5;
  assert(!first.Step(2) && second.Step(2));
  second.Stop();
  assert(first.duration == 3);
  assert(oldX.IsEnabled() && oldY.IsEnabled());

  PFApplStatus third, fourth;
  PFApplStatMod cappedOld(&x, 1), cappedNew(&x, 1);
  third.childApplicators = {&cappedOld};
  fourth.childApplicators = {&cappedNew};
  third.mergeApplicators = {&fourth};
  fourth.mergeApplicators = {&third};
  fourth.MergeByValue(); // Equal effective changes: strict > leaves the initial
                         // candidate.
  assert(!cappedOld.IsEnabled() && cappedNew.IsEnabled());
  std::cout << "PASS original r1117 power, lifetime, unblock and stat-merge "
               "methods, same-step traversal and synchronous listeners\n";
}
