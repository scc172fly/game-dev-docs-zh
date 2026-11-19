"""r1117 per-effect interception in configured spell lists."""

from math import isclose


def verify(cases, evaluate, xml, ordered):
    ordered(
        "PFDispatch.cpp",
        "iAppl = newApplicators.begin()",
        "CreateApplicator(cp)",
        "AddApplicator(pApplicator)",
        "void PFDispatch::_ApplyInternal()",
        "OnDispatchApply(*this)",
        "applicatorNext = applicators.next(applicator)",
        "remove(pHolder)",
        "ActivateApplicator(pHolder, pAbility);",
        "applicator = applicatorNext;",
    )
    ordered("PFDispatch.h", "applicators.addLast(app)")
    ordered(
        "PFBaseUnitAppl.cpp",
        "EventHappened(evtApplicator)",
        "if ( evtApplicator.IsApplicatorCancelled() )",
        "return false;",
        "pApplicator->Start()",
    )
    ordered(
        "PFTriggerApplicator.cpp",
        "PFEventProcessorApplicatorApplied::ProcessEvent",
        "db.applicatorTypesList",
        "db.applicatorsList",
        "APPLICATORAPPLIEDMODE_CANCEL",
        "CancelApplicator();",
        "DoSpell( pEventSender )",
    )
    rows = set()
    checks = 0

    def read(j, state, want, runtime=False, learned=()):
        nonlocal checks
        got = evaluate(cases[j - 1], state, runtime, learned=learned)
        assert isclose(got, want, abs_tol=1e-6), (j, state, got, want)
        checks += 1
        rows.add(j)

    def root(path):
        return xml("Items/Talents/Class/" + path + ".xdb")

    def label(item):
        if not len(item):
            return item.get("href", "").split("/")[-1]
        n = item[0]
        return n.findtext("modifier/variable") or n.findtext("damageType") or n.tag

    def groups(path):
        r = root(path)
        return [
            [label(i) for i in spell.findall("applicators/Item")]
            for spell in [r, *r.iter("Spell")]
        ]

    def run(group, blocked, start):
        for i, name in enumerate(group):
            if i != blocked:
                start(name)

    def matching(path, name):
        return next(g for g in groups(path) if name in g)

    demon = root("Demonolog/Ability0.TALENT")
    callback = next(
        n
        for n in demon.iter("EventProcessorCondition")
        if n.findtext("events") == "1048576"
    )
    effects = [label(i) for i in callback.findall("spell/Spell/applicators/Item")]
    assert effects == ["DemonologDead", "SummonDemons.APLR", "SaveDemons"]
    summon = root("Demonolog/SummonDemons.APLR")
    for old in (0, 1):
        for blocked in (-1, 0, 1, 2):
            state = {
                "vDemonsIsAlive": old,
                "vSaveDemons": 2,
                "vDemonologDead": 1,
                "vIsClone": 0,
            }

            def apply(name):
                if name == effects[1]:
                    assert evaluate(
                        cases[27], state, expr=summon.findtext("enabled/sString")
                    )
                    state["vDemonsIsAlive"] += evaluate(
                        cases[27],
                        state,
                        expr=summon.findtext("summonedUnitsCount/sString"),
                    )
                else:
                    mod = next(
                        n
                        for n in callback.iter("modifier")
                        if n.findtext("variable") == name
                    )
                    state["v" + name] = state["v" + name] * evaluate(
                        cases[27], state, expr=mod.findtext("multValue/sString")
                    ) + evaluate(
                        cases[27], state, expr=mod.findtext("addValue/sString")
                    )

            run(effects, blocked, apply)
            layers = old + (0 if blocked == 1 else 2)
            assert state["vDemonsIsAlive"] == layers and state["vSaveDemons"] == (
                2 if blocked == 2 else 0
            )
            assert state["vDemonologDead"] == int(blocked == 0)
            for j in (28, 29):
                read(j, state, 100 * layers if layers else 300)
    # Only effects in the same list are siblings. A vetoed program does not
    # run its children; its sibling's successful start cannot launch them.
    for path, member, indices, key, old, new, a, b, runtime, learn in [
        (
            "Artist/Ability_A4.TALENT",
            "status_A4_artist.APLR",
            (13, 14),
            "applArtist_A4_status",
            0,
            1,
            0,
            11,
            False,
            ("Artist_A4",),
        ),
        (
            "BladeDancer/Ability_A1.TALENT",
            "status_A0_AddMastery.APLR",
            (26,),
            "vBladeDancer_Mastery",
            0,
            1,
            57,
            59.85,
            True,
            ("BladeDancer_A0_SUP",),
        ),
        (
            "Rifleman/Ability_A2.TALENT",
            "Status_A0.APLR",
            (67,),
            "FindApplicator",
            0,
            1,
            23,
            0,
            False,
            (),
        ),
        (
            "Shadow/Ability_A3.TALENT",
            "A0Shadow_BlockCounter",
            (68,),
            "vA0Shadow_BlockCounter",
            5,
            6,
            0.65,
            0.64,
            True,
            (),
        ),
        (
            "Shadow/Ability_A0.TALENT",
            "Hatred_DamageDealt",
            (69, 70, 71),
            "vHatred",
            2,
            0,
            0,
            0,
            True,
            (),
        ),
        (
            "Vampire/Ability_A2.TALENT",
            "A2_HeroCounter",
            (72,),
            "vA2_HeroCounter",
            6,
            7,
            12,
            4,
            False,
            (),
        ),
    ]:
        group = matching(path, member)
        target = group.index("Hatred" if indices == (69, 70, 71) else member)
        assert len(group) > 1
        for blocked in (target, (target + 1) % len(group)):
            started = []
            run(group, blocked, started.append)
            state = {
                key: new if group[target] in started else old,
                "GetVariable": 10000,
            }
            for j in indices:
                before, after = (
                    (20 if j == 69 else 3.2, 0) if j in (69, 70, 71) else (a, b)
                )
                read(j, state, before if blocked == target else after, runtime, learn)

    # Direct effect versus enclosing program and independent sibling.
    for path, member, indices, key, value, want in [
        ("Bard/Ability_A3.TALENT", "ProgramApplicator", (21, 25), "GetVariable", 1, 36),
        (
            "Bard/A4_SummonViolin.APLR",
            "Material",
            (22,),
            "vBardStacks_A4Start",
            5,
            5.25,
        ),
        (
            "Monster/Ability_A4.TALENT",
            "status_A4u_Debuff.APLR",
            (62, 63),
            "vTotal_CooldownReduction",
            20,
            24,
        ),
    ]:
        group = matching(path, member)
        assert len(group) > 1
        for blocked in (group.index(member), (group.index(member) + 1) % len(group)):
            started = []
            run(group, blocked, started.append)
            if member in started:
                for j in indices:
                    read(j, {key: value}, want, True)
            assert (member in started) == (group[blocked] != member)

    bubble = root("Healer/status_A5_SUP_Bubble.APLR")
    intercept = next(bubble.iter("EventProcessorApplicatorApplied"))
    assert intercept.findtext("mode") == "Cancel" and intercept.find(
        "applicatorsList"
    ).get("href").endswith("List_AllControlAppl.APLS")
    follow = [label(i) for i in intercept.findall("spell/Spell/applicators/Item")]
    assert follow == ["Healer_A5_SpellShieldCounter", "FlagsApplicator"]
    for blocked in (0, 1):
        started = []
        run(follow, blocked, started.append)
        for j in (50, 51):
            read(
                j,
                {"vHealer_A5_SpellShieldCounter": int(blocked == 0)},
                int(follow[0] not in started),
                True,
            )
    # These rows' particular writer or enclosing program is a singleton
    # dispatch. Check cancellation at this boundary, without inventing siblings.
    for path, member, j, key, old, new, before, after, runtime, extra in [
        (
            "Frogenglut/Ability4.TALENT",
            "SpellApplicator",
            48,
            "vA4_FrogJump",
            0,
            1,
            200,
            100,
            False,
            {},
        ),
        (
            "Gunslinger/Ability_A0.TALENT",
            "Hero_Rage",
            49,
            "vHero_Rage",
            20,
            0,
            1.6,
            0.8,
            False,
            {},
        ),
        (
            "Inventor/Ability_A0.TALENT",
            "Inventor_Details",
            54,
            "vInventor_Details",
            0,
            100,
            4,
            0,
            True,
            {"CountApplicators": 1},
        ),
        (
            "Night/Ability4_2.TALENT",
            "ProgramApplicator",
            65,
            "applPantherTime",
            0,
            1,
            0,
            10 / 3,
            False,
            {},
        ),
    ]:
        if j in (49, 54):
            proc = next(
                n
                for n in root(path).iter("EventProcessorCondition")
                if n.findtext("events") == "1048576"
            )
            group = [label(i) for i in proc.findall("spell/Spell/applicators/Item")]
        else:
            group = groups(path)[0]
        assert group == [member]
        for blocked in (0, -1):
            started = []
            run(group, blocked, started.append)
            read(
                j,
                {key: new if started else old, **extra},
                after if started else before,
                runtime,
            )
    # When a child stat modifier is intercepted, its parent status may start
    # without contributing the counter. Compare three layers with zero layers.
    mage = root("Mage/status_A0_ChannelingTime.APLR")
    assert [label(i) for i in mage.findall("applicators/Item")] == [
        "Mage_A0_DamageCounter"
    ]
    for layers in (0, 3):
        for j, base, fast in (
            (55, 0.6, 0.3),
            (56, 1, 0.4),
            (57, 0.6, 0.3),
            (58, 0.6, 0.3),
        ):
            read(j, {"vMage_A0_DamageCounter": layers}, fast if layers else base, True)
    monster = root("Monster/Ability_A4.TALENT")
    ordered(
        "PFApplSpecial.cpp",
        "bool PFApplProgram::ExecuteNext()",
        "if ( shouldStopByCondition )",
        "applicatorExecuting++;",
        "if ( !ActivateApplicator( pAppl, pAbility ) )",
        "ready2Execute = true;",
        "} while ( ready2Execute",
    )
    timer_path = "status_A4_StackCountCooldown.APLR"
    program = next(
        n
        for n in monster.iter("ProgramApplicator")
        if n.find("applicators/Item/applicator").get("href", "").endswith(timer_path)
    )
    steps = program.findall("applicators/Item")
    assert len(steps) == 2 and steps[0].findtext("stopCondition/sString") in (
        "0",
        "false",
    )
    modifier = steps[1].find("applicator/PermanentStatModApplicator")
    assert modifier.findtext("modifier/variable") == "Monster_A4CurrentToxinStack"
    for blocked in (0, 1):
        started = []
        run(["timer", "stack"], blocked, started.append)
        if "timer" in started:
            read(61, {"vTotal_CooldownReduction": 20}, 24, True)
        else:
            state = {"vMonster_A4CurrentToxinStack": 0}
            assert evaluate(cases[60], state, expr=modifier.findtext("enabled/sString"))
            assert (
                evaluate(
                    cases[60],
                    state,
                    expr=modifier.findtext("modifier/addValue/sString"),
                )
                > 0
            )
    return rows, checks
