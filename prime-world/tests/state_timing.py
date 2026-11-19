"""Offline regression for r1117. Pass the directory containing Data/ and Src/."""

import argparse
import ast
import csv
import html
import json
import math
import operator
import re
from functools import cache
from pathlib import Path
import xml.etree.ElementTree as ET
from urllib.parse import unquote

from delay_notification import verify as verify_delay_notification
from program_wait import verify as verify_program_wait
from nested_program import verify as verify_nested_program
from effect_order import verify as verify_effect_order
from dispatch_retry import verify as verify_dispatch_retry
from resurrection_step import verify as verify_resurrection_step
from resurrection import verify as verify_resurrection
from death_order import verify as verify_death_order
from cross_unit_step import verify as verify_cross_unit_step
from same_step import verify as verify_same_step
from status_conflicts import verify as verify_status_conflicts
from status_lifecycle import verify as verify_status_lifecycle

if not __debug__:
    raise RuntimeError("Run without -O to enable regression assertions.")

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("r1117", type=Path)
parser.add_argument(
    "--native",
    action="store_true",
    help="also compile original conflict methods with CXX or the platform compiler",
)
options = parser.parse_args()
original = options.r1117
data = original / "Data"
p = Path(__file__).resolve().parents[1]
cat = {
    int(row[0]): row[-2]
    for row in list(
        csv.reader((p / "tables/talent-catalog.csv").open(encoding="utf-8-sig"))
    )[1:]
}
rows = re.compile(r'<tr id="p-[^"]+">.*?</tr>', re.S)
text = lambda x: html.unescape(re.sub("<[^>]*>", "", x)).strip()


@cache
def xml(path):
    return ET.parse(data / path).getroot()


@cache
def lines(path):
    return (data / path).read_text("utf-8-sig").splitlines()


def src(row):
    m = re.search(r'/Data/([^"#]+)#L(\d+)', row)
    return unquote(m[1]), int(m[2])


def formula(path, n):
    l = lines(path)
    for j in range(n - 1, min(n + 90, len(l))):
        if "<sString>" in l[j]:
            z = "\n".join(l[j : j + 45])
            return html.unescape(
                z.split("<sString>", 1)[1].split("</sString>", 1)[0]
            ).strip()
        if "<sString />" in l[j]:
            return ""
    return None


def constants(node):
    if node is None:
        return {}
    if not len(node) and node.get("href"):
        node = xml(node.get("href").lstrip("/") + ".xdb")
    result = {}
    for it in node.findall(".//vars/Item"):
        c = it.find("UnitConstant")
        if c is None and it.get("href"):
            c = xml(it.get("href").lstrip("/") + ".xdb")
        if c is not None:
            result[c.findtext("name")] = c.findtext("var/sString", "")
    return result


glob = constants(xml("GameLogic/AILogic.AILP.xdb").find("globalConstants"))


@cache
def env(path):
    return glob | constants(xml(path).find("constants"))


def strip(expr):
    return re.sub(r"/\*.*?\*/|//[^\n]*", "", expr, flags=re.S).strip()


sc = xml("GameLogic/AILogic.AILP.xdb").find("abilityAndDamageScalingParams")


@cache
def calc(expr, path, stat):
    expr = re.sub(r"(?<=\d)[fF]\b", "", strip(expr)).strip()

    def ev(n):
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.UnaryOp):
            return {ast.USub: operator.neg, ast.UAdd: operator.pos}[type(n.op)](
                ev(n.operand)
            )
        if isinstance(n, ast.BinOp):
            return {
                ast.Add: operator.add,
                ast.Sub: operator.sub,
                ast.Mult: operator.mul,
                ast.Div: operator.truediv,
            }[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.Name):
            k = n.id
            if k.startswith("c") and k[1:] in env(path):
                return calc(env(path)[k[1:]], path, stat)
            if re.fullmatch(
                "[sr](Intellect|Strength|Dexterity|Stamina|Will|AttackSpeed)", k
            ):
                return stat
            if re.fullmatch("[sr](Max)?(Life|Energy)", k):
                return 800 if "Energy" in k else 2000
            if k in ("true", "false"):
                return k == "true"
            raise ValueError(k)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name):
            k = n.func.id
            if k == "nt":
                return ev(n.args[0])
            args = [ev(a) for a in n.args]
            if k in ("max", "min"):
                return (max if k == "max" else min)(args)
            if re.fullmatch("(ability|damage)Scale(CustomLife|CustomEnergy)?", k):
                prefix = k.replace("Custom", "") + (
                    "Stat" if k.endswith("Scale") else ""
                )
                l, r = [float(sc.findtext(prefix + i)) for i in ("Left", "Right")]
                v, a, b = args[:3]
                result = max((v - l) * (b - a) / (r - l) + a, a)
                if len(args) == 3 or args[3]:
                    result = math.floor(result + 0.5)
                return result
        raise ValueError(expr)

    return ev(ast.parse(expr, mode="eval").body)


