"""Queued resurrection spells: acceptance, target validation and effect start."""

from math import isclose


class Delivery:
    def __init__(self, flags, apply):
        self.flags = flags
        self.apply = apply
        self.done = False
        self.starts = 0

    def attempt(self, *, accept=True, alive=True, veto=False):
        if self.done or not accept:
            return
        self.done = True
        if (alive or self.flags & 4) and not veto:
            self.starts += 1
            self.apply()


def verify(cases, evaluate, xml, ordered):
    ordered("DBAbility.h", "ABILITYFLAGS_APPLYTODEAD = 4")
    ordered("PFApplMove.cpp", "EnableDispatch( false )", "EnableDispatch(true)")
    ordered("PFDispatch.h", "void  Cancel()", "Die();")
    ordered(
        "PFDispatch.cpp",
        "PFDispatch::OnDie()",
        "Clear(applicators)",
        "void PFDispatch::_ApplyInternal()",
        "!target.GetUnit()->CanApplyDispatch()",
        "!GetDBBase()->alwaysApply",
        "STATE_WAIT_TO_APPLY",
        "IsTargetValid(target)",
        "OnDispatchApply(*this)",
        "ActivateApplicator(pHolder, pAbility);",
        "applicator = applicatorNext;",
        "state = STATE_APPLIED;",
        "bool PFDispatch::Step(",
        "if (state == STATE_WAIT_TO_APPLY)",
        "_ApplyInternal();",
        "dieAfterApply",
        "Die();",
    )
    ordered("PFBaseUnit.cpp", "evtDispatch.IsDispatchCancelled()", "return false;")
    ordered(
        "PFBaseUnitAppl.cpp",
        "evtApplicator.IsApplicatorCancelled()",
        "return false;",
        "pApplicator->Start()",
    )
    ordered(
        "PFApplSummon.cpp",
        "if ( PFBaseApplicator::Start() )",
        "RetrieveParam( db.summonedUnitsCount",
        "summonType == NDb::SUMMONTYPE_PRIMARY && pOwner->IsDead()",
        "return true;",
        "new PFBaseSummonedUnit(",
    )
    rows = set()
    checks = 0

    def read(j, state, want, runtime=False, learned=()):
        nonlocal checks
        value = evaluate(cases[j - 1], state, runtime, learned=learned)
        assert isclose(value, want, abs_tol=1e-6), (j, state, value, want)
        rows.add(j)
        checks += 1
        return value

    def resource(path):
        return xml("Items/Talents/Class/" + path)

    def callback(hero):
        f = "Ability0" if hero == "Demonolog" else "Ability_A0"
        root = resource(f"{hero}/{f}.TALENT.xdb")
        proc = next(
            n
            for n in root.iter("EventProcessorCondition")
            if int(n.findtext("events", "0")) & (1 << 20)
        )
        db = proc.find("spell/Spell/dispatch/DispatchImmediate")
        assert (
            db.findtext("alwaysApply") == "false"
            and db.findtext("dieAfterApply") == "true"
        )
        return int(root.findtext("flags")), proc

    def write(j, proc, state, name):
        mod = next(n for n in proc.iter("modifier") if n.findtext("variable") == name)

        def param(tag):
            return evaluate(cases[j - 1], state, expr=mod.findtext(tag + "/sString"))

        key = "v" + name
        state[key] = state.get(key, 0) * param("multValue") + param("addValue")

    for hero, name, old, new, items, dead_ok in [
        ("Artist", "Artist_Mastery", 5, 0, [(13, 0, 0), (14, 0, 0)], False),
        ("Gunslinger", "Hero_Rage", 20, 0, [(49, 1.6, 0.8)], False),
        ("Inventor", "Inventor_Details", 0, 100, [(54, 4, 0)], True),
        ("Shadow", "Hatred", 2, 0, [(69, 20, 0), (70, 3.2, 0), (71, 3.2, 0)], True),
    ]:
        flags, proc = callback(hero)
        assert bool(flags & 4) == dead_ok
        for alive, veto, success in [
            (True, False, True),
            (False, False, dead_ok),
            (True, True, False),
        ]:
            state = {"v" + name: old, "CountApplicators": 1}
            delivery = Delivery(flags, lambda: write(items[0][0], proc, state, name))
            delivery.attempt(accept=False, alive=False)
            assert not delivery.done and state["v" + name] == old
            delivery.attempt(alive=alive, veto=veto)
            delivery.attempt()  # a terminal veto or invalid target is never retried
            assert delivery.starts == int(success) and state["v" + name] == (
                new if success else old
            )
            for j, a, b in items:
                read(
                    j, state, b if success else a, j in (54, 69, 70, 71), ("Artist_A4",)
                )

    flags, proc = callback("Demonolog")
    summon = resource("Demonolog/SummonDemons.APLR.xdb")
    behaviour = summon.find("behaviour/SummonBehaviourCommon")
    assert (
        behaviour.find("summonType") is None
        and xml(behaviour.get("parent").strip("/") + ".xdb").findtext("summonType")
        == "Primary"
    )
    for cleaned, alive, veto, block_summon, expected, saved in [
        (False, True, False, False, 4, 0),
        (True, True, False, False, 2, 0),
        (True, False, False, False, 0, 0),
        (True, True, True, False, 0, 2),
        (True, True, False, True, 0, 0),
    ]:
        state = {"vDemonsIsAlive": 2, "vSaveDemons": 2, "vIsClone": 0}

        def apply():
            if (
                not block_summon
                and alive
                and evaluate(cases[27], state, expr=summon.findtext("enabled/sString"))
            ):
                state["vDemonsIsAlive"] += evaluate(
                    cases[27], state, expr=summon.findtext("summonedUnitsCount/sString")
                )
            write(28, proc, state, "SaveDemons")

        delivery = Delivery(flags, apply)
        delivery.attempt(accept=False)
        if cleaned:
            state["vDemonsIsAlive"] = 0
        for j in (28, 29):
            read(j, state, 300 if cleaned else 200)
        delivery.attempt(alive=alive, veto=veto)
        assert state["vDemonsIsAlive"] == expected and state["vSaveDemons"] == saved
        for j in (28, 29):
            read(j, state, {0: 300, 2: 200, 4: 400}[expected])

    # A second death may write SaveDemons again while the old dispatch is
    # waiting. Run that configured write, then reopen reception on a living owner.
    death = next(
        resource("Demonolog/Ability0.TALENT.xdb").iter("EventProcessorOnDeath")
    )
    for special, expected in ((0, 2), (1, 1)):
        state = {
            "vSaveDemons": 3,
            "vDemonsIsAlive": 2,
            "vDemonsA4Start": special,
            "vIsClone": 0,
        }

        def apply_saved():
            assert evaluate(cases[27], state, expr=summon.findtext("enabled/sString"))
            state["vDemonsIsAlive"] += evaluate(
                cases[27], state, expr=summon.findtext("summonedUnitsCount/sString")
            )
            write(28, proc, state, "SaveDemons")

        pending = Delivery(flags, apply_saved)
        pending.attempt(accept=False, alive=False)
        write(28, death, state, "SaveDemons")
        state["vDemonsIsAlive"] = 0
        pending.attempt(alive=True)
        assert state["vSaveDemons"] == 0 and state["vDemonsIsAlive"] == expected
        for j in (28, 29):
            read(j, state, 100 * expected)

    # Query-only fields retain the earlier cast's result. Event/start consumers
    # run only on acceptance. Saved quantities use their original snapshot.
    for j, key, old, new, before, after, runtime, extra, learn in [
        *((i, "GetVariable", 2, 1, 72, 36, True, {}, ()) for i in (21, 25)),
        (22, "vBardStacks_A4Start", 5, 5, 5.25, 5.25, True, {}, ()),
        (26, "vBladeDancer_Mastery", 2, 0, 62.7, 57, True, {}, ("BladeDancer_A0_SUP",)),
        (48, "vA4_FrogJump", 1, 0, 100, 200, False, {}, ()),
        *(
            (i, "vHealer_A5_SpellShieldCounter", 1, 0, 1, 0, True, {}, ())
            for i in (50, 51)
        ),
        *(
            (i, "vMage_A0_DamageCounter", 3, 0, b, a, True, {}, ())
            for i, b, a in (
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
        (72, "vA2_HeroCounter", 7, 0, 4, 12, False, {}, ()),
    ]:
        state = {key: old, **extra}
        original = read(j, state, before, runtime, learn)
        for veto in (False, True):
            state[key] = old
            results = []

            def settle():
                results.append(
                    read(j, state, after, runtime, learn) if runtime else original
                )

            delivery = Delivery(0, settle)
            delivery.attempt(accept=False)
            state[key] = new
            assert not results
            delivery.attempt(veto=veto)
            delivery.attempt()
            assert len(results) == int(not veto)
            if results:
                assert isclose(results[0], after if runtime else before)
        if not runtime:
            read(j, state, after)
    return rows, checks
