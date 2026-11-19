"""r1117 conflict regression. One Arena represents the statuses on one unit."""

from dataclasses import dataclass, field
from math import inf, isclose


@dataclass(eq=False)
class Status:
    path: str
    db: object
    owner: str
    end: float
    blocked_by: set = field(default_factory=set)
    stopped: bool = False

    @property
    def enabled(self):
        return not self.stopped and not self.blocked_by


class Arena:
    """Whole-status power conflicts; stat-only merges are tested separately below."""

    def __init__(self, xml):
        self.xml = xml
        self.active = []

    def stop(self, item):
        item.stopped = True
        for other in self.active:
            other.blocked_by.discard(item)

    def step(self, now):
        for item in self.active:
            if item.end <= now or (
                item.blocked_by and int(item.db.findtext("behaviorFlags")) & 1
            ):
                self.stop(item)

    def apply(self, path, owner, now, duration):
        db = self.xml(path)
        new = Status(path, db, owner, now + duration)
        count = 0
        limit = int(db.findtext("stackCount"))
        flags = int(db.findtext("flags"))
        rule = db.findtext("stackableAcrossUnits")
        for old in [item for item in self.active if item.enabled]:
            if old.path == path:
                same_owner = old.owner == owner
                if same_owner or rule == "PartiallyStackable":
                    count += 1
                    if count <= limit:
                        if same_owner and flags & 1 and 0 < duration < inf:
                            old.end = new.end
                        continue
                elif rule != "Unstackable":
                    continue
                stop = flags & (4 if same_owner else 32)
            else:

                def excludes(item, other):
                    return any(
                        el.get("href") == "/" + other.path.removesuffix(".xdb")
                        for el in item.db.findall(
                            "unstackableWith/ApplicatorsList/applicators/Item"
                        )
                    )

                if not (excludes(new, old) or excludes(old, new)):
                    continue
                stop = flags & 32
            if stop:
                self.stop(old)
                continue
            power = int(db.findtext("power"))
            old_power = int(old.db.findtext("power"))
            if power > old_power or (
                power == old_power
                and new.end < inf
                and old.end < inf
                and new.end > old.end
            ):
                old.blocked_by.add(new)
            else:
                new.blocked_by.add(old)
        self.active.append(new)
        return new