def convert(s):
    # Convert grouping and ternaries recursively, preserving comma-separated function arguments.
    stack = [[]]
    for tok in re.findall(r'"[^"]*"|[()]|[^()"?:,]+|[?:,]', s):
        if tok == "(":
            stack.append([])
        elif tok == ")":
            v = tern(stack.pop())
            stack[-1].append("(" + v + ")")
        else:
            stack[-1].append(tok)
    return tern(stack[0])


def tern(a):
    if "," in a:
        z = a.index(",")
        return tern(a[:z]) + "," + tern(a[z + 1 :])
    if "?" not in a:
        return "".join(a)
    q = a.index("?")
    level = 1
    for i in range(q + 1, len(a)):
        if a[i] == "?":
            level += 1
        if a[i] == ":":
            level -= 1
        if not level:
            return (
                "("
                + tern(a[q + 1 : i])
                + " if "
                + tern(a[:q])
                + " else "
                + tern(a[i + 1 :])
                + ")"
            )
    raise ValueError(a)


def object_value(node):
    """Resolve a formula member on its actual object, including chained applicators."""
    member = node.func if isinstance(node, ast.Call) else node
    if "objects" not in inputs:
        return inputs.get(ast.unparse(member), inputs.get(member.attr, 0))
    owner = ast.unparse(member.value)
    obj = inputs["objects"][owner]
    if isinstance(node, ast.Call):
        arguments = tuple(ast.unparse(arg) for arg in node.args)
        return obj[(member.attr, arguments)]
    return obj.get(member.attr, 0)


def fast(expr, path, i, stat):
    local = env(path)
    board = allids
    bought = flags

    def ev(n):
        if isinstance(n, ast.Constant):
            return n.value
        if isinstance(n, ast.IfExp):
            return ev(n.body if ev(n.test) else n.orelse)
        if isinstance(n, ast.Attribute):
            return object_value(n)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute):
            return object_value(n)
        if isinstance(n, ast.BoolOp):
            return (
                all(ev(x) for x in n.values)
                if isinstance(n.op, ast.And)
                else any(ev(x) for x in n.values)
            )
        if isinstance(n, ast.Compare):
            return {
                ast.Gt: operator.gt,
                ast.Lt: operator.lt,
                ast.Eq: operator.eq,
                ast.NotEq: operator.ne,
                ast.GtE: operator.ge,
                ast.LtE: operator.le,
            }[type(n.ops[0])](ev(n.left), ev(n.comparators[0]))
        if isinstance(n, ast.Name):
            if "objects" in inputs and re.fullmatch(r"[sr][A-Z]\w*", n.id):
                unit = inputs["objects"]["sender" if n.id[0] == "s" else "receiver"]
                if n.id[1:] in unit:
                    return unit[n.id[1:]]
            if n.id in inputs:
                return inputs[n.id]
            if n.id in ("GLOBAL", "UNIT", "pMisc"):
                return 0
            if n.id in ("cExplosionRange", "cA4_2_Power") and n.id[1:] not in local:
                return 0
            if n.id.startswith("c") and n.id[1:] in local:
                return fast(local[n.id[1:]], path, i, stat)
            if n.id == "mIsNight":
                return False
            if n.id == "sNaftaLevel":
                return 10
            return calc(n.id.replace("sBase", "s").replace("rBase", "r"), path, stat)
        if isinstance(n, ast.UnaryOp):
            return {ast.USub: operator.neg, ast.UAdd: operator.pos}[type(n.op)](
                ev(n.operand)
            )
        if isinstance(n, ast.BinOp):
            return {
                ast.Add: operator.add,
                ast.Sub: operator.sub,
                ast.Mult: operator.mul,
                ast.Div: operator.truediv,
            }[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name):
            k = n.func.id
            if k == "abilityScaleMaxLife":
                return calc(
                    "abilityScaleCustomLife(2000,"
                    + ",".join(str(ev(x)) for x in n.args)
                    + ")",
                    path,
                    stat,
                )
            if k == "s":
                return ev(n.args[1 if ev(n.args[0]) else 2])
            if k == "nt":
                return ev(n.args[0 if inputs.get("native", 1) else 1])
            a = [ev(v) for v in n.args]
            if k == "tal":
                return a[0] in bought
            if k in ("talconst", "talconstNoCheck", "stalconst"):
                if a[0] not in board or k != "talconstNoCheck" and a[0] not in bought:
                    return a[2] if len(a) == 3 else 0
                target = board[a[0]]
                return fast(env(target)[a[1]], target, i, stat)
            if k == "floor":
                return math.floor(a[0])
            if k == "f2l":
                return int(a[0])
            if k == "random":
                return inputs["roll"]
            if k == "round":
                return math.copysign(math.floor(abs(a[0]) + 0.5), a[0])
            return calc(k + "(" + ",".join(str(float(x)) for x in a) + ")", path, stat)
        raise ValueError(ast.dump(n))

    return ev(
        ast.parse(
            convert(
                re.sub(r"(?<=\d)[fF]\b", "", strip(expr))
                .replace("&&", " and ")
                .replace("||", " or ")
                .strip()
                .rstrip(";")
            ).strip(),
            mode="eval",
        ).body
    )


