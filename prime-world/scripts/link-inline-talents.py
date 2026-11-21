"""Add original icons and tooltip links to unambiguous talent mentions.

Run from the site root: python scripts/link-inline-talents.py
"""
import csv
import re
from collections import Counter, defaultdict
from html import escape, unescape
from pathlib import Path

with Path("tables/talent-catalog.csv").open(encoding="utf-8-sig", newline="") as file:
    catalog = {f"{int(row['序号']):04}": row for row in csv.DictReader(file)}

def read(page):
    return page.read_bytes().decode("utf-8")

def owner(talent_id):
    parts = catalog[talent_id]["原版路径"].split("/")
    return parts[3] if parts[2] == "Class" else ""

by_name = defaultdict(list)
for talent_id, row in catalog.items():
    by_name[row["名称"]].append(talent_id)

detail_href = re.compile(r'(?:\.\./talents/)?(\d{4})-talent\.html')
icons = {}
for talent_id in catalog:
    page = Path(f"talents/{talent_id}-talent.html")
    for tag in re.findall(r"<img\b[^>]*>", read(page)):
        if f'data-pw-tooltip="talents/{page.name}"' in tag:
            icon = re.search(r'\bsrc="(\.\./assets/talents/[^"]+)"', tag)
            if icon and (page.parent / icon[1]).is_file():
                icons[talent_id] = icon[1]
                break

quoted = r'「([^「」]+)」|『([^『』]+)』|“([^“”]+)”|《([^《》]+)》'
action = r'激活|学会|习得|点亮|已学|学习|施放|释放|使用|装备|携带|强化|命中|施展|触发'
prose = re.compile(r'<(?P<tag>p|li)\b(?P<attrs>[^>]*)>(?P<body>[^\s]?.*?)</(?P=tag)>', re.S)
tokens = re.compile(r'<a\b[^>]*>.*?</a>|<(code|script|style)\b[^>]*>.*?</\1>|<[^>]+>|[^<]+', re.S)
count = Counter()

def linked(talent_id, text, href=None):
    destination = href or f"../talents/{talent_id}-talent.html"
    return (
        f'<a class="pw-inline-talent" href="{destination}" '
        f'data-pw-tooltip="talents/{talent_id}-talent.html">'
        f'<img src="{icons[talent_id]}" width="22" height="22" alt="" loading="lazy">{text}</a>'
    )

def decorate(page, current, owners):
    source = read(page)
    article = re.search(r'<article\b[^>]*>.*?</article>', source, re.S)
    assert article, page
    local = {name: [i for i in ids if owner(i) in owners]
             for name, ids in by_name.items()}
    local = {name: ids for name, ids in local.items() if ids}
    def resolve(name):
        candidates = local.get(name, by_name.get(name, ()))
        return candidates[0] if len(candidates) == 1 else None
    names = [name for name in local if len(name) >= 2]
    # Bare names need an action cue, except names ending in distinctive punctuation.
    alternatives = "|".join(re.escape(name) for name in sorted(names, key=len, reverse=True))
    pattern = quoted
    if alternatives:
        pattern += rf'|({action})(\s*)({alternatives})(?![！!？?])'
        distinctive = [name for name in names if name.endswith(("！", "？"))]
        if distinctive:
            pattern += "|(" + "|".join(map(re.escape, sorted(distinctive, key=len, reverse=True))) + ")"
    mention = re.compile(pattern)

    def replace_text(match):
        groups = match.groups()
        title = next((g for g in groups[:4] if g is not None), None)
        prefix = ""
        if title is None:
            if len(groups) >= 7 and groups[6] is not None:
                prefix = groups[4] + groups[5]
                title = groups[6]
            else:
                title = groups[-1]
        i = resolve(unescape(title))
        if i is None or i == current or i not in icons:
            return match[0]
        count["mentions"] += 1
        return prefix + linked(i, escape(unescape(title)))

    def replace_token(match):
        token = match[0]
        if token.startswith("<a "):
            link = re.fullmatch(r'<a href="([^"]+)">([^<]+)</a>', token)
            if link:
                target = detail_href.fullmatch(link[1])
                if target and target[1] in icons and target[1] != current and unescape(link[2]) == catalog[target[1]]["名称"]:
                    count["links"] += 1
                    return linked(target[1], link[2], link[1])
            return token
        return token if token.startswith("<") else mention.sub(replace_text, token)

    def replace_prose(match):
        attrs, body = match["attrs"], match["body"]
        if "class=" in attrs or re.search(r'<(?:p|li|ul|ol|table)\b', body):
            return match[0]
        updated = tokens.sub(replace_token, body)
        return match[0].replace(body, updated, 1) if body else match[0]

    original = article[0]
    updated = prose.sub(replace_prose, original)
    if updated != original:
        page.write_bytes((source[:article.start()] + updated + source[article.end():]).encode("utf-8"))
        count["pages"] += 1

for page in sorted(Path("heroes").glob("*.html")):
    owners = {owner(i) for i in re.findall(r'data-pw-tooltip="talents/(\d{4})-talent\.html"', read(page))
              if i in catalog and owner(i)}
    decorate(page, None, owners)
for i in sorted(catalog):
    decorate(Path(f"talents/{i}-talent.html"), i, {owner(i)} - {""})

print(dict(count))
