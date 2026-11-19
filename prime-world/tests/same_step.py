"""Same simulation step: evaluate the r1117 formula at each callback boundary."""

from math import inf, isclose
from status_conflicts import Arena


def verify(cases, evaluate, xml, cat, ordered):
    ordered(
        "../PF_Core/World.cpp",
        "objectsForStep.first()",
        "pCurrentObjectIsBeingStepped->Step(dtInSeconds)",
        "WorldObjectBase::Ring::next",
    )
    ordered(
        "PFMaleHero.cpp",
        "pTalents->Update(dtInSeconds)",
        "return PFEaselPlayer::Step(dtInSeconds)",
    )
    ordered("PFTalent.cpp", "pTalent->Update( dt, true )")
    ordered(
        "PFBaseUnit.cpp",
        "pAbility->Update(dt)",
        "UpdateAbilities(dtInSeconds, isDead)",
        "UpdateExternalAbilities(dtInSeconds)",
        "FsmStep(dtInSeconds)",
        "StepApplicators(dtInSeconds)",
    )
    ordered(
        "PFBaseUnitAppl.cpp",
        "EventHappened(evtApplicator)",
        "if (pApplicator->Start())",
        "RegisterNamedApplicator",
        "RegisterAppliedApplicator(pApplicator)",
        "StepRing( appliedApplicators",
    )
    ordered(
        "PFApplicator.h",
        "if (applicator->Step(dtInSeconds))",
        "applicator->Stop();",
        "MemorizeApplicator(pHolder)",
        "PFBaseApplicator *app = applicators.first();",
        "processed.addLast(app)",
        "f(applObj);",
    )
    ordered("PFBaseUnit.h", "appliedApplicators.addLast(applicator)")
    ordered(
        "PFBaseUnitAppl.cpp",
        "newListenerType < itemListenerType",
        "GetListenerPriority() > pItem->GetListenerPriority()",
        "eventListeners.push_back",
        "eventListeners.insert",
        "pListener->OnEvent(&evt)",
    )
    ordered(
        "PFAbilityData.cpp",
        "UpdateAbilityModifiers();",
        "RecalculateManaCost();",
        "pOwner->TakeMana( GetManaCost() )",
    )
    ordered(
        "PFAbilityInstance.cpp",
        "RecalculateAndRestartCooldown();",
        "dispatch.Start();",
        "pOwner->EventHappened",
        "pAbilityData->SpendMana();",
    )
    ordered("PFApplMod.cpp", "targetsCount = 0;", "EnumerateTargets();")
    rows = set()
    checks = 0

    def read(j, state, expected, *, runtime=False, learned=()):
        nonlocal checks
        value = evaluate(cases[j - 1], state, runtime, learned)
        assert isclose(value, expected, abs_tol=1e-6), (j, state, value, expected)
        rows.add(j)
        checks += 1
        return value

    root = "Items/Talents/Class/"

    def write(j, state, resource, variable, occurrence=0):
        node = [
            n
            for n in xml(root + resource).iter("PermanentStatModApplicator")
            if n.findtext("modifier/variable") == variable
        ][occurrence]
        key = "v" + variable

        def param(field):
            return evaluate(
                cases[j - 1],
                state,
                expr=node.findtext("modifier/" + field + "/sString"),
            )

        state[key] = state.get(key, 0) * param("multValue") + param("addValue")

    # Same timestamp, two different receiver-ring positions. Do not sweep timers on application.
    for expire_first in (True, False):
        for j, hero, file, name, method in [
            (
                13,
                "Artist",
                "status_A4_artist",
                "Artist_A4_status",
                "applArtist_A4_status",
            ),
            (
                14,
                "Artist",
                "status_A4_artist",
                "Artist_A4_status",
                "applArtist_A4_status",
            ),
            (67, "Rifleman", "Status_A0", "RiflemanA0Mark", "FindApplicator"),
            (62, "Monster", "status_A4u_Debuff", "Monster_A4uDebuff", "gate"),
            (63, "Monster", "status_A4u_Debuff", "Monster_A4uDebuff", "gate"),
        ]:
            arena = Arena(xml)
            path = f"{root}{hero}/{file}.APLR.xdb"
            old = arena.apply(path, "A", 0, 1)
            assert old.db.findtext("formulaName") == name
            if expire_first:
                arena.stop(old)
            else:
                new = arena.apply(path, "A", 1, 4)
                assert not old.stopped and new.enabled
            found = any(not item.stopped for item in arena.active)
            if j in (13, 14):
                read(
                    j,
                    {method: int(found)},
                    0 if expire_first else 11,
                    learned=("Artist_A4",),
                )
            elif j == 67:
                read(j, {method: int(found)}, 23 if expire_first else 0)
            else:
                gate = next(
                    e.text
                    for e in xml(cat[479]).iter("sString")
                    if e.text
                    and "sender.applMonster_A4uDebuff(UNIT) == pMisc" in e.text
                )
                assert (
                    evaluate(
                        cases[j - 1],
                        {
                            "applMonster_A4uDebuff": int(found),
                            "vMonster_A4CurrentToxinStack": 0,
                        },
                        expr=gate,
                        context=cat[479],
                    )
                    == expire_first
                )
                read(j, {}, 30, runtime=True)
            if expire_first:
                new = arena.apply(path, "A", 1, 4)
            else:
                arena.stop(old)
            assert new.enabled and not new.stopped

        # Refresh only live Mage instances; the old contribution was captured on a 200-damage hit.
        mage = xml(root + "Mage/status_A0_ChannelingTime.APLR.xdb")
        writer = mage.findtext(".//StatModApplicator/modifier/addValue/sString")

        def layers(raw):
            return evaluate(
                cases[54],
                {"sLife": 1000, "GetVariable": raw},
                expr=writer,
                context=cat[418],
            )

        active = [] if expire_first else [layers(200)]
        assert int(mage.findtext("flags")) & 1 and len(active) <= int(
            mage.findtext("stackCount")
        )
        active.append(layers(100))
        level = sum(active)
        for j, expected in zip(
            (55, 56, 57, 58),
            (0.48, 0.8, 0.48, 0.48) if expire_first else (0.3, 0.4, 0.3, 0.3),
        ):
            read(j, {"vMage_A0_DamageCounter": level}, expected, runtime=True)

    # A strong parent is removed. A lower-priority parent still has duration remaining.
    # Inspect the active ring when the replacement arrives, not just at the end of the step.
    for expire_first in (True, False):
        arena = Arena(xml)
        weak = arena.apply(
            "Summons/Dispenser/status_A2_RangeAura.APLR.xdb", "A", 0, inf
        )
        path = root + "Inventor/status_A2_dispenser.APLR.xdb"
        strong = arena.apply(path, "B", 0, inf)
        if expire_first:
            arena.stop(strong)  # A source removal for these indefinite auras.
        else:
            arena.apply(path, "C", 1, inf)
        count = sum(s.enabled and s.path == path for s in arena.active)
        read(54, {"CountApplicators": count}, 3 if expire_first else 5)
        assert weak.enabled == expire_first
        if expire_first:
            arena.apply(path, "C", 1, inf)
        else:
            arena.stop(strong)
        assert weak.enabled == (not expire_first)
        read(
            54,
            {
                "CountApplicators": sum(
                    s.enabled and s.path == path for s in arena.active
                )
            },
            4,
        )

    # A counter exposes the last enumeration even when the selected shield already disappeared.
    shield = "Bard/status_A3_Shield.APLR.xdb"
    for refresh_first in (False, True):
        arena = Arena(xml)
        old = arena.apply(root + shield, "A", 0, 1)
        cached = int(old.enabled)
        arena.stop(old)
        if refresh_first:
            cached = sum(s.enabled for s in arena.active)
        for j in (21, 25):
            read(j, {"GetVariable": cached}, 0 if refresh_first else 36, runtime=True)
        arena.apply(root + shield, "A", 1, 4)
        for j in (21, 25):
            read(j, {"GetVariable": cached}, 0 if refresh_first else 36, runtime=True)
        cached = sum(s.enabled for s in arena.active)
        for j in (21, 25):
            read(j, {"GetVariable": cached}, 36, runtime=True)

    for write_first in (False, True):
        state = {"vBardCurrentStacks": 5}
        if write_first:
            write(22, state, "Bard/A4_CurrentStackDrop.APLR.xdb", "BardCurrentStacks")
        saved = evaluate(
            cases[21],
            state,
            expr=xml(root + "Bard/A4_SummonViolin.APLR.xdb").findtext(
                ".//PermanentStatModApplicator/modifier/addValue/sString"
            ),
        )
        if not write_first:
            write(22, state, "Bard/A4_CurrentStackDrop.APLR.xdb", "BardCurrentStacks")
        read(
            22,
            {"vBardStacks_A4Start": saved},
            1.05 if write_first else 5.25,
            runtime=True,
        )

        state = {"vHero_Rage": 20}
        if write_first:
            write(49, state, "Gunslinger/Ability_A4_2.TALENT.xdb", "Hero_Rage")
        saved = evaluate(cases[48], state)
        if not write_first:
            write(49, state, "Gunslinger/Ability_A4_2.TALENT.xdb", "Hero_Rage")
        read(
            49, {"vA4_2SaveDuration": saved}, 0.8 if write_first else 1.6, runtime=True
        )

        for j in (50, 51):
            bubble = "Healer/status_A5_SUP_Bubble.APLR.xdb"
            state = {"vHealer_A5_SpellShieldCounter": 1}
            # A successful intercept writes -1; a fresh bubble activation overwrites with 1.
            for which in (0, 1) if write_first else (1, 0):
                write(j, state, bubble, "Healer_A5_SpellShieldCounter", which)
            read(j, state, 0 if write_first else 1, runtime=True)

        state = {"vA2_HeroCounter": 6}
        if write_first:
            write(72, state, "Vampire/Ability_A2.TALENT.xdb", "A2_HeroCounter")
        cooldown = read(72, state, 4 if write_first else 12)
        if not write_first:
            write(72, state, "Vampire/Ability_A2.TALENT.xdb", "A2_HeroCounter")
        assert state["vA2_HeroCounter"] == 7 and cooldown == (4 if write_first else 12)

        state = {"vA0Shadow_BlockCounter": 5, "GetVariable": 10000}
        if write_first:
            write(68, state, "Shadow/Ability_A3.TALENT.xdb", "A0Shadow_BlockCounter")
        read(68, state, 0.64 if write_first else 0.65, runtime=True)
        state = {"vHatred": 2}
        if write_first:
            write(69, state, "Shadow/Ability_A0.TALENT.xdb", "Hatred", 2)
        for j, factor in ((69, 10), (70, 1.6), (71, 1.6)):
            read(j, state, factor * (1 if write_first else 2), runtime=True)

        # Talent manaCost is cached during Update; SpendMana does not execute the XDB expression again.
        state = {"vA4_FrogJump": 0}
        if write_first:
            write(48, state, "Frogenglut/Ability4.TALENT.xdb", "A4_FrogJump")
        cached = read(48, state, 100 if write_first else 200)
        if not write_first:
            write(48, state, "Frogenglut/Ability4.TALENT.xdb", "A4_FrogJump")
        assert state["vA4_FrogJump"] == 1 and cached == (100 if write_first else 200)
        for j in (28, 29):
            contributions = [1, 1]
            if write_first:
                contributions.pop()
            cached = read(
                j, {"vDemonsIsAlive": sum(contributions)}, 100 if write_first else 200
            )
            if not write_first:
                contributions.pop()
            assert len(contributions) == 1 and cached == (100 if write_first else 200)

        layers = [1, 1]
        if write_first:
            layers.pop()
        read(
            26,
            {"vBladeDancer_Mastery": sum(layers)},
            59.85 if write_first else 62.7,
            runtime=True,
            learned=("BladeDancer_A0_SUP",),
        )
        panthers = [1]
        if write_first:
            panthers.pop()
        read(65, {"applPantherTime": int(bool(panthers))}, 0 if write_first else 10 / 3)
        timer = read(
            61,
            {"vTotal_CooldownReduction": 20 if write_first else 0},
            24 if write_first else 30,
            runtime=True,
        )
        assert timer in (24, 30)
    return rows, checks