cases = json.loads(
    Path(__file__).with_name("state_timing_cases.json").read_text("utf8")
)
allids = {
    xml(cat[i]).findtext("persistentId"): cat[i]
    for i in {c["talent"] for c in cases} | {49}
}
inputs = {}
flags = set()


def expression(reference, ability):
    filename, number = reference.rsplit(":", 1)
    resource = (
        filename[5:]
        if filename.startswith("Data/")
        else (Path(ability).parent / filename).as_posix()
    )
    line = int(number)
    assert "<sString>" in lines(resource)[line - 1], reference
    return formula(resource, line)


@cache
def page_rows(page):
    return {r.split('"')[1]: r for r in rows.findall(page.read_text("utf8"))}


def verify(case):
    global inputs, flags
    talent = case["talent"]
    ability = cat[case.get("context", talent)]
    flags = set(case.get("learn", []))
    rid = case["row"]
    hero = page_rows(p / "heroes" / case["hero"])[rid]
    detail = page_rows(p / "talents" / f"{talent:04d}-talent.html")[rid]
    values = hero.split('class="values-cell">')[1].split("</td>")[0]
    assert values == detail.split('class="values-cell">')[1].split("</td>")[0]
    front, evidence = values.split('<details class="state-evidence">')
    assert evidence.startswith("<summary>结算细节与源码</summary>") and evidence.endswith("</details>"), rid
    assert re.findall(r"<dt>(.*?)</dt>", front) == ["状态来源", "取值时点", "数值算例"], rid
    facts = re.findall(r"<dd>(.*?)</dd>", front)
    assert len(facts) == 3 and all(facts) and case["example"] in text(facts[2]), rid
    assert 'href=' not in hero.split('<details class="state-evidence">')[0], rid
    assert '<a href=' in evidence and case["page"] in text(evidence), rid
    if "delay_notification" in case:
        assert case["delay_notification"] in text(evidence) and case["delay_notification"] not in text(front), rid
    if "program_wait" in case:
        assert case["program_wait"] in text(values), rid
    if "nested_program" in case:
        assert case["nested_program"] in text(values), rid
    if "effect_order" in case:
        assert case["effect_order"] in text(values), rid
    if "dispatch_retry" in case:
        assert case["dispatch_retry"] in text(values), rid
    if "resurrection_step" in case:
        assert case["resurrection_step"] in text(values), rid
    if "resurrection" in case:
        assert case["resurrection"] in text(values), rid
    if "death_order" in case:
        assert case["death_order"] in text(values), rid
    if "cross_unit_step" in case:
        assert case["cross_unit_step"] in text(values), rid
    if "same_step" in case:
        assert case["same_step"] in text(values), rid
    if "conflict" in case:
        assert case["conflict"] in text(values), rid
    if "lifecycle" in case:
        assert case["lifecycle"] in text(values), rid
    assert case["page"] in text(values) and case["example"] in text(values), rid
    srcpath, line = src(hero)
    preview = formula(srcpath, line)
    consumer = expression(case["consumer"], ability) if "consumer" in case else preview
    fixed = case.get("fixed", {})
    stat = case.get("stat", 50)

    def check(value, expected, label):
        assert math.isclose(value, expected, abs_tol=1e-6), (
            rid,
            label,
            value,
            expected,
        )

    for values, test_stat, learned, expected in case["baseline"]:
        inputs, flags = values, set(learned)
        check(fast(preview, cat[talent], talent, test_stat), expected, "baseline")
    flags = set(case.get("learn", []))
    for before, during, after in [(0, 1, 0), (1, 0, 1), (0, 1, 1), (1, 0, 0)]:
        # The effect begins in the cast state. Change the live input again before the later read.
        def state(index):
            return {**fixed, case["variable"]: case["states"][index]}

        inputs = state(before)
        check(
            fast(preview, cat[talent], talent, stat), case["preview"][before], "preview"
        )
        inputs = state(during)
        check(
            fast(preview, cat[talent], talent, stat),
            case["preview"][during],
            "updated field",
        )
        phase = case["phase"]
        if "modifier" in case:
            path = (
                case["modifier"][5:]
                if case["modifier"].startswith("Data/")
                else (Path(ability).parent / case["modifier"]).as_posix()
            )
            mod = next(
                el
                for el in xml(path).iter()
                if el.find("dontUpdate") is not None
                and consumer
                in [node.text.strip() for node in el.iter("sString") if node.text]
            )
            phase = "start" if mod.findtext("dontUpdate") == "true" else "event"
        if phase in ("start", "cast"):
            captured = fast(consumer, ability, talent, stat)
        if phase == "saved":
            saved = fast(expression(case["writer"], ability), ability, talent, stat)
            inputs = {**state(after), case["save"]: saved}
        else:
            inputs = state(after)
        # Cast costs/ranges are queried on use. Buff lifetimes and fixed modifiers keep their initial value.
        value = (
            captured
            if phase in ("start", "cast")
            else fast(consumer, ability, talent, stat)
        )
        if case["variable"] == "vWitch_AutoAttackManaCost":
            mod = xml("Items/Talents/Class/Witch/status_A3_BuffAA.APLR.xdb").find(
                ".//AbilityModApplicator"
            )
            assert (
                mod.findtext("mode") == "manacost"
                and mod.findtext("targetAbilities") == "1"
            )
            raw = xml("Heroes/Witch/_.HROB.xdb").find(".//BaseAttack/manaCost/sString")
            value += float(raw.text) * float(
                mod.findtext("multValue/sString").removesuffix("f")
            )
        expected = case.get("actual", case["preview"])
        check(value, expected[after if case["phase"] == "event" else during], "effect")


