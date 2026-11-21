"""Group hero skill cards using original XDB links and split talent parameter tables.

Run from the site root: python scripts/organize-talents.py PATH_TO_ORIGINAL_DATA
"""
import csv
import re
import sys
from collections import defaultdict
from html import escape, unescape
from pathlib import Path
from xml.etree import ElementTree

source = Path(sys.argv[1])
with Path("tables/talent-catalog.csv").open(encoding="utf-8-sig", newline="") as file:
    catalog = {int(row["序号"]): row for row in csv.DictReader(file)}

# Resources with absent prerequisite links but an explicit effect relationship.
overrides = {
    78: ("枯萎",), 80: ("灵感",), 235: ("烈焰风暴", "火焰旋涡"),
    262: ("我要防守！", "我要进攻！"), 304: ("少射而精准",),
    416: ("千刃之路", "孤刃之路"), 484: ("Ability0.TALENT",),
    572: ("机关剑刃",), 639: ("死灵秘术",), 678: ("连锁闪电",),
    717: ("永不满足的渴望",), 766: ("野兽诅咒", "惊骇嚎叫"),
}
card_pattern = re.compile(r'<section class="skill-card".*?</section>', re.S)
row_pattern = re.compile(r'<tr\b.*?</tr>', re.S)
relationships = {}
pending = {}

def key(path):
    return path.lstrip("/").lower().removesuffix(".xdb")

def read(path):
    return path.read_bytes().decode("utf-8")

def name(talent):
    return escape(catalog[talent]["名称"])

def talent_link(talent):
    return f'<a href="../talents/{talent:04}-talent.html">{name(talent)}</a>'

def cards_in(text):
    return {
        int(re.search(r'href="../talents/(\d+)-talent.html"', card)[1]): card
        for card in card_pattern.findall(text)
    }

def label(card, text):
    return re.sub(r'(?<=class="skill-kind">)[^<]+', text, card, count=1)

for page in sorted(Path("heroes").glob("*.html")):
    original = read(page)
    start = original.index('<h2 id="abilities">')
    end = original.index('<h2 id="boards">', start)
    section = original[start:end]
    if page.name == "31-iron-knight.html" or '<h2 id="upgrades">' not in section:
        continue
    core, upgrade_section = section.split('<h2 id="upgrades">', 1)
    base_cards = cards_in(core)
    upgrade_cards = cards_in(upgrade_section)
    cards = base_cards | upgrade_cards
    assert len(cards) == len(card_pattern.findall(section)), page
    path_ids = {key(catalog[i]["原版路径"]): i for i in cards}
    direct = {}
    for talent in upgrade_cards:
        config = ElementTree.parse(source / catalog[talent]["原版路径"]).getroot()
        refs = config.findall("./prerequisiteTalents/Item")
        direct[talent] = tuple(dict.fromkeys(
            path_ids[ref] for item in refs
            if (ref := key(item.attrib.get("href", ""))) in path_ids
        ))
        if talent in overrides and not direct[talent]:
            direct[talent] = tuple(
                i for i in cards if catalog[i]["名称"] in overrides[talent]
                or Path(catalog[i]["原版路径"]).stem in overrides[talent]
            )
            assert len(direct[talent]) == len(overrides[talent]), (page, talent)

    def roots(talent, seen=()):
        assert talent not in seen, (page, talent)
        return tuple(dict.fromkeys(
            root for parent in direct.get(talent, ())
            for root in roots(parent, seen + (talent,))
        )) if direct.get(talent) else (talent,)

    groups = defaultdict(list)
    for talent in cards:
        groups[roots(talent)].append(talent)

    def anchor(talent):
        return f"ability-talent-{talent:04}"

    jump_links = [f'<a href="#{anchor(roots_[0])}">{name(roots_[0])}</a>'
                  for roots_ in groups if len(roots_) == 1]
    blocks = [
        '<h2 id="abilities">专属技能与强化</h2>',
        '<p>每组先看基础天赋，再看强化点亮后的变化。具体生效条件写在对应天赋卡中。</p>',
        f'<p id="upgrades">{" · ".join(jump_links)}</p>',
        '<span class="pw-tooltip-hint">桌面端悬停技能图标，手机端长按图标，可查看天赋提示。</span>',
    ]
    for parents, members in groups.items():
        solo = len(parents) == 1
        base = parents[0]
        group_anchor = anchor(base) if solo else f"ability-shared-{members[0]:04}"
        title = name(base) if solo else "共享强化 · " + "／".join(map(name, parents))
        blocks.append(f'<h3 id="{group_anchor}">{title}</h3>')
        if solo:
            shared = [i for roots_, items in groups.items() if len(roots_) > 1
                      and base in roots_ for i in items]
            if shared:
                shared_links = " · ".join(talent_link(i) for i in shared)
                blocks.append(f'<p>也可受共享强化影响 {shared_links}</p>')
        for talent in members:
            card = cards[talent]
            if talent in parents:
                kind = "开局自动取得" if catalog[talent]["开局自动取得"] == "true" else "基础天赋"
            else:
                kind = "点亮后新增或改变"
                relationships[talent] = (parents, page.name, group_anchor)
            blocks.append(label(card, kind))
    pending[page] = original[:start] + "\n".join(blocks) + "\n" + original[end:]

def is_literal(row):
    code = re.search(r"<code[^>]*>(.*?)</code>", row, re.S)
    return bool(code and re.fullmatch(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)[fF]?", unescape(code[1]).strip()))

for page in sorted(Path("talents").glob("*.html")):
    original = read(page)
    heading = "<h3>具体参数与计算</h3>"
    if heading not in original:
        assert 'id="triggers"' in original, page
        continue
    start = original.index(heading)
    opening = start + len(heading)
    ending = "</tbody></table></div>"
    end = original.index(ending, opening) + len(ending)
    header, body = original[opening:end].split("<tbody>", 1)
    rows = row_pattern.findall(body)
    assert "".join(rows) == body.removesuffix(ending), page
    fixed = [row for row in rows if is_literal(row)]
    formulas = [row for row in rows if not is_literal(row)]
    talent = int(page.name.split("-")[0])
    relation = relationships.get(talent)
    effect = original.index('<div class="skill-effect">')
    trigger = '<h3 id="triggers">效果与触发条件</h3>'
    if relation:
        parents, hero, anchor_id = relation
        parent_links = "／".join(talent_link(p) for p in parents)
        trigger += (
            f'<p><strong>对应基础天赋</strong> {parent_links} · '
            f'<a href="../heroes/{hero}#{anchor_id}">查看英雄技能组</a></p>'
            '<h4>点亮强化后</h4>'
        )
    def table(title, id_, selected):
        return f'<h3 id="{id_}">{title}</h3>{header}<tbody>{"".join(selected)}{ending}' if selected else ""
    pending[page] = (
        original[:effect] + trigger + original[effect:start]
        + table("固定值", "fixed-values", fixed)
        + table("计算公式", "calculation-formulas", formulas)
        + original[end:]
    )

for page, contents in pending.items():
    page.write_bytes(contents.encode("utf-8"))
print(f"Updated {len(pending)} pages")
