"""Focused r1117 status lifecycle fixtures. Times are simulation seconds."""

from dataclasses import dataclass
from math import isclose


@dataclass(eq=False)
class Entry:
    owner: str
    name: str
    end: float
    enabled: bool = True
    value: float = 0


class NamedRing(list):
    """One receiving unit's registered applicators, in insertion order."""

    def add(self, owner, name, end, value=0):
        item = Entry(owner, name, end, value=value)
        self.append(item)
        return item

    def matches(self, name, scope, owner):
        assert scope in ("GLOBAL", "UNIT")
        return (
            entry
            for entry in self
            if entry.name == name and (scope == "GLOBAL" or entry.owner == owner)
        )

    def find(self, name, scope="UNIT", owner="A"):
        return next(self.matches(name, scope, owner), None)

    def count(self, name, scope="GLOBAL", owner="A"):
        return sum(entry.enabled for entry in self.matches(name, scope, owner))

    def expire(self, time):
        self[:] = [entry for entry in self if entry.end > time]


def verify(cases, evaluate, xml, cat, ordered):
    ordered("PFBaseUnit.h", "namedApplicators.addLast(applicator)")
    ordered(
        "PFBaseUnitAppl.cpp",
        "if (pApplicator->Start())",
        "pApplicator->Stop();",
        "RegisterNamedApplicator(pApplicator.GetPtr())",
        "return FindApplicator( name, pMisc, searchType, 0 )",
        "it(namedApplicators)",
        "pApplicator->GetAbilityOwner() == pMiscAbilityOwner",
        "return pApplicator;",
        "return pOrigMisc;",
        "pApplicator->IsEnabled() && !applName.compare( name )",
    )
    ordered("PFApplicator.cpp", "flags |= FLAG_STOPPED", "NamedRing::remove(this)")
    ordered("PFApplBuff.cpp", "duration -= dtInSeconds", "return duration < EPS_VALUE")
    ordered(
        "PFApplMod.cpp",
        "pStat->RemoveModifier( modifierID )",
        "pStat->SetBaseValue(mul * pStat->GetBaseValue() + add)",
        "pAppl->GetDB().GetDBID() == pNewcomer->GetDB().GetDBID()",
        "++statusCount <= pNewcomer->GetDB().stackCount",
        "STATUSFLAGS_UPDATELIFETIME",
        "pAppl->ForceUpdateLifetime(",
        "STACKINGRULE_UNSTACKABLE",
    )
    ordered(
        "PFTargetSelector.cpp",
        "pAppl->GetDBBase()->GetDBID() == dbid",
        "pars.pOwner->ForAllSentApplicators",
    )
    ordered(
        "PFApplMod.cpp",
        "PFApplTargetsCounter::Step",
        "targetsCount = 0;",
        "if ( !IsEnabled() )",
        "EnumerateTargets();",
    )
    mark = xml("Items/Talents/Class/Rifleman/Status_A0.APLR.xdb")
    assert mark.findtext("stackableAcrossUnits") == "Unstackable"
    assert mark.findtext("stackCount") == "0" and int(mark.findtext("flags")) == 3
    ordered(
        "PFApplMod.cpp",
        "remaningTime > remaningTimeSecond",
        "blockApplicators.push_back(pSecond)",
        "pAppl->GetAbilityOwner() == pNewcomer->GetAbilityOwner()",
        "STATUSFLAGS_STOPSAMECONFLICTED",
        "STATUSFLAGS_STOPALLCONFLICTED",
        "CompareByPower(*it)",
        "(*it)->Block();",
    )
    for resource, expected in [
        ("Artist/status_A4_artist.APLR.xdb", "Artist_A4_status"),
        ("Night/Ability4_2.TALENT.xdb", "PantherTime"),
        ("Inventor/status_A2_dispenser.APLR.xdb", "Inventor_A2_MoreDetails"),
        ("Bard/Ability_A3.TALENT.xdb", "Bard_ShieldsCounter"),
    ]:
        assert expected in [
            el.text for el in xml("Items/Talents/Class/" + resource).iter("formulaName")
        ]
    tested = set()
    checks = 0

    def check(j, expected, state, runtime=False, learned=()):
        nonlocal checks
        actual = evaluate(cases[j - 1], state, runtime, learned)
        assert isclose(actual, expected, abs_tol=1e-6), (j, expected, actual, state)
        tested.add(j)
        checks += 1

    for name, method, rows, present, learned in [
        ("Artist_A4_status", "applArtist_A4_status", (13, 14), 11, ("Artist_A4",)),
        ("PantherTime", "applPantherTime", (65,), 10 / 3, ()),
        ("RiflemanA0Mark", "FindApplicator", (67,), 0, ()),
    ]:
        ring = NamedRing()
        foreign = ring.add("B", name, 8)
        ring.add("A", name + "Other", 20)
        scope = "GLOBAL" if method == "FindApplicator" else "UNIT"
        absent = 23 if scope == "GLOBAL" else 0

        def sample(expected):
            for j in rows:
                arguments = (
                    (repr(name), "pMisc", "GLOBAL") if scope == "GLOBAL" else ("UNIT",)
                )
                role = "receiver" if scope == "GLOBAL" else "sender"
                check(
                    j,
                    expected,
                    {
                        "objects": {
                            role: {
                                (method, arguments): int(
                                    ring.find(name, scope) is not None
                                )
                            }
                        }
                    },
                    learned=learned,
                )

        sample(present if scope == "GLOBAL" else absent)
        mine = ring.add("A", name, 5)
        sample(present)
        first = foreign if scope == "GLOBAL" else mine
        first.enabled = False
        assert ring.find(name, scope) is first
        sample(present)
        ring.expire(5)
        sample(present if scope == "GLOBAL" else absent)
        ring.expire(8)
        sample(absent)

    ring = NamedRing()
    name = "Inventor_A2_MoreDetails"
    mine = ring.add("A", name, 5)
    other = ring.add("B", name, 9)
    ring.add("C", name + "Extra", 12)

    def details(expected):
        check(
            54,
            expected,
            {
                "objects": {
                    "sender": {
                        (
                            "CountApplicators",
                            (repr(name), "pMisc", "GLOBAL"),
                        ): ring.count(name)
                    }
                }
            },
        )

    details(5)
    mine.enabled = False
    details(4)
    mine.enabled = True
    details(5)
    ring.expire(5)
    details(4)
    other.enabled = False
    details(3)
    ring.expire(9)
    details(3)

    ring = NamedRing()
    name = "Bard_ShieldsCounter"
    ring.add("B", name, 15, value=8)
    first = ring.add("A", name, 5, value=1)
    second = ring.add("A", name, 12, value=3)

    def refund(expected):
        counter = ring.find(name)
        for j in (21, 25):
            check(
                j,
                expected,
                {
                    "objects": {
                        "sender": {},
                        "sender.applBard_ShieldsCounter(UNIT)": {
                            ("GetVariable", ("'targetsCount'",)): counter.value
                            if counter
                            else 0
                        },
                    }
                },
                True,
            )

    refund(36)
    first.value = 0  # Next enumeration, no matching recipients.
    refund(0)
    ring.expire(5)
    assert ring.find(name) is second
    refund(72)
    ring.expire(12)
    refund(0)

    mage = xml("Items/Talents/Class/Mage/status_A0_ChannelingTime.APLR.xdb")
    assert int(mage.findtext("flags")) & 1 and mage.findtext("stackCount") == "2"
    assert mage.findtext("lifeTime/sString") == "cA0_DamageTaken_Duration"
    writer = mage.find(".//StatModApplicator")
    assert writer.findtext("dontUpdate") == "true"
    contribution = writer.findtext("modifier/addValue/sString")
    cap = next(
        node
        for node in xml("Items/Talents/Class/Mage/Ability0.TALENT.xdb").iter(
            "StatModApplicator"
        )
        if node.findtext("modifier/variable") == "Mage_A0_DamageCounter"
    )
    assert cap.findtext("constraint") == "UpperLimit"
    levels = NamedRing()

    def hit(time, raw):
        state = {"GetVariable": raw, "sLife": 1000}
        c = cases[54]
        duration = evaluate(
            c, state, expr=mage.findtext("lifeTime/sString"), context=cat[418]
        )
        for older in list(levels)[: int(mage.findtext("stackCount"))]:
            older.end = time + duration
        levels.add(
            "A",
            "Mage_A0_status",
            time + duration,
            value=evaluate(c, state, expr=contribution, context=cat[418]),
        )

    def channel(expected):
        limit = evaluate(
            cases[54],
            {},
            expr=cap.findtext("modifier/addValue/sString"),
            context=cat[418],
        )
        state = {
            "vMage_A0_DamageCounter": min(limit, sum(item.value for item in levels))
        }
        for j, seconds in zip((55, 56, 57, 58), expected):
            check(j, seconds, state)

    hit(0, 200)
    channel((0.36, 0.6, 0.36, 0.36))
    hit(2, 100)
    levels.expire(4)
    channel((0.3, 0.4, 0.3, 0.3))
    levels.expire(6)
    channel((0.6, 1, 0.6, 0.6))

    # Permanent modifiers write the unit variable once. Ending the writer is not an undo.
    def permanent(j, resource, variable, old, occurrence=0):
        root = xml("Items/Talents/Class/" + resource)
        writers = [
            node
            for node in root.iter("PermanentStatModApplicator")
            if node.findtext("modifier/variable") == variable
        ]
        w = writers[occurrence]
        return old * evaluate(
            cases[j - 1], {}, expr=w.findtext("modifier/multValue/sString")
        ) + evaluate(cases[j - 1], {}, expr=w.findtext("modifier/addValue/sString"))

    stacks = permanent(22, "Bard/A0_Spell.SPLL.xdb", "BardCurrentStacks", 4)
    check(22, 5.25, {"vBardCurrentStacks": stacks})
    stacks = permanent(
        22, "Bard/A4_CurrentStackDrop.APLR.xdb", "BardCurrentStacks", stacks
    )
    check(22, 1.05, {"vBardCurrentStacks": stacks})
    for j in (50, 51):
        resource = "Healer/status_A5_SUP_Bubble.APLR.xdb"
        value = permanent(j, resource, "Healer_A5_SpellShieldCounter", 2)
        check(j, 1, {"vHealer_A5_SpellShieldCounter": value}, True)
        # An untriggered expiration removes the status, but does not subtract the stored value.
        check(j, 1, {"vHealer_A5_SpellShieldCounter": value})
        value = permanent(j, resource, "Healer_A5_SpellShieldCounter", value, 1)
        check(j, 0, {"vHealer_A5_SpellShieldCounter": value}, True)
        check(j, 1, {"vHealer_A5_SpellShieldCounter": value})
    jumps = permanent(48, "Frogenglut/Ability4.TALENT.xdb", "A4_FrogJump", 0)
    check(48, 100, {"vA4_FrogJump": jumps})
    jumps = permanent(48, "Frogenglut/Ability4.TALENT.xdb", "A4_FrogJump", jumps, 1)
    check(48, 200, {"vA4_FrogJump": jumps})
    count = permanent(72, "Vampire/Ability_A2.TALENT.xdb", "A2_HeroCounter", 6)
    check(72, 4, {"vA2_HeroCounter": count})
    count = permanent(
        72, "Vampire/A2_ResetHeroCounter.APLR.xdb", "A2_HeroCounter", count
    )
    check(72, 12, {"vA2_HeroCounter": count})
    rage = permanent(49, "Gunslinger/Ability_A4_2.TALENT.xdb", "Hero_Rage", 20)
    check(49, 0.8, {"vHero_Rage": rage})
    check(49, 1.6, {"vHero_Rage": rage, "vA4_2SaveDuration": 1.6}, True)
    blocks = permanent(68, "Shadow/Ability_A3.TALENT.xdb", "A0Shadow_BlockCounter", 5)
    check(68, 36, {"vA0Shadow_BlockCounter": blocks})
    hatred = permanent(69, "Shadow/Ability_A0.TALENT.xdb", "Hatred", 2, 2)
    for j, expected in [(69, 10), (70, 1.6), (71, 1.6)]:
        check(j, expected, {"vHatred": hatred}, True)

    # These contributions belong to active StatMod instances, not permanent base writes.
    for j, resource, variable, initial, one, none, learned in [
        (
            26,
            "BladeDancer/status_A0_AddMastery.APLR.xdb",
            "BladeDancer_Mastery",
            62.7,
            59.85,
            57,
            ("BladeDancer_A0_SUP",),
        ),
        (28, "Demonolog/SummonDemons.APLR.xdb", "DemonsIsAlive", 200, 100, 300, ()),
        (29, "Demonolog/Ability_A4_2.TALENT.xdb", "DemonsIsAlive", 200, 100, 300, ()),
    ]:
        writer = next(
            e
            for e in xml("Items/Talents/Class/" + resource).iter("StatModApplicator")
            if e.findtext("modifier/variable") == variable
        )
        add = evaluate(
            cases[j - 1], {}, expr=writer.findtext("modifier/addValue/sString")
        )
        for n, expected in ((2, initial), (1, one), (0, none)):
            check(j, expected, {"v" + variable: n * add}, learned=learned)

    monster = "Items/Talents/Class/Monster/"
    ring = NamedRing()
    spell = "Monster_A4StackCooldownSpell"
    timer = xml(monster + "status_A4_StackCountCooldown.APLR.xdb")
    assert timer.findtext("formulaName") == spell
    progress = xml(monster + "status_A4_StackCount.APLR.xdb").findtext(
        "customProgress/sString"
    )
    ring.add("B", spell, 29)
    own = ring.add("A", spell, 30)
    for time, remaining, denominator in [(0, 30, 30), (12, 18, 24)]:
        selected = ring.find(spell)
        assert selected is own
        states = {
            "objects": {
                "sender": {"vTotal_CooldownReduction": 0 if time == 0 else 20},
                "sender.applMonster_A4StackCooldownSpell(UNIT)": {
                    ("GetVariable", ("'duration'",)): selected.end - time
                },
            }
        }
        assert isclose(
            evaluate(cases[60], states, expr=progress), remaining / denominator
        )
        check(61, denominator, states, True)
    mark = "Monster_A4uDebuff"
    gate = xml(cat[479]).findall(".//sString")
    gate = next(
        el.text
        for el in gate
        if el.text and "sender.applMonster_A4uDebuff(UNIT) == pMisc" in el.text
    )
    ring = NamedRing()
    ring.add("B", mark, 40)
    for j in (62, 63):
        check(j, 30, {}, True)
    for time, available in [(0, True), (1, False), (31, True)]:
        if time == 1:
            ring.add("A", mark, 31)
        ring.expire(time)
        states = {
            "objects": {
                "sender": {
                    ("applMonster_A4uDebuff", ("UNIT",)): int(
                        ring.find(mark) is not None
                    ),
                    "vMonster_A4CurrentToxinStack": 0,
                }
            }
        }
        assert evaluate(cases[61], states, expr=gate, context=cat[479]) == available
    assert ring.find(mark, "GLOBAL") is not None

    return tested, checks