# Engine contracts that determine when the XML expressions above are read.
def ordered(filename, *fragments):
    source = (original / "Src/PF_GameLogic" / filename).read_text(
        "utf8", errors="replace"
    )
    pos = 0
    for fragment in fragments:
        pos = source.index(fragment, pos) + len(fragment)


ordered(
    "PFAbilityInstance.cpp",
    "RecalculateAndRestartCooldown();",
    "dispatch.Start();",
    "pAbilityData->SpendMana();",
)
ordered(
    "PFAbilityData.cpp",
    "pOwner->TakeMana( GetManaCost() );",
    "return value * modifiers[mode].mul + modifiers[mode].add;",
    "pDBDesc->manaCost( pOwner, pOwner",
    "manaCost = GetModifiedValue( GetBaseManaCost()",
)
ordered(
    "PFAbilityData.cpp",
    "pDBDesc->useRange(pOwner, pOwner",
    "pDBDesc->useRange(pOwner, pTarget",
    "pDBDesc->useRange(pOwner, targetUnit",
)
ordered(
    "PFApplBuff.cpp",
    "lifeTime = RetrieveParam(GetDBAppl<NDb::BuffApplicator>().lifeTime",
    "duration = GetModifiedDuration(lifeTime)",
)
ordered(
    "PFApplMod.cpp",
    "if ( GetDB().dontUpdate )",
    "add = RetrieveParam(GetDB().modifier.addValue)",
    "if ( !GetDB().dontUpdate )",
    "add = RetrieveParam(GetDB().modifier.addValue)",
)
ordered(
    "PFTriggerApplicator.cpp",
    "useAbilityOwnerMana && !pAbilityData->IsEnoughMana()",
    "eventProcessor->ProcessEvent",
    "if (GetDB().useAbilityOwnerMana)",
    "pAbilityData->SpendMana()",
)
ordered("DBAbility.h", "BASEUNITEVENT_ATTACK = 4,")
witch = xml("Heroes/Witch/_.HROB.xdb")
assert any(
    trigger.findtext("useAbilityOwnerMana") == "true"
    and trigger.findtext(".//events") == "16"
    for trigger in witch.iter("TriggerApplicator")
)


