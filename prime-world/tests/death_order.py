"""Ordinary unit death, unsummoning and selective cleanup in r1117."""

from itertools import permutations
from math import isclose


def verify(cases, evaluate, xml, ordered):
    ordered(
        "PFWorld.cpp",
        "PF_Core::World::Step(dtInSeconds, dtLocal)",
        "KillDeadUnits();",
        "deadUnits.push_back",
        "i < deadUnits.size()",
        "unit->CleanupAfterDeath(fullCleanup)",
    )
    ordered("PFWorld.h", "KillDeadUnits( bool fullCleanup = false )")
    ordered(
        "PFBehaviour.cpp",
        "void PFSummonBehaviour::Unsummon()",
        "KillUnit(NULL, PFBaseUnit::UNITDIEFLAGS_UNSUMMON",
    )
    ordered(
        "PFBaseUnit.cpp",
        "health = 0;",
        "OnUnitDie( pKiller, flags",
        "void PFBaseUnit::OnUnitDie",
        "CancelAbilities()",
        "SUMMONTYPE_PRIMARY",
        "SUMMONTYPE_PET",
        "AwardKillers",
        "SendUnitDieNotification",
        "EventHappened( PFBaseUnitEventUnitDeath",
        "if(!isDeathDeferred)",
        "StoreDeadUnit(this)",
        "void PFBaseUnit::CleanupAfterDeath",
        "if (bFullCleanUp)",
        "RemoveAppliedApplicators();",
        "RemoveSentApplicators();",
        "else",
        "RemoveAppliedApplicatorsOnDeath();",
        "RemoveSentApplicatorsOnDeath();",
    )
    ordered(
        "PFBaseUnitAppl.cpp",
        "if ( app->NeedToStopOnDeath() )",
        "app->Stop();",
        "app->RemoveFromRingsSafe();",
        "if ( app->NeedToStopOnSenderDeath() )",
        "app->Stop();",
        "app->RemoveFromRingsSafe();",
    )
    ordered(
        "DBAbility.h",
        "BUFFBEHAVIOR_DONTSTOPONDEATH = 8",
        "BUFFBEHAVIOR_ENABLEDONSENDERDEATH = 16",
        "BUFFBEHAVIOR_DONTSTOPONSENDERDEATH = 128",
    )
    ordered(
        "PFApplBuff.cpp",
        "PFApplBuff::NeedToStopOnDeath",
        "BUFFBEHAVIOR_DONTSTOPONDEATH",
        "bPassive",
        "PFApplBuff::NeedToStopOnSenderDeath",
        "BUFFBEHAVIOR_DONTSTOPONSENDERDEATH",
        "bPassive",
    )
    ordered("PFSummoned.h", "PFBaseSummonedUnit : public PFBaseCreep")
    ordered("PFCreep.cpp", "void PFBaseCreep::RemoveCorpse()", "Die();")
    ordered("PFBaseUnit.cpp", "void PFBaseUnit::OnDie()", "CleanupAfterDeath(true)")
    ordered(
        "PFApplMod.cpp",
        "PFApplStatMod::Disable()",
        "RemoveModifier( modifierID )",
        "PFApplStatus::Disable()",
        "RemoveChildrenApplicators()",
    )
    checked = set()
    checks = 0

    def read(j, state, expected, runtime=False, learned=()):
        nonlocal checks
        got = evaluate(cases[j - 1], state, runtime, learned)
        assert isclose(got, expected, abs_tol=1e-6), (j, state, got, expected)
        checked.add(j)
        checks += 1

    def resource(path):
        return xml("Items/Talents/Class/" + path)

    # Both death notifications precede cleanup in this controlled step. No
    # independent expiry, talent toggle, intercept or explicit removal intervenes.
    for path, name, indices, var, present, absent in [
        (
            "Rifleman/Status_A0.APLR.xdb",
            "RiflemanA0Mark",
            (67,),
            "FindApplicator",
            0,
            23,
        ),
        (
            "Artist/status_A4_artist.APLR.xdb",
            "Artist_A4_status",
            (13, 14),
            "applArtist_A4_status",
            11,
            0,
        ),
        (
            "Night/Ability4_2.TALENT.xdb",
            "PantherTime",
            (65,),
            "applPantherTime",
            10 / 3,
            0,
        ),
    ]:
        node = next(
            n for n in resource(path).iter() if n.findtext("formulaName") == name
        )
        flags = int(node.findtext("behaviorFlags"))
        for order in permutations(("caster", "target")):
            live = True

            def sample(expected):
                for j in indices:
                    read(
                        j,
                        {var: int(live)},
                        present if expected else absent,
                        learned=("Artist_A4",),
                    )

            sample(True)
            for unit in order:
                # Artist and Night carry their own effect. The other unit is unrelated.
                if indices != (67,) and unit == "caster":
                    live &= bool(flags & 8 and flags & 128)
                elif indices == (67,):
                    live &= bool(flags & (128 if unit == "caster" else 8))
                expected = (
                    unit == "caster" and order[0] == unit
                    if indices == (67,)
                    else indices == (65,)
                    or "caster" not in order[: order.index(unit) + 1]
                )
                sample(expected)

    parent = next(resource("Demonolog/SummonDemons.APLR.xdb").iter("StatusApplicator"))
    child = next(
        n
        for n in parent.iter("StatModApplicator")
        if n.findtext("modifier/variable") == "DemonsIsAlive"
    )
    assert (
        child.findtext("applyTarget") == "AbilityOwner"
        and not int(parent.findtext("behaviorFlags")) & 8
    )
    increment = evaluate(
        cases[27], {}, expr=child.findtext("modifier/addValue/sString")
    )
    # Two independent summons. Check before/after each notification, receiver
    # tick, selective cleanup and full object destruction.
    for tick_first, destroy_early in (
        (False, False),
        (True, False),
        (False, True),
        (True, True),
    ):
        live = {"first", "second"}

        def sample_demons(expected):
            for j in (28, 29):
                read(j, {"vDemonsIsAlive": len(live) * increment}, expected)

        events = ["tick", "unsummon"] if tick_first else ["unsummon", "tick"]
        if destroy_early:
            events.insert(events.index("unsummon") + 1, "destroy")
        for event in events + ["cleanup_first", "cleanup_second"]:
            if event in ("destroy", "cleanup_first"):
                live.discard("first")
            if event == "cleanup_second":
                live.remove("second")
            sample_demons(
                300
                if event == "cleanup_second"
                else 100
                if event in ("destroy", "cleanup_first")
                or (event == "tick" and destroy_early and not tick_first)
                else 200
            )

    # Independent snapshots for the remaining rows. The second sample isolates
    # selective cleanup from explicit skill writes and subsequent enumeration.
    for j, var, before, after, first, last, runtime, learned, fixed in [
        *((i, "GetVariable", 1, 1, 36, 36, True, (), {}) for i in (21, 25)),
        (22, "vBardStacks_A4Start", 5, 5, 5.25, 5.25, True, (), {}),
        (26, "vBladeDancer_Mastery", 2, 0, 62.7, 57, True, ("BladeDancer_A0_SUP",), {}),
        (48, "vA4_FrogJump", 1, 1, 100, 100, False, (), {}),
        (49, "vA4_2SaveDuration", 1.6, 1.6, 1.6, 1.6, True, (), {}),
        *(
            (i, "vHealer_A5_SpellShieldCounter", 1, 1, 1, 1, True, (), {})
            for i in (50, 51)
        ),
        (54, "CountApplicators", 1, 0, 4, 3, True, (), {"vInventor_Details": 0}),
        *(
            (i, "vMage_A0_DamageCounter", 3, 0, b, a, True, (), {})
            for i, b, a in (
                (55, 0.3, 0.6),
                (56, 0.4, 1),
                (57, 0.3, 0.6),
                (58, 0.3, 0.6),
            )
        ),
        *(
            (i, "vTotal_CooldownReduction", 20, 20, 24, 24, True, (), {})
            for i in (61, 62, 63)
        ),
        (
            68,
            "vA0Shadow_BlockCounter",
            5,
            5,
            0.65,
            0.65,
            True,
            (),
            {"GetVariable": 10000},
        ),
        *(
            (i, "vHatred", 2, 2, n, n, True, (), {})
            for i, n in ((69, 20), (70, 3.2), (71, 3.2))
        ),
        (72, "vA2_HeroCounter", 7, 0, 4, 12, False, (), {}),
    ]:
        read(j, {var: before, **fixed}, first, runtime, learned)
        read(j, {var: after, **fixed}, last, runtime, learned)
    return checked, checks
