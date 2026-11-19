"""Same-frame collisions between a program timer and a child notification."""

from dataclasses import dataclass
from math import isclose


@dataclass(frozen=True)
class Collision:
    # All times are exact multiples of 1/8. The child is already waiting.
    mask: int
    note: int
    before_tick: bool
    overdue: bool
    read_tick: int


# Independent expected read tick. Tick 0 sees the original layers; a state
# change between ticks means tick 1 sees the updated ones. STOP=1, DONE=2.
SCENARIOS = (
    Collision(2, 1, True, False, 0),
    Collision(2, 1, False, False, 1),
    Collision(2, 2, True, False, 1),
    Collision(2, 2, False, False, 1),
    Collision(2, 1, True, True, 0),
    Collision(2, 2, False, True, 0),
    Collision(1, 1, True, False, 1),
    Collision(1, 2, True, False, 1),
    # Engine controls: DONE-only and a mask accepting either notification.
    Collision(4, 2, True, False, 0),
    Collision(4, 1, True, False, 1),
    Collision(6, 2, True, True, 0),
)


def verify(cases, evaluate, xml, ordered):
    ordered(
        "PFApplSpecial.cpp",
        "ready2Execute |= shouldContinueByCondition",
        "if ( currentDelayTimer < 0.0f )",
        "ready2Execute = true;",
        "isDelayTimerEnabled = false;",
        "if ( !ready2Execute )",
        "ready2Execute = false;",
        "applicatorExecuting++;",
        "pApplExecuting = pAppl",
    )
    ordered(
        "PFApplSpecial.cpp",
        "void PFApplProgram::OnNotification",
        "&appl != pApplExecuting.GetPtr()",
        "stopEvents & (1 << note)",
        "continueEvents & (1 << note)",
        "ready2Execute = true;",
        "bool PFApplProgram::Step(",
        "currentDelayTimer -= dtInSeconds",
        "!ExecuteNext()",
    )
    ordered(
        "PFApplSpecial.cpp",
        "bool PFApplProgram::Step(",
        "const bool finished = !ExecuteNext();",
        "NotifyParent(NDb::PARENTNOTIFICATION_DONE)",
        "return finished;",
    )
    ordered(
        "PFApplicator.h",
        "if (applicator->Step(dtInSeconds))",
        "applicator->Stop();",
        "MemorizeApplicator(pHolder)",
    )
    ordered(
        "PFApplicator.cpp",
        "void PFBaseApplicator::Stop()",
        "pParent->OnNotification(*this, NDb::PARENTNOTIFICATION_STOP)",
    )

    def entries(path):
        return [
            e
            for n in xml("Items/Talents/Class/" + path + ".xdb").iter(
                "ProgramApplicator"
            )
            for e in n.findall("applicators/Item")
        ]

    vampire = next(
        e
        for e in entries("Vampire/Ability_A2.TALENT")
        if e.findtext("delay/sString") == "cA2_OutOfSightTimeThreshold - 0.1"
    )
    assert (
        vampire.findtext("continueEvents") == "2"
        and vampire.findtext("stopCondition/sString")
        == "receiver.IsVisibleForEnemy(sFctn)"
    )
    mage = next(
        e
        for e in entries("Mage/Ability2.TALENT")
        if e.findtext("applicator/ChannellingApplicator/formulaName") == "A2Channel"
    )
    assert (
        mage.findtext("continueEvents"),
        mage.findtext("delay/sString"),
        mage.findtext("stopCondition/sString"),
    ) == ("1", "cChannelTime + 0.1", "appl.parent.vInterrupted == 0")
    bard = next(
        e
        for e in entries("Bard/Ability_A3.TALENT")
        if e.findtext("delay/sString") == "cA3_Duration - cSTEP"
    )
    assert (
        bard.find("applicator").get("href") == ""
        and bard.findtext("continueCondition/sString") == "0"
    )
    # Formula consumers below are reads at observed update boundaries; a
    # field lookup or spawn-time snapshot is not itself a new child program.
    rows = set()
    checks = 0

    def read(j, state, want, runtime=False, learn=(), expr=None):
        nonlocal checks
        got = evaluate(cases[j - 1], state, runtime, learned=learn, expr=expr)
        assert isclose(got, want, abs_tol=1.0e-6), (j, state, got, want)
        rows.add(j)
        checks += 1

    for event in SCENARIOS:
        remaining = 0 if event.overdue else 0.125
        ready = False
        visits = []
        for tick in (0, 1):
            if tick == 0 and event.before_tick:
                ready = bool(event.mask & (1 << event.note))
            remaining -= 0.125
            if ready or remaining < 0:
                visits.append(tick)
                break
            if tick == 0 and not event.before_tick:
                ready = bool(event.mask & (1 << event.note))
        assert visits == [event.read_tick]
        # The common observation window compares the same two possible update
        # orders. For the actual empty Bard slot, no child can release it at 0.
        early = visits[0] == 0
        for j, key, old, new, a, b, runtime, extra, learn in [
            *(
                (i, "applArtist_A4_status", 1, 0, 11, 0, False, {}, ("Artist_A4",))
                for i in (13, 14)
            ),
            (22, "vBardStacks_A4Start", 5, 5, 5.25, 5.25, True, {}, ()),
            (
                26,
                "vBladeDancer_Mastery",
                2,
                1,
                62.7,
                59.85,
                True,
                {},
                ("BladeDancer_A0_SUP",),
            ),
            *((i, "vDemonsIsAlive", 2, 1, 200, 100, False, {}, ()) for i in (28, 29)),
            (48, "vA4_FrogJump", 1, 0, 100, 200, False, {}, ()),
            (49, "vA4_2SaveDuration", 1.6, 1.6, 1.6, 1.6, True, {}, ()),
            *(
                (i, "vHealer_A5_SpellShieldCounter", 1, 0, 1, 0, True, {}, ())
                for i in (50, 51)
            ),
            (54, "vInventor_Details", 0, 100, 4, 0, True, {"CountApplicators": 1}, ()),
            *(
                (i, "vMage_A0_DamageCounter", 3, 0, x, y, True, {}, ())
                for i, x, y in (
                    (55, 0.3, 0.6),
                    (56, 0.4, 1),
                    (57, 0.3, 0.6),
                    (58, 0.3, 0.6),
                )
            ),
            *(
                (i, "vTotal_CooldownReduction", 0, 20, 30, 24, True, {}, ())
                for i in (61, 62, 63)
            ),
            (65, "applPantherTime", 1, 0, 10 / 3, 0, False, {}, ()),
            (67, "FindApplicator", 1, 0, 0, 23, False, {}, ()),
            (
                68,
                "vA0Shadow_BlockCounter",
                5,
                6,
                0.65,
                0.64,
                True,
                {"GetVariable": 10000},
                (),
            ),
            *(
                (i, "vHatred", 2, 1, x, y, True, {}, ())
                for i, x, y in ((69, 20, 10), (70, 3.2, 1.6), (71, 3.2, 1.6))
            ),
            (72, "vA2_HeroCounter", 7, 0, 4, 12, False, {}, ()),
        ]:
            read(
                j,
                {key: old if early else new, **extra},
                a if early else b,
                runtime,
                learn,
            )
    for survivors in (1, 2):
        for j in (21, 25):
            read(j, {"GetVariable": survivors}, 36 * survivors, True)
    return rows, checks