# Field queries and effect selectors can legitimately return different numbers.
def verify_effect_boundaries():
    global inputs, flags
    flags = set()
    ability = cat[85]
    refund = expression("Ability_A3.TALENT.xdb:297", ability)
    # Start with two shields and no song. One shield survives until the refund.
    inputs = {"GetVariable": 2, "vA4_2_Active": 0}
    assert fast(refund, ability, 85, 50) == 72
    inputs = {"GetVariable": 1, "vA4_2_Active": 1}
    assert fast(refund, ability, 85, 50) == 54
    inputs["GetVariable"] = 0
    assert fast(refund, ability, 85, 50) == 0

    for talent, selector, expected in [
        (44, "Ability_A2.TALENT.xdb:96", 11),
        (255, "Ability_A2.TALENT.xdb:139", 11),
        (259, "A0_BigFormProgramm.APLR.xdb:416", 7),
        (260, "A0_BigFormProgramm.APLR.xdb:494", 7),
    ]:
        # Once this effect branch is reached, selection has its own range field.
        ability = cat[talent]
        inputs = {"vBigForm": 0, "applArtist_A4_status": 0}
        assert fast(expression(selector, ability), ability, talent, 50) == expected

    ability = cat[608]
    distance = xml(ability).findtext("useRange/sString")
    # No-target query uses owner as receiver. Unit-target query uses the selected unit.
    for owner_mark, target_mark in [(0, 1), (1, 0)]:
        inputs = {"FindApplicator": owner_mark}
        assert fast(distance, ability, 608, 50) == (0 if owner_mark else 23)
        inputs = {"FindApplicator": target_mark}
        assert fast(distance, ability, 608, 50) == (0 if target_mark else 23)


verify_effect_boundaries()
assert len(cases) == len({c["row"] for c in cases}) == 74
for case in cases:
    try:
        verify(case)
    except Exception as error:
        raise RuntimeError(f"{case['hero']} / {case['row']}") from error
print(
    f"PASS {len(cases)} rows, {sum(len(c['baseline']) for c in cases)} baseline cases, {4 * len(cases)} timing scenarios on both page types"
)

# The tooltip resolver aliases the two units. A target-specific query or an effect
# instead supplies its own receiver; changing the cursor never retargets an existing buff.
ordered(
    "PFAbilityDataNamemaps.cpp",
    "pOwner( pAbility->GetOwner() )",
    "return pOwner->GetVariable(name)",
    "CalcParam(name, this, this, this)",
    "formula( &context, &context, &context",
    "pAbility, pConst->var",
)
ordered(
    "PFApplicator.cpp", "return par(GetAbilityOwner(), pReceiver, this, defaultValue)"
)
METHOD_KEYS = {
    "FindApplicator": ("FindApplicator", ("'RiflemanA0Mark'", "pMisc", "GLOBAL")),
    "CountApplicators": (
        "CountApplicators",
        ("'Inventor_A2_MoreDetails'", "pMisc", "GLOBAL"),
    ),
    "applPantherTime": ("applPantherTime", ("UNIT",)),
    "applArtist_A4_status": ("applArtist_A4_status", ("UNIT",)),
}


def formula_unit(case, state, stat):
    key = case["variable"]
    unit = {
        name: stat
        for name in (
            "Strength",
            "Intellect",
            "Dexterity",
            "BaseStrength",
            "BaseIntellect",
            "BaseDexterity",
        )
    }
    if key.startswith("s") and key[1].isupper():
        key = key[1:]
    unit[METHOD_KEYS.get(key, key)] = case["states"][state]
    return unit


