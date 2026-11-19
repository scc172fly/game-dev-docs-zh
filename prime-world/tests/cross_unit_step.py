"""Cross-unit reads in one r1117 world step; time below is simulation time."""

from dataclasses import dataclass
from itertools import permutations
from math import isclose

DT = 0.125


@dataclass
class TimedEffect:
    remaining: float
    live: bool = True

    def step(self):
        if self.live:
            self.remaining -= DT
            self.live = self.remaining > 0


def verify(cases, evaluate, xml, cat, ordered):
    ordered(
        "../PF_Core/World.cpp",
        "objectsForStep.addLast(pObject)",
        "if (immediately)",
        "SubscribeObject(pObject);",
        "addedObjects.addLast(pObject);",
        "pCurrentObjectIsBeingStepped = objectsForStep.first();",
        "pCurrentObjectIsBeingStepped->Step(dtInSeconds)",
        "WorldObjectBase::Ring::next",
        "ProcessAddRemove()",
        "World::ProcessAddRemove()",
        "SubscribeObject(pObject);",
    )
    ordered("PFLogicObject.cpp", "PFWorldObjectBase( _pWorld, 1 )")
    ordered(
        "PFWorldObjectBase.h",
        "bool immediately = false",
        "WorldObjectBase(pWorld, realWObj, immediately)",
    )
    ordered(
        "PFApplSummon.cpp",
        "new PFBaseSummonedUnit(",
        "Target createdUnit(",
        "CreateAndActivateApplicators(db.applicators, pAbility, createdUnit, this)",
    )
    ordered(
        "PFApplicator.cpp",
        "app->MakeApplicationTarget(target)",
        "target.GetUnit()->OnApplicatorApply(app)",
    )
    ordered(
        "PFBaseUnitAppl.cpp",
        "if (pApplicator->Start())",
        "RegisterNamedApplicator",
        "RegisterAppliedApplicator(pApplicator)",
        "pSender->RegisterSentApplicator(pApplicator)",
        "StepRing( appliedApplicators",
    )
    ordered(
        "PFApplBuff.cpp",
        "lifeTime = RetrieveParam",
        "duration = GetModifiedDuration(lifeTime)",
        "duration == -1.f",
        "duration -= dtInSeconds",
    )
    ordered(
        "PFDispatchFactory.cpp", "CreateApplicator(PFApplCreatePars", "pAppl->Init()"
    )
    ordered(
        "PFDispatch.cpp",
        "AddApplicators(",
        "CreateApplicator(cp)",
        "AddApplicator(pApplicator)",
        "void PFDispatch::_ApplyInternal()",
        "target.GetUnit()->OnDispatchApply",
        "ActivateApplicator(pHolder, pAbility)",
    )
    ordered(
        "PFApplicator.cpp",
        "void PFBaseApplicator::RemoveChildrenApplicators()",
        "app->Stop();",
        "MemorizeApplicator(app)",
    )
    checked = set()
    count = 0

    def read(j, state, expected, *, runtime=False, learned=()):
        nonlocal count
        value = evaluate(cases[j - 1], state, runtime, learned)
        assert isclose(value, expected, abs_tol=1.0e-6), (j, state, value, expected)
        checked.add(j)
        count += 1
        return value

    def write(j, resource, name, state, index=0):
        nodes = [
            n
            for n in xml("Items/Talents/Class/" + resource).iter(
                "PermanentStatModApplicator"
            )
            if n.findtext("modifier/variable") == name
        ]
        mod = nodes[index].find("modifier")

        def value(field):
            return evaluate(cases[j - 1], state, expr=mod.findtext(field + "/sString"))

        key = "v" + name
        state[key] = state.get(key, 0) * value("multValue") + value("addValue")

    # A unit samples its own formula during its update. Another unit's callback
    # can change inputs synchronously, even after the owner has already stepped.
    for order in permutations(("owner", "other")):
        before = order[0] == "other"
        state = {
            "vA4_FrogJump": 0,
            "vHero_Rage": 20,
            "vA0Shadow_BlockCounter": 5,
            "GetVariable": 10000,
            "vHatred": 2,
            "vA2_HeroCounter": 6,
            "vBardCurrentStacks": 5,
        }
        # These are separate cases with a controlled write, not one composite spell.
        for actor in order:
            if actor == "other":
                write(48, "Frogenglut/Ability4.TALENT.xdb", "A4_FrogJump", state)
                write(49, "Gunslinger/Ability_A4_2.TALENT.xdb", "Hero_Rage", state)
                write(
                    68, "Shadow/Ability_A3.TALENT.xdb", "A0Shadow_BlockCounter", state
                )
                write(69, "Shadow/Ability_A0.TALENT.xdb", "Hatred", state, 2)
                write(72, "Vampire/Ability_A2.TALENT.xdb", "A2_HeroCounter", state)
                write(
                    22, "Bard/A4_CurrentStackDrop.APLR.xdb", "BardCurrentStacks", state
                )
            else:
                cost = read(48, state, 100 if before else 200)
                rage = evaluate(cases[48], state)
                cooldown = read(72, state, 4 if before else 12)
                snapshot = evaluate(
                    cases[21],
                    state,
                    expr=xml(
                        "Items/Talents/Class/Bard/A4_SummonViolin.APLR.xdb"
                    ).findtext(
                        ".//PermanentStatModApplicator/modifier/addValue/sString"
                    ),
                )
                read(68, state, 0.64 if before else 0.65, runtime=True)
                for j, k in ((69, 10), (70, 1.6), (71, 1.6)):
                    read(j, state, (1 if before else 2) * k, runtime=True)
        assert state["vA4_FrogJump"] == 1 and cost == (100 if before else 200)
        assert state["vA2_HeroCounter"] == 7 and cooldown == (4 if before else 12)
        read(49, {"vA4_2SaveDuration": rage}, 0.8 if before else 1.6, runtime=True)
        read(
            22,
            {"vBardStacks_A4Start": snapshot},
            1.05 if before else 5.25,
            runtime=True,
        )

        # Remote query/impact vs effect removal on its receiver.
        effect = TimedEffect(DT)
        for actor in order:
            if actor == "owner":
                effect.step()
            else:
                live = int(effect.live)
                for j in (13, 14):
                    read(
                        j,
                        {"applArtist_A4_status": live},
                        11 if before else 0,
                        learned=("Artist_A4",),
                    )
                read(65, {"applPantherTime": live}, 10 / 3 if before else 0)
                read(
                    26,
                    {"vBladeDancer_Mastery": 1 + live},
                    62.7 if before else 59.85,
                    runtime=True,
                    learned=("BladeDancer_A0_SUP",),
                )
                read(67, {"FindApplicator": live}, 0 if before else 23)

        # A hit from another unit contributes one layer; two expiring layers
        # are refreshed only if the receiving mage still has that instance.
        mage = xml("Items/Talents/Class/Mage/status_A0_ChannelingTime.APLR.xdb")
        write_layers = mage.findtext(".//StatModApplicator/modifier/addValue/sString")

        def hit(raw):
            return evaluate(
                cases[54],
                {"GetVariable": raw, "sLife": 1000},
                expr=write_layers,
                context=cat[418],
            )

        old = TimedEffect(DT)
        fresh = None
        for actor in order:
            if actor == "other":
                if old.live and int(mage.findtext("flags")) & 1:
                    old.remaining = 4
                fresh = TimedEffect(4)
            else:
                # The owner's channel is started before its own StepApplicators.
                layers = (hit(200) if old.live else 0) + (hit(100) if fresh else 0)
                for j, secs in zip(
                    (55, 56, 57, 58),
                    (0.3, 0.4, 0.3, 0.3) if before else (0.36, 0.6, 0.36, 0.36),
                ):
                    read(j, {"vMage_A0_DamageCounter": layers}, secs, runtime=True)
                old.step()
                if fresh:
                    fresh.step()
        assert (fresh.remaining, old.live) == ((4 - DT, True) if before else (4, False))

        # A periodic reward/kill callback checks the owner's lockout.
        lock = TimedEffect(DT)
        gate = next(
            n.text
            for n in xml(cat[479]).iter("sString")
            if n.text and "sender.applMonster_A4uDebuff(UNIT) == pMisc" in n.text
        )
        for actor in order:
            if actor == "owner":
                lock.step()
            else:
                allowed = evaluate(
                    cases[61],
                    {
                        "applMonster_A4uDebuff": int(lock.live),
                        "vMonster_A4CurrentToxinStack": 0,
                    },
                    expr=gate,
                    context=cat[479],
                )
                assert allowed == (not before)
                if allowed:
                    for j in (62, 63):
                        read(j, {}, 30, runtime=True)

    # A pre-existing observer samples the shield counter; its read is independent
    # of which unit would cause a refund in play. Six subscription permutations.
    for order in permutations(("caster", "target", "observer")):
        shield = TimedEffect(DT)
        cached = 1
        for actor in order:
            if actor == "target":
                shield.step()
            elif actor == "caster":
                cached = int(shield.live)
            else:
                updated = (
                    order.index("target")
                    < order.index("caster")
                    < order.index("observer")
                )
                for j in (21, 25):
                    read(j, {"GetVariable": cached}, 0 if updated else 36, runtime=True)

    for caster_first in (True, False):
        # Existing receiver: successful Start writes immediately, independent of first tick.
        for j in (50, 51, 61):
            effect = None
            state = {}

            def apply():
                if j == 61:
                    return TimedEffect(read(j, {}, 30, runtime=True))
                write(
                    j,
                    "Healer/status_A5_SUP_Bubble.APLR.xdb",
                    "Healer_A5_SpellShieldCounter",
                    state,
                )
                duration = evaluate(
                    cases[j - 1],
                    {},
                    expr=xml(
                        "Items/Talents/Class/Healer/status_A5_SUP_Bubble.APLR.xdb"
                    ).findtext("lifeTime/sString"),
                    context=cat[340],
                )
                return TimedEffect(duration)

            for actor in ("caster", "target") if caster_first else ("target", "caster"):
                if actor == "caster":
                    effect = apply()
                    initial = effect.remaining
                elif effect:
                    effect.step()
            assert effect.remaining == initial - (DT if caster_first else 0)
            if j != 61:
                read(j, state, 1, runtime=True)
            effect.step()
            assert effect.remaining == initial - DT * (2 if caster_first else 1)

    # Removing an existing demon's parent tears down its child modifier on the master;
    # for an ordinary master's existing summon, creation/subscription places it after the master.
    resource = xml("Items/Talents/Class/Demonolog/SummonDemons.APLR.xdb")
    child = next(
        n
        for n in resource.iter("StatModApplicator")
        if n.findtext("modifier/variable") == "DemonsIsAlive"
    )
    assert child.findtext("applyTarget") == "AbilityOwner"
    increment = evaluate(
        cases[27], {}, expr=child.findtext("modifier/addValue/sString")
    )
    for j in (28, 29):
        demons = 2 * increment
        cached = read(j, {"vDemonsIsAlive": demons}, 200)
        demons -= increment
        assert cached == 200
        read(j, {"vDemonsIsAlive": demons}, 100)

    # If an existing dispenser adds its marker on a recipient before/after that unit's
    # periodic callback, the callback sees one/zero enabled markers respectively.
    for order in permutations(("dispenser", "recipient")):
        markers = []
        for actor in order:
            if actor == "dispenser":
                markers.append(True)
            else:
                read(
                    54,
                    {"CountApplicators": sum(markers), "vInventor_Details": 0},
                    4 if order[0] == "dispenser" else 3,
                    runtime=True,
                )
    # Caster and its previously created pet retain their relative subscription order.
    # A third unit can have been subscribed before the owner, between them, or after both.
    # The Bard record is made at spawn. Compare a five-stack instrument and the live owner on
    # opposite sides of a reset to detect accidentally reading the live owner instead.
    for order in permutations(("owner", "pet", "target")):
        if order.index("owner") > order.index("pet"):
            continue
        state = {"vBardCurrentStacks": 5}
        snapshot = evaluate(
            cases[21],
            state,
            expr=xml("Items/Talents/Class/Bard/A4_SummonViolin.APLR.xdb").findtext(
                ".//PermanentStatModApplicator/modifier/addValue/sString"
            ),
        )
        observed = []
        for actor in order:
            if actor == "owner":
                write(
                    22, "Bard/A4_CurrentStackDrop.APLR.xdb", "BardCurrentStacks", state
                )
            elif actor == "pet":
                observed.append(
                    read(22, {"vBardStacks_A4Start": snapshot}, 5.25, runtime=True)
                )
            else:
                before_reset = order.index("target") < order.index("owner")
                read(22, state, 5.25 if before_reset else 1.05)
        assert observed == [5.25]

    # A one-step mark placed on an existing receiver is registered immediately.
    # A third unit querying the marked target can see the short-lived mark between
    # attachment and the receiver step even when it is already gone by frame end.
    for order in permutations(("applier", "receiver", "observer")):
        mark = None
        for actor in order:
            if actor == "applier":
                mark = TimedEffect(DT)
                read(67, {"FindApplicator": int(mark.live)}, 0)
            elif actor == "receiver" and mark is not None:
                mark.step()
            elif actor == "observer":
                a, r, o = map(order.index, ("applier", "receiver", "observer"))
                visible = a < o and not a < r < o
                read(
                    67,
                    {"FindApplicator": int(mark is not None and mark.live)},
                    0 if visible else 23,
                )
        visible = order.index("receiver") < order.index("applier")
        read(67, {"FindApplicator": int(mark.live)}, 0 if visible else 23)

    return checked, count
