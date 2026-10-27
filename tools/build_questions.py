"""Build public/js/questions.js and public/js/sources.js from content/raw/*.json.

Every question's quote is re-checked against the cited PDF page. Questions whose quote
can't be found on that page are left out and listed in content/needs-review.json.

Usage (from the bwc-app folder):
    python3 -I tools/build_questions.py "/path/to/TY27 BWC Source Docs"
"""
import glob
import json
import os
import re
import sys

from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TOPICS = None  # filled from config.js


def load_topics():
    cfg = open(os.path.join(ROOT, "public/js/config.js"), encoding="utf8").read()
    block = cfg.split("topics: [", 1)[1].split("],", 1)[0]
    return set(re.findall(r"id: '([a-z0-9-]+)'", block))


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("–", "-").replace("—", "-").replace("­", "")
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def find_file(docs, name):
    hits = glob.glob(os.path.join(docs, "*", name))
    return hits[0] if hits else None


_page_cache = {}


def page_text(path, page):
    key = (path, page)
    if key not in _page_cache:
        if path.endswith(".txt"):
            _page_cache[key] = open(path, encoding="utf8").read()
        else:
            r = PdfReader(path)
            _page_cache[key] = (r.pages[page - 1].extract_text() or "") if 0 < page <= len(r.pages) else ""
    return _page_cache[key]


def unshift(text):
    """Some Army PDFs (e.g. TC 3-23.35) store text with every character code shifted down by 29."""
    return "".join(chr(ord(c) + 29) if ord(c) < 98 else c for c in text)


def quote_ok(path, page, quote):
    q = norm(quote)
    if not q:
        return False
    # Allow a page either side: printed vs. PDF page numbering mistakes are common.
    for p in (page, page - 1, page + 1):
        try:
            raw = page_text(path, p)
        except Exception:
            continue
        for t in (norm(raw), norm(unshift(raw))):
            if q in t or (len(q) > 40 and q[:40] in t):
                return p
    return False


def sources_from(docs):
    """One entry per publication: title, official link when there is one, and the local file name."""
    links = json.load(open(os.path.join(HERE, "apd_links.json")))
    out = {}
    for folder in sorted(glob.glob(os.path.join(docs, "*"))):
        base = os.path.basename(folder)
        if base[:2] in ("00", "01", "90"):
            continue
        for f in sorted(os.listdir(folder)):
            if not f.lower().endswith((".pdf", ".txt")) or "(OCR text)" in f:
                continue
            stem = f.rsplit(".", 1)[0]
            pub, _, title = stem.partition(" - ")
            if pub == "MNNG Policy":
                pub, title = re.sub(r"\s*\([^)]*\)$", "", stem), "Minnesota National Guard policy memorandum"
            title = re.sub(r"\s*\((?:Govt Only|scanned)\)", "", title).strip()
            link = links.get(f)
            out[pub] = {
                "title": title,
                "file": f,
                "url": link[0] if link else None,
                "cac": bool(link and link[1] == "cac"),
                "note": None if link else "unit copy (not on the Army Publishing Directory)",
            }
    return out


def build_drills(docs):
    """content/raw/drills.json -> public/js/drills-data.js, keeping only items whose quote checks out."""
    src = os.path.join(ROOT, "content/raw/drills.json")
    out = {"sequences": [], "formats": [], "zero": {"facts": []}}
    dropped = []
    if os.path.exists(src):
        raw = json.load(open(src, encoding="utf8"))

        def ok(item):
            path = find_file(docs, item.get("file", "")) if item.get("file") else None
            if not path or not item.get("quote") or not item.get("page"):
                return False
            hit = quote_ok(path, int(item["page"]), item["quote"])
            if hit and hit != int(item["page"]):
                item["page"] = hit
            return bool(hit)

        keep = ("id", "group", "title", "prompt", "pub", "para", "page", "quote")
        for s in raw.get("sequences", []):
            if ok(s) and len(s.get("steps", [])) >= 3:
                out["sequences"].append(dict({k: s.get(k) for k in keep}, steps=s["steps"]))
            else:
                dropped.append(s.get("id"))
        for f in raw.get("formats", []):
            if ok(f) and len(f.get("items", [])) >= 3:
                out["formats"].append(dict({k: f.get(k) for k in keep}, items=f["items"]))
            else:
                dropped.append(f.get("id"))
        for z in (raw.get("zero") or {}).get("facts", []):
            if ok(z):
                out["zero"]["facts"].append({k: z.get(k) for k in ("fact", "value", "pub", "para", "page", "quote")})
            else:
                dropped.append("zero: " + str(z.get("fact"))[:40])
    with open(os.path.join(ROOT, "public/js/drills-data.js"), "w", encoding="utf8") as f:
        f.write("// Generated by tools/build_questions.py from content/raw/drills.json. Do not edit by hand.\n")
        f.write("window.BWC_DRILLS = " + json.dumps(out, indent=1, ensure_ascii=False) + ";\n")
    print("drills: %d sequences, %d formats, %d zero facts; dropped %s" % (
        len(out["sequences"]), len(out["formats"]), len(out["zero"]["facts"]), dropped or "none"))