def verify_actor_pair(case, owner_index):
    global inputs, flags
    talent = case["talent"]
    path = cat[talent]
    runtime = cat[case.get("context", talent)]
    flags = set(case.get("learn", []))
    row = page_rows(p / "heroes" / case["hero"])[case["row"]]
    field = formula(*src(row))
    consumer = expression(case["consumer"], runtime) if "consumer" in case else field
    stat = case.get("stat", 50)
    caster = formula_unit(case, owner_index, stat)
    fixed = dict(case.get("fixed", {}))
    # Prefix-bearing stats and faction refer to the role in the expression.
    caster.update(
        {key[1:]: value for key, value in fixed.items() if key.startswith("s")}
    )
    caster["vHatred"] = fixed.get("vHatred", 0)
    inputs = {
        "objects": {"sender": caster, "receiver": caster},
        "native": case["states"][owner_index] if case["variable"] == "native" else 1,
    }
    if "roll" in fixed:
        inputs["roll"] = fixed["roll"]

    def check(calculated, expected, stage):
        assert math.isclose(calculated, expected, abs_tol=1e-6), (
            case["row"],
            owner_index,
            stage,
            calculated,
            expected,
        )

    check(
        fast(field, path, talent, stat), case["preview"][owner_index], "owner preview"
    )
    # Bind each unit independently. For a self passive the effective receiver stays the owner.
    for target_index in (owner_index, 1 - owner_index):
        target = formula_unit(case, target_index, 258)
        target["Fctn"] = caster.get("Fctn", 1)
        target["vHatred"] = fixed.get("vHatred", 0)
        objects = inputs["objects"]
        objects["receiver"] = target
        objects["appl.parent"] = {
            "Dist2Target": 10,
            ("GetVariable", ("'rawDamage'",)): 10000,
        }
        objects["sender.applBard_ShieldsCounter(UNIT)"] = {
            ("GetVariable", ("'targetsCount'",)): 2
        }
        receiver_field = case["variable"] in (
            "FindApplicator",
            "vHealer_A5_SpellShieldCounter",
            "vCreateFromTerrain",
            "vShadow_Enrage",
        )
        field_index = target_index if receiver_field else owner_index
        check(
            fast(field, path, talent, stat),
            case["preview"][field_index],
            "field with separate receiver",
        )
        effect_index = field_index
        if case["variable"] == "vShadow_Enrage":
            objects["receiver"] = caster
            effect_index = owner_index
        if "writer" in case:
            saved = fast(expression(case["writer"], runtime), runtime, talent, stat)
            if case["save"] == "vBardStacks_A4Start":
                objects["appl.parent.oTarget"] = {case["save"]: saved}
                # Conflicting values on both other actors must have no effect.
                caster[case["save"]] = 17
                target[case["save"]] = 13
            else:
                caster[case["save"]] = saved
                target[case["save"]] = 1 - saved
        check(
            fast(consumer, runtime, talent, stat),
            case.get("actual", case["preview"])[effect_index],
            "effective receiver",
        )


for case in cases:
    for owner_index in (0, 1):
        verify_actor_pair(case, owner_index)
print(f"PASS {len(cases) * 2} owner/target switch scenarios")


def verify_fairy_targets():
    global inputs, flags
    flags = set()
    fairy = "Items/Talents/Class/Fairy/"
    effect = xml(fairy + "status_A1u_IncDexAttS.APLR.xdb")
    modifiers = effect.findall(".//StatModApplicator")
    caster = {
        "Fctn": 1,
        "vFairyUltOn": 1,
        "Strength": 50,
        "Intellect": 50,
        "BaseIntellect": 50,
    }
    for faction, dex, speed, attribute, amount in [
        (1, 80, 80, "Dexterity", 5),
        (2, 40, 80, "AttackSpeed", -5),
        (2, 100, 80, "Dexterity", -5),
        (1, 40, 80, "AttackSpeed", 5),
    ]:
        inputs = {
            "objects": {
                "sender": caster,
                "receiver": {
                    "Fctn": faction,
                    "BaseDexterity": dex,
                    "BaseAttackSpeed": speed,
                    "vFairyUltOn": 0,
                    "BaseIntellect": 258,
                },
            }
        }
        active = [
            m
            for m in modifiers
            if fast(m.findtext("enabled/sString"), cat[212], 212, 50)
        ]
        assert len(active) == 1 and active[0].findtext("modifier/stat") == attribute
        assert (
            fast(active[0].findtext("modifier/addValue/sString"), cat[212], 212, 50)
            == amount
        )
        assert (
            fast(
                expression("status_A2_ChengeRegen.APLR.xdb:31", cat[214]),
                cat[214],
                214,
                50,
            )
            == amount
        )
    for ability, item in [
        (cat[212], "status_A1u_IncDexAttS"),
        (cat[214], "status_A2u_IncReg"),
        (fairy + "status_A2u_IncReg.APLR.xdb", "status_A2_ChengeRegen"),
    ]:
        assert any(
            el.get("href") == "/" + fairy + item + ".APLR" for el in xml(ability).iter()
        )