def verify(cases, evaluate, xml, ordered):
    ordered(
        "PFApplMod.cpp",
        "return abs(valueAfter - valueBefore)",
        "remaningTime > remaningTimeSecond",
        "|| GetDB().power > pSecond->GetDB().power",
        "maxModifers.insert",
        "if (val > itMod->second.first)",
        "itMod->second.second = it",
        "->Unblock();",
        "++statusCount <= pNewcomer->GetDB().stackCount",
        "STATUSFLAGS_UPDATELIFETIME",
        "STATUSFLAGS_STOPSAMECONFLICTED",
        "STACKINGRULE_PARTIALLYSTACKABLE",
        "STATUSFLAGS_STOPALLCONFLICTED",
        "IsInList(pAppl->GetDBBase()",
        "pReceiver->ForAllStatusApplicators(f)",
        "NDb::StatModApplicator::typeId",
        "NDb::UIMessageApplicator::typeId",
        "IsComparableByValue()",
        "CompareByPower",
        "RemoveChildrenApplicators()",
        "ActiveStatusRing::remove(this)",
        "MergeByValue();",
        "blockedByApplicators.remove(this)",
        "blockedByApplicators.size() == 0",
        "(*it)->Unblock();",
    )
    ordered(
        "PFApplicator.cpp",
        "void PFBaseApplicator::Block()",
        "SetEnabled(false)",
        "Disable();",
        "void PFBaseApplicator::Unblock()",
        "SetEnabled(true)",
        "Enable();",
    )
    ordered(
        "PFApplBuff.cpp",
        "BUFFBEHAVIOR_STOPONDISABLE",
        "return true;",
        "duration == -1.f",
        "duration -= dtInSeconds",
    )
    root = "Items/Talents/Class/"
    count = 0
    checked = set()

    def check(j, expected, state, runtime=False, learned=()):
        nonlocal count
        value = evaluate(cases[j - 1], state, runtime, learned)
        assert isclose(value, expected, abs_tol=1e-6), (j, value, expected)
        checked.add(j)
        count += 1

    # Four same-source applications: two older entries refresh, the third conflicts.
    arena = Arena(xml)
    path = root + "BladeDancer/status_A0_AddMastery.APLR.xdb"
    one, two, three, four = [arena.apply(path, "A", time, 4) for time in range(4)]
    assert [item.end for item in arena.active] == [7, 7, 6, 7]
    assert three.blocked_by == {four} and not three.stopped

    def mastery(expected):
        check(
            26,
            expected,
            {"vBladeDancer_Mastery": sum(item.enabled for item in arena.active)},
            learned=("BladeDancer_A0_SUP",),
        )

    mastery(65.55)
    arena.step(3.1)
    assert three.stopped
    arena.stop(four)
    mastery(62.7)
    arena.step(7)
    mastery(57)

    # A genuine priority-1 / priority-0 exclusion across different DBIDs.
    arena = Arena(xml)
    aura = "Summons/Dispenser/status_A2_RangeAura.APLR.xdb"
    dispenser = root + "Inventor/status_A2_dispenser.APLR.xdb"
    weak = arena.apply(aura, "A", 0, inf)

    def details(expected):
        check(
            54,
            expected,
            {
                "CountApplicators": sum(
                    s.enabled and s.path == dispenser for s in arena.active
                )
            },
        )

    details(3)
    strong = arena.apply(dispenser, "B", 1, inf)
    assert weak.blocked_by == {strong} and strong.enabled
    details(4)
    arena.stop(strong)
    assert weak.enabled
    details(3)
    dispensers = [arena.apply(dispenser, str(i), 2, inf) for i in range(4)]
    assert [s.enabled for s in dispensers] == [True, True, True, False]
    details(6)
    arena.stop(dispensers[2])
    assert dispensers[3].enabled
    details(6)

    # Equal-power, finite timers: ties favour the incumbent. Exercise early removal,
    # expiration while blocked, and a stop-on-disable status that cannot resume.
    for hero, resource, j in [
        ("Artist", "status_A4_artist", 13),
        ("Rifleman", "Status_A0", 67),
        ("Monster", "status_A4u_Debuff", 62),
    ]:
        path = root + hero + "/" + resource + ".APLR.xdb"
        arena = Arena(xml)
        old = arena.apply(path, "A", 0, 5)
        new = arena.apply(path, "B", 1, 4)
        assert new.blocked_by == {old}
        arena.step(1.1)
        arena.stop(old)
        if hero == "Rifleman":
            assert new.stopped and not new.enabled
            check(j, 23, {"FindApplicator": int(not new.stopped)})
        else:
            assert new.enabled and new.end == 5
        arena = Arena(xml)
        old = arena.apply(path, "A", 0, 4)
        new = arena.apply(path, "B", 1, 5)
        assert old.blocked_by == {new}
        arena.step(4)
        assert old.stopped and new.enabled
        arena.step(6)
        assert not old.enabled and not new.enabled
        if hero == "Artist":
            for row in (13, 14):
                check(
                    row,
                    0,
                    {"applArtist_A4_status": int(not old.stopped)},
                    learned=("Artist_A4",),
                )
        if hero == "Monster":
            for row in (62, 63):
                check(row, 30, {}, True)
    # Same-owner refresh of the shield explicitly stops the old parent. Absorption
    # capacity isn't the power used by the engine for cross-owner conflicts.
    arena = Arena(xml)
    shield = root + "Bard/status_A3_Shield.APLR.xdb"
    old = arena.apply(shield, "A", 0, 8)
    new = arena.apply(shield, "A", 1, 3)
    assert old.stopped and new.enabled
    for row in (21, 25):
        check(row, 36, {"GetVariable": int(new.enabled)}, True)
    arena.step(4)
    assert not old.enabled and not new.enabled
    for row in (21, 25):
        check(row, 0, {"GetVariable": 0}, True)

    # Two overlapping Healer shields do not pool charges. Reactivation invokes the
    # same initialization as first enable; choose an early stop while the old
    # buff still exists, before its stop-by-children check can terminate it.
    arena = Arena(xml)
    bubble = root + "Healer/status_A5_SUP_Bubble.APLR.xdb"
    old = arena.apply(bubble, "A", 0, 5)
    new = arena.apply(bubble, "B", 1, 5)
    assert old.blocked_by == {new}
    arena.stop(new)
    assert old.enabled
    writer = xml(bubble).find(".//PermanentStatModApplicator/modifier")
    for j in (50, 51):
        initial = evaluate(cases[j - 1], {}, expr=writer.findtext("addValue/sString"))
        mul = evaluate(cases[j - 1], {}, expr=writer.findtext("multValue/sString"))
        check(j, 1, {"vHealer_A5_SpellShieldCounter": mul * 2 + initial}, True)

    # Mage: inspect the stat-only pair compared after the first two are refreshed.
    # Both test inputs go through the original damage contribution and upper limit.
    mage = xml(root + "Mage/status_A0_ChannelingTime.APLR.xdb")
    assert mage.findtext("stackCount") == "2" and int(mage.findtext("flags")) & 1
    assert [el.tag for el in mage.findall("applicators/Item/*")] == [
        "StatModApplicator"
    ]
    writer = mage.find(".//StatModApplicator/modifier/addValue/sString").text
    ability = root + "Mage/Ability0.TALENT.xdb"
    cap_node = next(
        n
        for n in xml(ability).iter("StatModApplicator")
        if n.findtext("constraint") == "UpperLimit"
    )
    cap = evaluate(
        cases[54],
        {},
        expr=cap_node.findtext("modifier/addValue/sString"),
        context=ability,
    )

    def layers(raw):
        return evaluate(
            cases[54], {"sLife": 1000, "GetVariable": raw}, expr=writer, context=ability
        )

    base = layers(100) + layers(100)
    old_delta = min(cap, base + layers(200)) - base
    new_delta = min(cap, base + layers(100)) - base
    assert (
        old_delta == new_delta == 1
    )  # strict greater-than retains the initial (new) candidate
    for j, seconds in zip((55, 56, 57, 58), (0.3, 0.4, 0.3, 0.3)):
        check(j, seconds, {"vMage_A0_DamageCounter": base + new_delta})

    # A live suppressed status can also return when the winning shield is broken early.
    arena = Arena(xml)
    old = arena.apply(shield, "A", 0, 6)
    new = arena.apply(shield, "B", 1, 6)
    assert old.blocked_by == {new}
    arena.stop(new)
    assert old.enabled and old.end == 6
    # If the selected resource instead stops on disable it cannot be restored after Step.
    arena = Arena(xml)
    timer = root + "Monster/status_A4_StackCountCooldown.APLR.xdb"
    old = arena.apply(timer, "A", 0, 24)
    new = arena.apply(timer, "A", 1, 30)
    assert old.blocked_by == {new}
    arena.step(2)
    arena.stop(new)
    assert old.stopped and not old.enabled
    check(61, 24, {"vTotal_CooldownReduction": 20}, True)

    # Non-status writers: these cases exercise their own cap or equality check rather than
    # passing the finished value through Status::Start a second time.
    def writer(resource, variable, kind="PermanentStatModApplicator"):
        return next(
            node
            for node in xml(root + resource).iter(kind)
            if node.findtext("modifier/variable") == variable
        )

    bard = writer("Bard/A0_Spell.SPLL.xdb", "BardCurrentStacks")
    for n, allowed in [(19, True), (20, False)]:
        state = {"vBardCurrentStacks": n}
        assert (
            evaluate(cases[21], state, expr=bard.findtext("enabled/sString")) == allowed
        )
        if allowed:
            state["vBardCurrentStacks"] += evaluate(
                cases[21], state, expr=bard.findtext("modifier/addValue/sString")
            )
        check(22, 21, state)
    for j in (28, 29):
        add = writer(
            "Demonolog/SummonDemons.APLR.xdb", "DemonsIsAlive", "StatModApplicator"
        )
        assert add.findtext("applyTarget") == "AbilityOwner"
        unit = evaluate(
            cases[j - 1], {}, expr=add.findtext("modifier/addValue/sString")
        )
        for n, expected in ((3, 300), (2, 200), (1, 100)):
            check(j, expected, {"vDemonsIsAlive": n * unit})
    jump = writer("Frogenglut/Ability4.TALENT.xdb", "A4_FrogJump")
    extra = evaluate(cases[47], {}, expr=jump.findtext("modifier/addValue/sString"))
    check(48, 100, {"vA4_FrogJump": 2 + extra})
    rage = writer("Gunslinger/Ability_A0.TALENT.xdb", "Hero_Rage")
    extra = evaluate(
        cases[48],
        {"vHero_Rage": 20},
        expr=rage.findtext("modifier/addValue/sString"),
        context=root + "Gunslinger/Ability_A0.TALENT.xdb",
    )
    assert extra == 0
    check(49, 1.6, {"vHero_Rage": 20 + extra})
    night = xml(root + "Night/Ability4_2.TALENT.xdb")
    assert any(
        n.findtext("formulaName") == "PantherTime"
        for n in night.iter("AbilityModApplicator")
    )
    for n, expected in ((2, 10 / 3), (1, 10 / 3), (0, 0)):
        check(65, expected, {"applPantherTime": int(n > 0)})
    block = writer("Shadow/Ability_A3.TALENT.xdb", "A0Shadow_BlockCounter")
    extra = evaluate(cases[67], {}, expr=block.findtext("modifier/addValue/sString"))
    check(68, 36, {"vA0Shadow_BlockCounter": 5 + extra})
    hatred = writer("Shadow/appl_HatredGeneration.APLR.xdb", "Hatred")
    assert not evaluate(
        cases[68],
        {"vHatred": 3, "vHatredMax": 3},
        expr=hatred.findtext("enabled/sString"),
    )
    for j, expected in [(69, 30), (70, 4.8), (71, 4.8)]:
        check(j, expected, {"vHatred": 3}, True)
    vampire = writer("Vampire/Ability_A2.TALENT.xdb", "A2_HeroCounter")
    extra = evaluate(cases[71], {}, expr=vampire.findtext("modifier/addValue/sString"))
    check(72, 4, {"vA2_HeroCounter": 7})
    check(72, 12, {"vA2_HeroCounter": 7 + extra})
    return checked, count
