"""Program-entry veto, skipped child writes, and downstream formula reads."""

from math import isclose


def verify(cases, evaluate, xml, ordered):
    ordered(
        "PFApplSpecial.cpp",
        "bool PFApplProgram::ExecuteNext()",
        "if ( shouldStopByCondition )",
        "if ( !ready2Execute )",
        "applicatorExecuting++;",
        "if ( !ActivateApplicator( pAppl, pAbility ) )",
        "ready2Execute = true;",
        "} while ( ready2Execute",
        "void PFApplProgram::OnNotification",
        "&appl != pApplExecuting.GetPtr()",
        "stopEvents &",
        "continueEvents &",
    )
    ordered(
        "PFBaseUnitAppl.cpp",
        "if ( evtApplicator.IsApplicatorCancelled() )",
        "return false;",
        "pApplicator->Start()",
    )
    rows = set()
    checks = 0

    def read(j, state, want, runtime=False, learned=()):
        nonlocal checks
        got = evaluate(cases[j - 1], state, runtime, learned)
        assert isclose(got, want, abs_tol=1e-6), (j, state, got, want)
        rows.add(j)
        checks += 1

    def resource(path):
        return xml("Items/Talents/Class/" + path + ".xdb")

    def steps(path, key):
        for program in resource(path).iter("ProgramApplicator"):
            children = program.findall("applicators/Item/applicator")
            names = [
                (
                    a[0].findtext("modifier/variable")
                    or a[0].findtext("formulaName")
                    or a[0].tag
                )
                if len(a)
                else a.get("href", "").split("/")[-1]
                for a in children
            ]
            if key in names:
                return list(zip(names, children))
        raise AssertionError(key)

    def write(j, node, state):
        mod = node.find("modifier")
        key = "v" + mod.findtext("variable")

        def val(field):
            return evaluate(cases[j - 1], state, expr=mod.findtext(field + "/sString"))

        state[key] = val("multValue") * state.get(key, 0) + val("addValue")

    # Advance only after any configured waits have completed. Exercise skips
    # at the actual entry positions; no independent replacement writer runs.
    guns = steps("Gunslinger/Ability_A4_2.TALENT", "A4_2SaveDuration")
    assert [n for n, _ in guns][4:8] == [
        "A4_2SaveDuration",
        "HealApplicator",
        "Hero_Rage",
        "ChannellingApplicator",
    ]
    for veto in (
        "outer",
        "A4_2SaveDuration",
        "HealApplicator",
        "Hero_Rage",
        "ChannellingApplicator",
    ):
        state = {"vHero_Rage": 20, "vA4_2SaveDuration": 0.8}
        observed = []
        for name, item in [] if veto == "outer" else guns[4:8]:
            if name == veto:
                continue
            if name in ("Hero_Rage", "A4_2SaveDuration"):
                write(49, item[0], state)
            if name == "ChannellingApplicator":
                observed.append(state["vA4_2SaveDuration"])
                read(49, state, 0.8 if veto == "A4_2SaveDuration" else 1.6, True)
        assert bool(observed) == (veto not in ("outer", "ChannellingApplicator"))
        read(49, state, 1.6 if veto in ("outer", "Hero_Rage") else 0.8)
    jump = steps("Frogenglut/Ability4.TALENT", "RefreshCooldownApplicator")
    assert [k for k, _ in jump] == [
        "RefreshCooldownApplicator",
        "A4_FrogJump",
        "ProgramApplicator",
    ]
    inner = jump[-1][1][0].findall("applicators/Item/applicator")
    for veto in ("outer", "add", "inner", "reset", None):
        state = {"vA4_FrogJump": 0}
        if veto not in ("outer", "add"):
            write(48, jump[1][1][0], state)
        read(48, state, 200 if veto in ("outer", "add") else 100)
        if veto not in ("outer", "inner", "reset"):
            write(48, inner[-1][0], state)
        read(48, state, 100 if veto in ("inner", "reset") else 200)
    bard = steps("Bard/Ability_A3.TALENT", "Bard_ShieldsCounter")
    assert [k for k, _ in bard][-2:] == ["Bard_ShieldsCounter", "HealApplicator"]
    for veto in ("outer", "counter", "heal", None):
        seen = []
        if veto not in ("outer", "heal"):
            for j in (21, 25):
                # One shield, or no prior same-name counter when this creation fails.
                read(
                    j,
                    {"GetVariable": int(veto != "counter")},
                    0 if veto == "counter" else 36,
                    True,
                )
                seen.append(j)
        assert len(seen) == (0 if veto in ("outer", "heal") else 2)
    # A4 stores the number launched before its shot-count wait. The following
    # entry tests the recorded value, not the current live summon count.
    sequence = steps("Demonolog/Ability4.TALENT", "DemonsLaunch")
    assert [n for n, _ in sequence][1:5] == [
        "DemonsLaunch",
        "SpellApplicator",
        "FlagsApplicator",
        "SummonApplicator",
    ]
    for blocked in (False, True):
        state = {"vDemonsIsAlive": 2, "vDemonsLaunch": 0, "vDemonsShots": 1}
        if not blocked:
            write(28, sequence[1][1][0], state)
        state["vDemonsIsAlive"] = 1
        enabled = sequence[3][1][0].findtext("enabled/sString")
        assert evaluate(cases[27], state, expr=enabled) == (not blocked)
        for j in (28, 29):
            read(j, state, 100)
    # The panther program reevaluates the rejected entry's stop condition
    # before attempting the following transformation step.
    panther = steps("Night/Ability4_2.TALENT", "PantherTime")
    item = panther[8][1]
    assert panther[8][0] == "PantherTime"
    parent = next(
        e
        for e in resource("Night/Ability4_2.TALENT").iter("Item")
        if e.find("applicator") is not None
        and e.find("applicator").get("id") == item.get("id")
    )
    for stopped in (False, True):
        assert (
            bool(
                evaluate(
                    cases[64],
                    {"vVampResStarted": int(stopped), "vDragonResStarted": 0},
                    expr=parent.findtext("stopCondition/sString"),
                )
            )
            == stopped
        )
        read(65, {"applPantherTime": 0}, 0)
    # Anchor the timer/add-layer program and the separate reward spell.
    monster = steps("Monster/Ability_A4.TALENT", "Monster_A4CurrentToxinStack")
    assert monster[0][0] == "status_A4_StackCountCooldown.APLR"
    for blocked in ("outer", "timer", "add", None):
        state = {"vMonster_A4CurrentToxinStack": 0, "vTotal_CooldownReduction": 20}
        if blocked not in ("outer", "timer"):
            read(61, state, 24, True)
        if blocked not in ("outer", "add"):
            write(61, monster[1][1][0], state)
        assert (state["vMonster_A4CurrentToxinStack"] > 0) == (
            blocked not in ("outer", "add")
        )
    vampire = steps("Vampire/Ability_A2.TALENT", "A2_Target")
    assert vampire[0][0] == "A2_ResetHeroCounter.APLR"
    gate = dict(vampire)["A2_Target"][0].findtext("enabled/sString")
    for blocked in (True, False):
        state = {"vA2_HeroCounter": 7}
        if not blocked:
            write(72, resource("Vampire/A2_ResetHeroCounter.APLR"), state)
        # Reached the target step, without an intervening successful hit.
        assert bool(evaluate(cases[71], state, expr=gate)) == blocked
        read(72, state, 4 if blocked else 12)
    # Control rows: a rejected parent never rewinds a successful write from
    # another spell or a pre-existing modifier. Compare absent and present
    # inputs at the real consumer, without making it a child of that program.
    for j, key, old, new, before, after, runtime, extra, learn in [
        *(
            (i, "applArtist_A4_status", 0, 1, 0, 11, False, {}, ("Artist_A4",))
            for i in (13, 14)
        ),
        (22, "vBardStacks_A4Start", 1, 5, 1.05, 5.25, True, {}, ()),
        (
            26,
            "vBladeDancer_Mastery",
            0,
            1,
            57,
            59.85,
            True,
            {},
            ("BladeDancer_A0_SUP",),
        ),
        *(
            (i, "vHealer_A5_SpellShieldCounter", 1, 0, 1, 0, True, {}, ())
            for i in (50, 51)
        ),
        (54, "vInventor_Details", 0, 100, 4, 0, True, {"CountApplicators": 1}, ()),
        *(
            (i, "vMage_A0_DamageCounter", 0, 3, x, y, True, {}, ())
            for i, x, y in (
                (55, 0.6, 0.3),
                (56, 1, 0.4),
                (57, 0.6, 0.3),
                (58, 0.6, 0.3),
            )
        ),
        *(
            (i, "vTotal_CooldownReduction", 0, 20, 30, 24, True, {}, ())
            for i in (62, 63)
        ),
        (67, "FindApplicator", 0, 1, 23, 0, False, {}, ()),
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
            (i, "vHatred", 2, 0, n, 0, True, {}, ())
            for i, n in ((69, 20), (70, 3.2), (71, 3.2))
        ),
    ]:
        read(j, {key: old, **extra}, before, runtime, learn)
        read(j, {key: new, **extra}, after, runtime, learn)
    return rows, checks