verify_fairy_targets()
ordered(
    "PFAbilityData.cpp",
    "new PFAbilityInstance( this, Target( pOwner ), true )",
    "pPassiveInstance->ApplyPassive()",
)
assert (
    xml(cat[630])
    .find("passiveApplicators/Item")
    .get("href")
    .endswith("/status_A2.APLR")
)
assert env(cat[340])["StatusTT_EffectCounter"].strip() == "1.0f"
coverage = json.loads((p / "data/coverage-manifest.json").read_bytes())["counts"][
    "state_formula_regression"
]
assert coverage["actor_switch_scenarios"] == len(cases) * 2
print("PASS faction, target-stat selection, passive owner and coverage checks")


def verify_summon_and_target_switch():
    global inputs, flags
    flags = set()
    caster = {"Strength": 84, "Intellect": 84}
    ordinary_wolf = {"vCreateFromTerrain": 0}
    adult_wolf = {"vCreateFromTerrain": 1}
    path = cat[485]
    wolf_preview = env(path)["WolfAttack_TT"]
    connected = expression(
        "Data/Heroes/DefaultStatus/_MasterStatConnect_Strength.APLR.xdb:40", path
    )
    for selected, other in [(ordinary_wolf, adult_wolf), (adult_wolf, ordinary_wolf)]:
        # The selected unit is distinct from the pet receiving the existing modifier.
        objects = {"sender": caster, "receiver": caster, "selected": selected}
        inputs = {"objects": objects}
        assert fast(wolf_preview, path, 485, 84) == 21
        objects["receiver"] = adult_wolf
        assert fast(connected, path, 485, 84) == 26
        objects["selected"] = other
        assert fast(connected, path, 485, 84) == 26
        objects["receiver"] = ordinary_wolf
        assert fast(connected, path, 485, 84) == 20


verify_summon_and_target_switch()


def evaluate_lifecycle(case, state, runtime=False, learned=(), expr=None, context=None):
    global inputs, flags
    inputs, flags = state, set(learned)
    talent = case["talent"]
    path = context or cat[case.get("context", talent) if runtime else talent]
    if expr is None:
        if runtime:
            expr = expression(case["consumer"], path)
        else:
            row = page_rows(p / "heroes" / case["hero"])[case["row"]]
            expr = formula(*src(row))
    return fast(expr, path, talent, case.get("stat", 50))


lifecycle_rows, lifecycle_checks = verify_status_lifecycle(
    cases, evaluate_lifecycle, xml, cat, ordered
)


assert lifecycle_rows == {j for j, c in enumerate(cases, 1) if "lifecycle" in c}
assert len(lifecycle_rows) == coverage["status_lifecycle_rows"]
assert lifecycle_checks == coverage["status_lifecycle_formula_checks"]
print(f"PASS {len(lifecycle_rows)} lifecycle rows, {lifecycle_checks} formula checks")

conflict_rows, conflict_checks = verify_status_conflicts(
    cases, evaluate_lifecycle, xml, ordered
)
assert (
    conflict_rows
    == lifecycle_rows
    == {j for j, c in enumerate(cases, 1) if "conflict" in c}
)
assert len(conflict_rows) == coverage["status_conflict_rows"]
assert conflict_checks == coverage["status_conflict_formula_checks"]
print(
    f"PASS {len(conflict_rows)} conflict formula rows, {conflict_checks} formula checks"
)

same_step_rows, same_step_checks = verify_same_step(
    cases, evaluate_lifecycle, xml, cat, ordered
)
assert (
    same_step_rows
    == conflict_rows
    == {j for j, c in enumerate(cases, 1) if "same_step" in c}
)
assert len(same_step_rows) == coverage["same_step_rows"]
assert same_step_checks == coverage["same_step_formula_checks"]
print(f"PASS {len(same_step_rows)} same-step rows, {same_step_checks} formula checks")

