"""Program wait boundaries for the r1117 page expressions."""

from math import isclose


def verify(cases, evaluate, xml, ordered):
    ordered(
        "PFApplSpecial.cpp",
        "bool PFApplProgram::ExecuteNext()",
        "if ( shouldStopByCondition )",
        "ready2Execute |= shouldContinueByCondition",
        "if ( currentDelayTimer < 0.0f )",
        "if ( !ready2Execute )",
        "applicatorExecuting++;",
        "pApplExecuting = pAppl",
        "ActivateApplicator( pAppl, pAbility )",
        "} while ( ready2Execute",
    )
    ordered(
        "PFApplSpecial.cpp",
        "void PFApplProgram::OnNotification",
        "&appl != pApplExecuting.GetPtr() || IsFinished()",
        "stopEvents & (1 << note)",
        "NotifyParent(NDb::PARENTNOTIFICATION_CANCEL)",
        "continueEvents & (1 << note)",
        "ready2Execute = true",
        "bool PFApplProgram::Step(",
        "currentDelayTimer -= dtInSeconds",
        "const bool finished = !ExecuteNext();",
    )
    ordered(
        "DBAbility.h",
        "PARENTNOTIFICATION_START = 0",
        "PARENTNOTIFICATION_STOP = 1",
        "PARENTNOTIFICATION_DONE = 2",
    )
    rows = set()
    checks = 0

    def read(j, state, expected, runtime=False, learn=(), **kw):
        nonlocal checks
        got = evaluate(cases[j - 1], state, runtime, learned=learn, **kw)
        assert isclose(got, expected, abs_tol=1e-6), (j, state, got, expected)
        rows.add(j)
        checks += 1

    def entry_before(path, following):
        for program in xml("Items/Talents/Class/" + path + ".xdb").iter(
            "ProgramApplicator"
        ):
            entries = program.findall("applicators/Item")
            for previous, entry in zip(entries, entries[1:]):
                a = entry.find("applicator")
                child = a[0] if len(a) else None
                if child is not None and following in (
                    child.tag,
                    child.findtext("modifier/variable"),
                    child.findtext("formulaName"),
                ):
                    return previous, child
        raise AssertionError((path, following))

    def after_notification(entry, observer, advance_before_change, stop=False):
        # Two different child instances can use the same configuration.
        prior, current = object(), object()
        ready = finished = False

        def notify(source, event):
            nonlocal ready, finished
            if source is current and not finished:
                if int(entry.findtext("stopEvents")) & (1 << event):
                    finished = True
                elif int(entry.findtext("continueEvents")) & (1 << event):
                    ready = True

        event = int(entry.findtext("continueEvents")).bit_length() - 1
        assert event in (0, 1) and int(entry.findtext("continueEvents")) == (1 << event)
        notify(prior, event)
        notify(current, 2)  # DONE differs from START and STOP in these configs
        assert not ready and not finished
        notify(current, event)
        assert ready and not finished
        unchanged = True

        def advance():
            nonlocal ready, finished
            if stop:
                finished = True
            if ready and not finished:
                observer(unchanged)
                ready = False

        if advance_before_change:
            advance()
        unchanged = False
        advance()

    # For each possible same-frame order read either side of an independent write.
    # The native probe executes the engine loop, including its synchronous path.
    bard, _ = entry_before("Bard/Ability_A3.TALENT", "Bard_ShieldsCounter")
    assert (
        bard.find("applicator").get("href") == ""
        and bard.findtext("delay/sString") == "cA3_Duration - cSTEP"
    )
    guns, save = entry_before("Gunslinger/Ability_A4_2.TALENT", "A4_2SaveDuration")
    vamp, target = entry_before("Vampire/Ability_A2.TALENT", "A2_Target")
    demon, summon = entry_before("Demonolog/Ability4.TALENT", "SummonApplicator")
    monster, add = entry_before(
        "Monster/Ability_A4.TALENT", "Monster_A4CurrentToxinStack"
    )
    for first in (True, False):

        def shields(early):
            for j in (21, 25):
                read(j, {"GetVariable": 2 if early else 1}, 72 if early else 36, True)

        # Empty delay entry: there is no child to send STOP. At zero the
        # next entry still waits, on a strictly negative tick it enumerates.
        remaining = 0.125
        remaining -= 0.125
        assert remaining == 0
        remaining -= 0.125
        if remaining < 0:
            shields(first)

        def save_duration(early):
            state = {"vHero_Rage": 20 if early else 0}
            duration = evaluate(
                cases[48], state, expr=save.findtext("modifier/addValue/sString")
            )
            read(49, {"vA4_2SaveDuration": duration}, 1.6 if early else 0.8, True)

        after_notification(guns, save_duration, first)

        def hit(early):
            state = {"vA2_HeroCounter": 7 if early else 0}
            assert (
                bool(
                    evaluate(cases[71], state, expr=target.findtext("enabled/sString"))
                )
                == early
            )
            read(72, state, 4 if early else 12)

        after_notification(vamp, hit, first)

        def next_summon(early):
            state = {"vDemonsLaunch": 3, "vDemonsIsAlive": 3 if early else 1}
            allowed = evaluate(
                cases[27],
                state,
                learned=("Demonolog_A4u",),
                expr=summon.findtext("enabled/sString"),
            )
            assert bool(allowed) == (not early)
            if allowed:
                state["vDemonsIsAlive"] += evaluate(
                    cases[27], state, expr=summon.findtext("summonedUnitsCount/sString")
                )
            for j in (28, 29):
                read(j, state, 300 if early else 200)

        after_notification(demon, next_summon, first)

        def toxin(early):
            state = {
                "vMonster_A4CurrentToxinStack": 3 if early else 4,
                "vTotal_CooldownReduction": 20,
            }
            allowed = evaluate(cases[60], state, expr=add.findtext("enabled/sString"))
            assert bool(allowed) == early
            read(
                61, state, 24, True
            )  # cooldown length is distinct from permission to add

        after_notification(monster, toxin, first)

    # Actual data: PantherTime continues on START, but its own stopCondition
    # is checked before the next entry even when START already made it ready.
    night = xml("Items/Talents/Class/Night/Ability4_2.TALENT.xdb")
    entry = next(
        e
        for e in night.iter("Item")
        if e.findtext("applicator/AbilityModApplicator/formulaName") == "PantherTime"
    )
    assert entry.findtext("continueEvents") == "1"
    for flag in (0, 1):
        stopped = evaluate(
            cases[64],
            {"vVampResStarted": flag},
            expr=entry.findtext("stopCondition/sString"),
        )
        seen = []
        after_notification(entry, seen.append, True, stop=stopped)
        assert seen == ([] if flag else [True])
        read(65, {"applPantherTime": 1}, 10 / 3)  # already registered in this scenario

    # The other rows observe a variable, registration or stored value. A late
    # notification itself does not write that input. Compare reads before and
    # after a separate intervening write (including snapshots that stay fixed).
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
        (48, "vA4_FrogJump", 1, 0, 100, 200, False, {}, ()),
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
            for i in (62, 63)
        ),
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
    ]:
        read(j, {key: old, **extra}, a, runtime, learn)
        read(j, {key: new, **extra}, b, runtime, learn)
    return rows, checks
