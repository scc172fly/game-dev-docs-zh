#pragma once
namespace program_probe {
namespace NDb {
enum EParentNotification {
  PARENTNOTIFICATION_START,
  PARENTNOTIFICATION_STOP,
  PARENTNOTIFICATION_DONE,
  PARENTNOTIFICATION_CANCEL
};
struct BaseApplicator {
  std::function<bool()> activate;
};
template <class T> struct Ptr {
  T *p = nullptr;
  bool IsEmpty() const { return !p; }
};
} // namespace NDb
using PFBaseApplicator = NDb::BaseApplicator;
struct Target {
  explicit Target(int) {}
};
struct PFApplProgram;
struct PFApplCreatePars {
  NDb::Ptr<NDb::BaseApplicator> pDBAppl;
  PFApplCreatePars(int, Target, PFApplProgram *) {}
};
PFBaseApplicator *CreateApplicator(PFApplCreatePars cp) { return cp.pDBAppl.p; }
bool ActivateApplicator(PFBaseApplicator *p, int) { return p->activate(); }
struct PFApplBuff {
  bool Step(float) { return false; }
};
struct PFApplProgram : PFApplBuff {
  struct Entry {
    NDb::Ptr<NDb::BaseApplicator> applicator;
    bool stopCondition = false, continueCondition = false;
    int continueEvents = 2, stopEvents = 0;
    float delay = -1;
  };
  struct {
    std::vector<Entry> applicators;
  } db;
  auto &GetDB() { return db; }
  int pAbility = 0, pReceiver = 0, applicatorExecuting = -1;
  bool ready2Execute = true, isDelayTimerEnabled = false;
  float currentDelayTimer = 0;
  struct Current {
    PFBaseApplicator *p = nullptr;
    void operator=(PFBaseApplicator *item) { p = item; }
    auto GetPtr() const { return p; }
  } pApplExecuting;
  template <class T> T RetrieveParam(T value, T) { return value; }
  bool IsFinished() const {
    return applicatorExecuting >= int(db.applicators.size());
  }
  std::vector<NDb::EParentNotification> notices;
  std::function<void(NDb::EParentNotification)> forward;
  void NotifyParent(NDb::EParentNotification n) {
    notices.push_back(n);
    if (forward)
      forward(n);
  }
  bool Step(float);
  bool ExecuteNext();
  void OnNotification(PFBaseApplicator &, NDb::EParentNotification);
  void add(PFBaseApplicator &a) { db.applicators.push_back({{&a}}); }
};
#include "program_methods.inc"
#include "program_tick.inc"

inline void verify_notification_order() {
  using namespace NDb;
  for (bool stop : {false, true})
    for (bool notifyBeforeTick : {false, true}) {
      PFApplProgram p;
      PFBaseApplicator first, current, consumer;
      int layers = 1, seen = -1, calls = 0;
      first.activate = [&] {
        p.OnNotification(first, PARENTNOTIFICATION_START);
        return true;
      };
      current.activate = [] { return true; };
      consumer.activate = [&] {
        ++calls;
        seen = layers;
        return false;
      };
      p.add(first);
      p.add(current);
      p.add(consumer);
      p.db.applicators[0].continueEvents = 1;
      assert(p.ExecuteNext() && p.applicatorExecuting == 1);
      p.OnNotification(first, PARENTNOTIFICATION_STOP);
      assert(!p.Step(.125f) && calls == 0); // stale matching bit, wrong child
      layers = 2;
      if (!notifyBeforeTick)
        assert(!p.Step(.125f));
      p.OnNotification(current, PARENTNOTIFICATION_STOP);
      assert(calls == 0); // asynchronous continue marks ready only
      if (!notifyBeforeTick)
        layers = 3;
      p.db.applicators[1].continueCondition = true;
      p.db.applicators[1].stopCondition = stop;
      assert(p.Step(.125f));
      assert(calls == (stop ? 0 : 1) && seen == (stop ? -1 : layers));
      assert(p.notices.back() == PARENTNOTIFICATION_DONE);
    }
  PFApplProgram p;
  PFBaseApplicator prior, hold, next;
  prior.activate = [&] {
    p.OnNotification(prior, PARENTNOTIFICATION_START);
    return true;
  };
  hold.activate = [] { return true; };
  next.activate = [] {
    assert(false);
    return false;
  };
  p.add(prior);
  p.add(hold);
  p.add(next);
  p.db.applicators[0].continueEvents = 1;
  p.db.applicators[1].stopEvents = 2;
  assert(p.ExecuteNext());
  p.OnNotification(prior, PARENTNOTIFICATION_STOP);
  assert(!p.IsFinished() && p.notices.empty());
  p.OnNotification(hold, PARENTNOTIFICATION_STOP); // both masks contain STOP
  assert(p.IsFinished() && p.notices.size() == 1 &&
         p.notices[0] == PARENTNOTIFICATION_CANCEL);
  p.OnNotification(hold, PARENTNOTIFICATION_STOP);
  assert(p.notices.size() == 1);
  PFApplProgram timed;
  PFBaseApplicator timer, read;
  int ticks = 0;
  timer.activate = [] { return true; };
  read.activate = [&] {
    ++ticks;
    return false;
  };
  timed.db.applicators.push_back({});
  timed.add(read);
  timed.db.applicators[0].delay = .125f;
  assert(timed.ExecuteNext());
  assert(timed.isDelayTimerEnabled);
  assert(!timed.Step(.125f) && timed.currentDelayTimer == 0 && ticks == 0);
  assert(timed.Step(.125f) && ticks == 1);
  std::cout << "PASS r1117 late child notifications, stop priority, tick "
               "boundary and live layer reads\n";
}

inline void verify_delay_collisions() {
  using namespace NDb;
  struct Scenario {
    int mask, note;
    bool beforeTick, overdue;
    int readTick;
  };
  const Scenario scenarios[] = {
#include "delay_cases.inc"
  };
  for (const auto &s : scenarios) {
    PFApplProgram p;
    PFBaseApplicator timed, reader, tail;
    int layers = 2, tick = 0, tailCalls = 0;
    std::vector<int> visits, values;
    timed.activate = [] { return true; };
    reader.activate = [&] {
      visits.push_back(tick);
      values.push_back(layers);
      return true;
    };
    tail.activate = [&] {
      ++tailCalls;
      return false;
    };
    p.add(timed);
    p.add(reader);
    p.add(tail);
    p.db.applicators[0].delay = .125f;
    p.db.applicators[0].continueEvents = s.mask;
    assert(p.ExecuteNext()); // waiting child was created
    assert(!p.Step(.125f) && p.currentDelayTimer == .125f);
    if (s.overdue)
      assert(!p.Step(.125f) && p.currentDelayTimer == 0);
    auto signal = [&] {
      p.OnNotification(timed, static_cast<EParentNotification>(s.note));
    };
    if (s.beforeTick) {
      signal();
      signal();
    }
    assert(!p.Step(.125f));
    if (!s.beforeTick) {
      signal();
      signal();
    }
    assert(visits.size() == (s.readTick == 0 ? 1 : 0));
    ++tick;
    layers = 1;
    // At exactly zero a matching event advances the index while leaving the
    // timer armed. Crossing zero in the next entry can advance to the tail.
    bool finished = p.Step(.125f);
    const bool carry = !s.overdue && s.readTick == 0;
    assert(finished == carry && tailCalls == int(carry));
    assert(visits == std::vector<int>{s.readTick});
    assert(values == std::vector<int>{s.readTick == 0 ? 2 : 1});
    signal(); // now stale
    if (!finished) {
      assert(!p.Step(.125f) && tailCalls == 0);
      p.OnNotification(reader, PARENTNOTIFICATION_STOP);
      assert(p.Step(.125f));
    }
    assert(tailCalls == 1 && visits.size() == 1);
  }
  // A normally completing nested program emits DONE from Step, then STOP
  // from the applicator ring's teardown. Drive both against the same parent.
  for (int mask : {2, 4, 6})
    for (bool childFirst : {true, false}) {
      PFApplProgram outer, inner;
      PFBaseApplicator nested, work, read;
      int layers = 2, calls = 0, seen = -1;
      inner.forward = [&](EParentNotification note) {
        outer.OnNotification(nested, note);
      };
      work.activate = [] { return true; };
      inner.add(work);
      nested.activate = [&] { return inner.ExecuteNext(); };
      read.activate = [&] {
        ++calls;
        seen = layers;
        return false;
      };
      outer.add(nested);
      outer.add(read);
      outer.db.applicators[0].delay = .125f;
      outer.db.applicators[0].continueEvents = mask;
      assert(outer.ExecuteNext() && !outer.Step(.125f));
      auto finishChild = [&] {
        inner.OnNotification(work, PARENTNOTIFICATION_STOP);
        assert(inner.Step(.125f));
        assert(inner.notices.size() == 1 &&
               inner.notices[0] == PARENTNOTIFICATION_DONE);
        outer.OnNotification(nested, PARENTNOTIFICATION_STOP);
      };
      if (childFirst)
        finishChild();
      assert(outer.Step(.125f) == childFirst);
      if (!childFirst) {
        assert(calls == 0);
        finishChild();
        layers = 1;
        assert(outer.Step(.125f));
      }
      assert(calls == 1 && seen == (childFirst ? 2 : 1));
    }
  std::cout << "PASS original zero/negative timer, STOP/DONE collisions and "
               "timer carry-over\n";
}

inline void verify() {
  verify_delay_collisions();
  verify_notification_order();
  for (int veto : {-1, 0, 1, 2}) {
    PFApplProgram outer, inner;
    PFBaseApplicator nested, write, middle, read, tail;
    int layers = 2, seen = -1, tailSeen = -1;
    outer.add(nested);
    outer.add(tail);
    inner.add(write);
    inner.add(middle);
    inner.add(read);
    nested.activate = [&] {
      if (veto == 0)
        return false;
      inner.ExecuteNext();
      return true;
    };
    write.activate = [&] {
      if (veto == 1)
        return false;
      ++layers;
      inner.OnNotification(write, NDb::PARENTNOTIFICATION_STOP);
      return true;
    };
    middle.activate = [&] {
      return veto != 2;
    }; // success waits for its notification
    read.activate = [&] {
      seen = layers;
      inner.OnNotification(read, NDb::PARENTNOTIFICATION_STOP);
      return true;
    };
    tail.activate = [&] {
      tailSeen = layers;
      return false;
    };
    outer.ExecuteNext();
    if (veto != 0) {
      if (veto != 2) {
        assert(seen == -1 && tailSeen == -1);
        inner.OnNotification(write, NDb::PARENTNOTIFICATION_STOP);
        assert(inner.ExecuteNext() && seen == -1);
        inner.OnNotification(middle, NDb::PARENTNOTIFICATION_STOP);
        assert(!inner.ExecuteNext());
      }
      outer.OnNotification(nested, NDb::PARENTNOTIFICATION_STOP);
      assert(!outer.ExecuteNext());
    }
    assert(tailSeen == (veto == 0 || veto == 1 ? 2 : 3));
    assert(seen == (veto == 0 ? -1 : tailSeen));
  }
  PFApplProgram p;
  PFBaseApplicator rejected, last;
  rejected.activate = [] { return false; };
  last.activate = [] {
    assert(false);
    return true;
  };
  p.add(rejected);
  p.add(last);
  p.db.applicators[0].stopCondition = true;
  assert(!p.ExecuteNext() && p.applicatorExecuting == 0);
  PFApplProgram wait;
  PFBaseApplicator hold, after;
  hold.activate = [] { return true; };
  after.activate = [] {
    assert(false);
    return true;
  };
  wait.add(hold);
  wait.add(after);
  wait.db.applicators[0].stopEvents = 2;
  assert(wait.ExecuteNext());
  wait.OnNotification(hold, NDb::PARENTNOTIFICATION_STOP);
  assert(wait.IsFinished() && !wait.ExecuteNext());
  std::cout
      << "PASS original nested program veto, wait, stop and layer-read order\n";
}
} // namespace program_probe