cross_rows, cross_checks = verify_cross_unit_step(
    cases, evaluate_lifecycle, xml, cat, ordered
)
assert (
    cross_rows
    == same_step_rows
    == {j for j, c in enumerate(cases, 1) if "cross_unit_step" in c}
)
assert len(cross_rows) == coverage["cross_unit_step_rows"]
assert cross_checks == coverage["cross_unit_step_formula_checks"]
print(f"PASS {len(cross_rows)} cross-unit rows, {cross_checks} formula checks")

death_rows, death_checks = verify_death_order(cases, evaluate_lifecycle, xml, ordered)
assert death_rows == cross_rows == {j for j, c in enumerate(cases, 1) if "death_order" in c}
assert len(death_rows) == coverage["death_order_rows"]
assert death_checks == coverage["death_order_formula_checks"], death_checks
print(f"PASS {len(death_rows)} death/unsummon rows, {death_checks} formula checks")

resurrected, resurrection_checks = verify_resurrection(cases, evaluate_lifecycle, xml, cat, ordered)
assert resurrected == death_rows == {j for j, c in enumerate(cases, 1) if "resurrection" in c}
assert len(resurrected) == coverage["resurrection_rows"]
assert resurrection_checks == coverage["resurrection_formula_checks"], resurrection_checks
print(f"PASS {len(resurrected)} resurrection rows, {resurrection_checks} formula checks")

frame_rows, frame_checks = verify_resurrection_step(cases, evaluate_lifecycle, xml, cat, ordered)
assert frame_rows == resurrected == {j for j, c in enumerate(cases, 1) if "resurrection_step" in c}
assert len(frame_rows) == coverage["resurrection_step_rows"]
assert frame_checks == coverage["resurrection_step_formula_checks"]
print(f"PASS {len(frame_rows)} resurrection-step rows, {frame_checks} formula checks")

retry_rows, retry_checks = verify_dispatch_retry(cases, evaluate_lifecycle, xml, ordered)
assert retry_rows == frame_rows == {j for j, c in enumerate(cases, 1) if "dispatch_retry" in c}
assert len(retry_rows) == coverage["dispatch_retry_rows"]
assert retry_checks == coverage["dispatch_retry_formula_checks"]
print(f"PASS {len(retry_rows)} dispatch-retry rows, {retry_checks} formula checks")

effect_rows, effect_checks = verify_effect_order(cases,evaluate_lifecycle,xml,ordered)
assert effect_rows == retry_rows == {j for j, c in enumerate(cases, 1) if "effect_order" in c}
assert len(effect_rows) == coverage["effect_order_rows"]
assert effect_checks == coverage["effect_order_formula_checks"]
print(f"PASS {len(effect_rows)} multi-effect rows, {effect_checks} formula checks")

nested_rows, nested_checks = verify_nested_program(cases,evaluate_lifecycle,xml,ordered)
assert nested_rows == effect_rows == {j for j, c in enumerate(cases, 1) if "nested_program" in c}
assert len(nested_rows) == coverage["nested_program_rows"]
assert nested_checks == coverage["nested_program_formula_checks"]
print(f"PASS {len(nested_rows)} nested-program rows, {nested_checks} formula checks")

wait_rows, wait_checks = verify_program_wait(cases,evaluate_lifecycle,xml,ordered)
assert wait_rows == nested_rows == {j for j, c in enumerate(cases, 1) if "program_wait" in c}
assert len(wait_rows) == coverage["program_wait_rows"]
assert wait_checks == coverage["program_wait_formula_checks"]
print(f"PASS {len(wait_rows)} program-wait rows, {wait_checks} formula checks")

delay_rows, delay_checks = verify_delay_notification(cases,evaluate_lifecycle,xml,ordered)
assert delay_rows == wait_rows == {j for j, c in enumerate(cases, 1) if "delay_notification" in c}
assert len(delay_rows) == coverage["delay_notification_rows"]
assert delay_checks == coverage["delay_notification_formula_checks"]
print(f"PASS {len(delay_rows)} delay/notification rows, {delay_checks} formula checks")

if options.native:
    import subprocess
    import sys

    subprocess.run(
        [
            sys.executable,
            str(p / coverage["status_conflict_native_probe"]),
            str(original),
        ],
        check=True,
    )
