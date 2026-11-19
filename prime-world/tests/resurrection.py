"""r1117 resurrection events and replacement summon reads."""

from math import isclose


def verify(cases, evaluate, xml, cat, ordered):
    ordered(
        "PFHero.cpp",
        "bool PFBaseHero::Step(",
        "if( IsDead() )",
        "AdvanceResurrect();",
        "DoResurrect();",
        "return PFCreature::Step(dtInSeconds)",
    )
    ordered(
        "PFHero.cpp",
        "void PFBaseHero::DoResurrect()",
        "health =",
        "energy =",
        "activatedWhileLastDeathtime.begin()",
        "ApplyPassivePart( true )",
        "OnRessurect();",
    )
    ordered(
        "PFCreature.cpp",
        "PFBaseMovingUnit::Step(dtInSeconds)",
        "void PFCreature::OnRessurect()",
        "EventHappened( evtResurrect )",
        "DropAbilitiesProgress();",
    )
    ordered(
        "PFBaseMovingUnit.cpp",
        "if (world.moveState != MOVE_STATE_DEAD)",
        "world.Step(dtInSeconds);",
        "PFBaseUnit::Step(dtInSeconds)",
    )
    ordered(
        "PFBaseUnit.cpp",
        "FsmStep(dtInSeconds);",
        "StepWarFog(dtInSeconds);",
        "}",
        "StepApplicators(dtInSeconds);",
    )
    ordered(
        "PFUnitAbilities.cpp",
        "void PFUnitAbilities::DropAbilitiesProgress()",
        "it->isInProgress = false;",
    )
    ordered("PFCreature.h", "PFBaseUnitEvent(NDb::BASEUNITEVENT_RESURRECT)")
    ordered("DBAbility.h", "BASEUNITEVENT_RESURRECT = 20")
    ordered(
        "PFApplSummon.cpp",
        "pOwner->RemoveSummons(",
        "new PFBaseSummonedUnit(",
        "CreateAndActivateApplicators(db.applicators",
    )
    checked = set()
    checks = 0

    def resource(path):
        return xml("Items/Talents/Class/" + path)

    def read(j, state, expected, runtime=False, **kw):
        nonlocal checks
        got = evaluate(cases[j - 1], state, runtime, **kw)
        assert isclose(got, expected, abs_tol=1e-6), (j, state, got, expected)
        checked.add(j)
        checks += 1

    def listener(path):
        return next(
            n
            for n in resource(path).iter("EventProcessorCondition")
            if int(n.findtext("events", "0")) & (1 << 20)
        )

    def write(j, node, name, state):
        mod = next(n for n in node.iter("modifier") if n.findtext("variable") == name)

        def param(field):
            return evaluate(cases[j - 1], state, expr=mod.findtext(field + "/sString"))

        key = "v" + name
        state[key] = state.get(key, 0) * param("multValue") + param("addValue")

    # Apply the configured writes, then reevaluate the affected page rows.
    for hero, name, start, items in [
        ("Shadow", "Hatred", 2, [(69, 20, 0), (70, 3.2, 0), (71, 3.2, 0)]),
        ("Gunslinger", "Hero_Rage", 20, [(49, 1.6, 0.8)]),
        ("Inventor", "Inventor_Details", 0, [(54, 4, 0)]),
    ]:
        state = {"v" + name: start, "CountApplicators": 1}
        for j, old, new in items:
            read(j, state, old, j != 49)
        write(items[0][0], listener(hero + "/Ability_A0.TALENT.xdb"), name, state)
        for j, old, new in items:
            read(j, state, new, j != 49)
    for j, hero, name in (
        (13, "Artist", "Artist_Mastery"),
        (69, "Shadow", "Hatred_DamageDealt"),
    ):
        state = {"v" + name: 17}
        write(j, listener(hero + "/Ability_A0.TALENT.xdb"), name, state)
        assert state["v" + name] == 0
    # Independent violin instances take their own snapshot from the owner.
    snapshot = resource("Bard/A4_SummonViolin.APLR.xdb").findtext(
        ".//PermanentStatModApplicator/modifier/addValue/sString"
    )
    violins = [
        evaluate(cases[21], {"vBardCurrentStacks": n}, expr=snapshot) for n in (5, 1)
    ]
    for layers, damage in zip(violins, (5.25, 1.05)):
        read(22, {"vBardStacks_A4Start": layers}, damage, True)

    summon = resource("Demonolog/SummonDemons.APLR.xdb")
    callback = listener("Demonolog/Ability0.TALENT.xdb")
    sequence = [
        item.get("href", "").rsplit("/", 1)[-1]
        if not item.get("id")
        else item.findtext(".//modifier/variable")
        for item in callback.findall(".//Spell/applicators/Item")
    ]
    assert sequence == ["DemonologDead", "SummonDemons.APLR", "SaveDemons"]
    gate = summon.findtext("enabled/sString")
    amount = summon.findtext("summonedUnitsCount/sString")
    increment = next(
        n.findtext("addValue/sString")
        for n in summon.iter("modifier")
        if n.findtext("variable") == "DemonsIsAlive"
    )
    death = next(
        resource("Demonolog/Ability0.TALENT.xdb").iter("EventProcessorOnDeath")
    )
    for special, saved in ((0, 2), (1, 0)):
        state = {"vDemonsA4Start": special, "vDemonsIsAlive": 2}
        write(28, death, "SaveDemons", state)
        assert state["vSaveDemons"] == saved
    for old, saved, expected, cleaned in [
        (1, 1, 200, 100),
        (0, 0, 100, 100),
        (2, 2, 400, 200),
        (0, 2, 200, 200),
        (3, 1, 300, 300),
    ]:
        state = {"vDemonsIsAlive": old, "vSaveDemons": saved, "vIsClone": 0}
        started = evaluate(cases[27], state, expr=gate)
        assert bool(started) == (old < 3)
        if started:
            state["vDemonsIsAlive"] += evaluate(
                cases[27], state, expr=amount
            ) * evaluate(cases[27], state, expr=increment)
        assert state["vDemonsIsAlive"] == old + (max(saved, 1) if started else 0)
        write(28, callback, "SaveDemons", state)
        assert state["vSaveDemons"] == 0
        for j in (28, 29):
            read(j, state, expected)
        state["vDemonsIsAlive"] -= old
        for j in (28, 29):
            read(j, state, cleaned)

    # Read the existing timer at resurrection, before this step advances it.
    for remaining, elapsed in ((4, 3), (3, 3)):
        live = int(remaining > elapsed)
        read(65, {"applPantherTime": live}, 10 / 3 if live else 0)
        read(67, {"FindApplicator": live}, 0 if live else 23)
        gate = next(
            n.text
            for n in xml(cat[479]).iter("sString")
            if n.text and "sender.applMonster_A4uDebuff(UNIT) == pMisc" in n.text
        )
        for j in (62, 63):
            read(
                j,
                {"applMonster_A4uDebuff": live, "vMonster_A4CurrentToxinStack": 0},
                1 - live,
                expr=gate,
                context=cat[479],
            )
    progress = resource("Monster/status_A4_StackCount.APLR.xdb").findtext(
        "customProgress/sString"
    )
    for remaining in (18, 15):
        state = {
            "objects": {
                "sender": {"vTotal_CooldownReduction": 20},
                "sender.applMonster_A4StackCooldownSpell(UNIT)": {
                    ("GetVariable", ("'duration'",)): remaining
                },
            }
        }
        read(61, state, remaining / 24, expr=progress)
    # Post-cleanup inputs, with independent skill reapplication or explicit reset.
    for j, var, v1, v2, a, b, runtime, learn, fixed in [
        *(
            (i, "applArtist_A4_status", 0, 1, 0, 11, False, ("Artist_A4",), {})
            for i in (13, 14)
        ),
        *((i, "GetVariable", 0, 1, 0, 36, True, (), {}) for i in (21, 25)),
        (
            26,
            "vBladeDancer_Mastery",
            0,
            1,
            57,
            59.85,
            True,
            ("BladeDancer_A0_SUP",),
            {},
        ),
        (48, "vA4_FrogJump", 1, 0, 100, 200, False, (), {}),
        *(
            (i, "vHealer_A5_SpellShieldCounter", 1, 0, 1, 0, True, (), {})
            for i in (50, 51)
        ),
        *(
            (i, "vMage_A0_DamageCounter", 0, 3, x, y, True, (), {})
            for i, x, y in (
                (55, 0.6, 0.3),
                (56, 1, 0.4),
                (57, 0.6, 0.3),
                (58, 0.6, 0.3),
            )
        ),
        (
            68,
            "vA0Shadow_BlockCounter",
            5,
            6,
            0.65,
            0.64,
            True,
            (),
            {"GetVariable": 10000},
        ),
        (72, "vA2_HeroCounter", 7, 0, 4, 12, False, (), {}),
    ]:
        read(j, {var: v1, **fixed}, a, runtime, learned=learn)
        read(j, {var: v2, **fixed}, b, runtime, learned=learn)
    return checked, checks