def main(docs):
    topics = load_topics()
    raw = []
    for p in sorted(glob.glob(os.path.join(ROOT, "content/raw/*.json"))):
        raw.extend(json.load(open(p, encoding="utf8")))

    good, review, seen = [], [], set()
    for q in raw:
        problems = []
        for k in ("id", "topic", "q", "answer", "wrong", "pub", "page", "file", "quote"):
            if not q.get(k):
                problems.append("missing " + k)
        if q.get("topic") not in topics:
            problems.append("unknown topic " + str(q.get("topic")))
        wrong = q.get("wrong") or []
        if len(wrong) != 3 or len({w.strip().lower() for w in wrong} | {str(q.get("answer", "")).strip().lower()}) != 4:
            problems.append("needs 3 distinct wrong answers")
        if q.get("id") in seen:
            problems.append("duplicate id")
        path = find_file(docs, q.get("file", "")) if q.get("file") else None
        if q.get("file") == "MNNG Policy - Drug Testing (scanned).pdf":
            path = find_file(docs, "MNNG Policy - Drug Testing (OCR text).txt")
        if not path:
            problems.append("file not found: " + str(q.get("file")))
        elif not problems:
            hit = quote_ok(path, int(q["page"]), q["quote"])
            if not hit:
                problems.append("quote not found on page %s" % q["page"])
            elif hit != int(q["page"]):
                q["page"] = hit
        if problems:
            review.append({"id": q.get("id"), "q": q.get("q"), "problems": problems})
            continue
        seen.add(q["id"])
        good.append({k: q.get(k) for k in ("id", "topic", "level", "q", "answer", "wrong", "keywords", "pub", "para", "page", "quote", "why")})

    sources = sources_from(docs)
    for q in good:
        if q["pub"] not in sources:
            print("note: no source entry for", q["pub"])

    with open(os.path.join(ROOT, "public/js/questions.js"), "w", encoding="utf8") as f:
        f.write("// Generated by tools/build_questions.py from content/raw/*.json. Do not edit by hand.\n")
        f.write("// Every quote below was checked against the cited PDF page when this file was built.\n")
        f.write("window.BWC_QUESTIONS = " + json.dumps(good, indent=1, ensure_ascii=False) + ";\n")
    with open(os.path.join(ROOT, "public/js/sources.js"), "w", encoding="utf8") as f:
        f.write("// Generated by tools/build_questions.py. Publication number -> title and official link.\n")
        f.write("window.BWC_SOURCES = " + json.dumps(sources, indent=1, ensure_ascii=False) + ";\n")
    with open(os.path.join(ROOT, "content/needs-review.json"), "w", encoding="utf8") as f:
        json.dump(review, f, indent=1, ensure_ascii=False)

    build_drills(docs)

    by_topic = {}
    for q in good:
        by_topic[q["topic"]] = by_topic.get(q["topic"], 0) + 1
    print("built %d questions, %d need review" % (len(good), len(review)))
    for t in sorted(by_topic):
        print("  %-18s %d" % (t, by_topic[t]))
    for r in review:
        print("  REVIEW", r["id"], "-", "; ".join(r["problems"]))


if __name__ == "__main__":
    main(sys.argv[1])
