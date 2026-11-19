"""Reads around resurrection notification, receiver tick and dispatch application."""

from math import isclose


def verify(cases, evaluate, xml, cat, ordered):
    ordered(
        "PFTriggerApplicator.cpp",
        "void PFEventProcessorBase::DoSpell(",
        "SendSpellToSingleTarget(",
        "PFEventProcessorCondition::ProcessEvent",
        "DoSpell();",
    )
    ordered(
        "PFApplUtils.cpp",
        "int SendSpellToSingleTarget(",
        "if (!justCount)",
        "CreateDispatch(",
    )
    ordered(
        "PFDispatchFactory.cpp", "pD->AddApplicators(", "if( start )", "pD->Start();"
    )
    ordered("PFDispatch.h", "PFWorldObjectBase(cp.pWorld, 1, true)")
    ordered(
        "PFDispatchStrike1.cpp",
        "PFDispatchImmediate::OnStart()",
        "if ( GetDB().instantApply )",
        "Step(0.0f)",
        "PFDispatchImmediate::Step(",
        "Base::Step(dtInSeconds)",
        "if (state == STATE_PROCEED)",
        "Apply();",
    )
    ordered(
        "PFDispatch.cpp",
        "void PFDispatch::_ApplyInternal()",
        "STATE_WAIT_TO_APPLY",
        "OnDispatchApply(*this)",
        "ActivateApplicator(pHolder, pAbility)",
    )
    ordered(
        "PFApplMod.cpp",
        "bool PFApplPermanentStatMod::Start()",
        "RetrieveParam(GetDB().modifier.multValue)",
        "SetBaseValue(mul * pStat->GetBaseValue() + add)",
    )
    ordered(
        "../PF_Core/World.cpp",
        "objectsForStep.addLast(pObject)",
        "if (immediately)",
        "SubscribeObject(pObject)",
        "while (pCurrentObjectIsBeingStepped != objectsForStep.last())",
        "->Step(dtInSeconds)",
        "WorldObjectBase::Ring::next",
    )
    rows = set()
    checks = 0

    def read(j, state, expected, runtime=False, **kw):
        nonlocal checks
        got = evaluate(cases[j - 1], state, runtime, **kw)
        assert isclose(got, expected, abs_tol=1e-6), (j, state, expected, got)
        rows.add(j)
        checks += 1

    def resource(path):
        return xml("Items/Talents/Class/" + path)

    # Two default listeners. The reader can settle synchronously or use a
    # dispatch appended to the same world ring. No target veto in these cases.
    for hero, name, old, after, items in [
        ("Gunslinger", "Hero_Rage", 20, 0, [(49, 1.6, 0.8)]),
        ("Shadow", "Hatred", 2, 0, [(69, 20, 0), (70, 3.2, 0), (71, 3.2, 0)]),
        ("Inventor", "Inventor_Details", 0, 100, [(54, 4, 0)]),
        ("Artist", "Artist_Mastery", 5, 0, [(13, 0, 0), (14, 0, 0)]),
        ("Demonolog", "DemonsIsAlive", 1, 2, [(28, 100, 200), (29, 100, 200)]),
    ]:
        file = "Ability0" if hero == "Demonolog" else "Ability_A0"
        root = resource(f"{hero}/{file}.TALENT.xdb")
        proc = next(
            n
            for n in root.iter("EventProcessorCondition")
            if int(n.findtext("events", "0")) & (1 << 20)
        )
        instant = (
            proc.findtext("spell/Spell/dispatch/DispatchImmediate/instantApply")
            == "true"
        )
        assert instant == (hero == "Artist")
        for reader_first in (False, True):
            for delayed_reader in (False, True):
                queue = []
                state = {
                    "v" + name: old,
                    "CountApplicators": 1,
                    "vSaveDemons": 1,
                    "vIsClone": 0,
                }

                def write():
                    if hero == "Demonolog":
                        summon = resource("Demonolog/SummonDemons.APLR.xdb")
                        assert evaluate(
                            cases[27], state, expr=summon.findtext("enabled/sString")
                        )
                        state["vDemonsIsAlive"] += evaluate(
                            cases[27],
                            state,
                            expr=summon.findtext("summonedUnitsCount/sString"),
                        )
                        state["vSaveDemons"] = 0
                    else:
                        m = next(
                            n
                            for n in proc.iter("modifier")
                            if n.findtext("variable") == name
                        )

                        def param(field):
                            return evaluate(
                                cases[items[0][0] - 1],
                                state,
                                expr=m.findtext(field + "/sString"),
                            )

                        state["v" + name] = old * param("multValue") + param("addValue")

                def observe():
                    new = (not reader_first or (delayed_reader and instant)) and (
                        delayed_reader or instant
                    )
                    assert state["v" + name] == (after if new else old)
                    for j, a, b in items:
                        read(
                            j,
                            state,
                            b if new else a,
                            j in (54, 69, 70, 71),
                            learned=("Artist_A4",),
                        )

                actions = [(instant, write), (not delayed_reader, observe)]
                for immediate, action in reversed(actions) if reader_first else actions:
                    if immediate:
                        action()
                    else:
                        queue.append(action)
                for action in queue:
                    action()
                assert state["v" + name] == after

    # Exactly one step remains. A remote mark follows its receiver's tick.
    gate = next(
        n.text
        for n in xml(cat[479]).iter("sString")
        if n.text and "sender.applMonster_A4uDebuff(UNIT) == pMisc" in n.text
    )
    for receiver_first in (False, True):
        remaining = 0.125
        for phase in (
            "earlier_unit",
            "resurrection",
            "hero_tick",
            "later_unit",
            "queued_spell",
        ):
            if phase == ("earlier_unit" if receiver_first else "later_unit"):
                remaining = 0
            if phase in ("resurrection", "queued_spell"):
                read(
                    67,
                    {"FindApplicator": int(remaining > 0)},
                    0 if phase == "resurrection" and not receiver_first else 23,
                )
    progress = resource("Monster/status_A4_StackCount.APLR.xdb").findtext(
        "customProgress/sString"
    )
    for live in (True, False):
        read(65, {"applPantherTime": int(live)}, 10 / 3 if live else 0)
        for j in (62, 63):
            read(
                j,
                {"applMonster_A4uDebuff": int(live), "vMonster_A4CurrentToxinStack": 0},
                int(not live),
                expr=gate,
                context=cat[479],
            )
    read(
        61,
        {
            "objects": {
                "sender": {"vTotal_CooldownReduction": 20},
                "sender.applMonster_A4StackCooldownSpell(UNIT)": {
                    ("GetVariable", ("'duration'",)): 0.125
                },
            }
        },
        0.125 / 24,
        expr=progress,
    )
    read(61, {"vTotal_CooldownReduction": 20}, 24, True)
    # Reads at notification and after the owner's tick with no independent new
    # hit, intercept, explicit skill write or enumerated shield recipient.
    for j, key, value, want, runtime, extra, learn in [
        *((i, "GetVariable", 0, 0, True, {}, ()) for i in (21, 25)),
        (22, "vBardStacks_A4Start", 5, 5.25, True, {}, ()),
        (26, "vBladeDancer_Mastery", 0, 57, True, {}, ("BladeDancer_A0_SUP",)),
        (48, "vA4_FrogJump", 1, 100, False, {}, ()),
        *((i, "vHealer_A5_SpellShieldCounter", 1, 1, True, {}, ()) for i in (50, 51)),
        *(
            (i, "vMage_A0_DamageCounter", 0, t, True, {}, ())
            for i, t in ((55, 0.6), (56, 1), (57, 0.6), (58, 0.6))
        ),
        (68, "vA0Shadow_BlockCounter", 5, 0.65, True, {"GetVariable": 10000}, ()),
        (72, "vA2_HeroCounter", 7, 4, False, {}, ()),
    ]:
        for phase in ("notification", "after_tick"):
            read(j, {key: value, **extra}, want, runtime, learned=learn)
    return rows, checks
