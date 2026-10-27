"""Scan every document under a folder for handling markings and print a short summary.

Usage: python3 -I scan_markings.py <folder>
"""
import os
import re
import sys
import zipfile

from pypdf import PdfReader

MARKINGS = [
    r"\bCUI\b", r"CONTROLLED UNCLASSIFIED", r"FOR OFFICIAL USE ONLY", r"\bFOUO\b",
    r"DISTRIBUTION RESTRICTION", r"DISTRIBUTION STATEMENT [A-F]", r"DISTRIBUTION:? *[B-F]\b",
    r"LIMITED DISTRIBUTION", r"\bLIMDIS\b", r"NOT FOR PUBLIC RELEASE", r"\bNOFORN\b",
    r"\bSECRET\b", r"\bCONFIDENTIAL\b", r"\bUNCLASSIFIED\b", r"APPROVED FOR PUBLIC RELEASE",
    r"PRIVACY ACT", r"\bPII\b",
]
PAT = re.compile("|".join(MARKINGS), re.I)


def pdf_text(path):
    r = PdfReader(path)
    n = len(r.pages)
    idx = sorted(set([i for i in (0, 1, 2, 3) if i < n] + ([n - 1] if n else [])))
    out = []
    for i in idx:
        try:
            out.append(r.pages[i].extract_text() or "")
        except Exception as e:  # damaged page
            out.append("")
    title = ""
    try:
        title = (r.metadata or {}).get("/Title", "") or ""
    except Exception:
        pass
    return n, title, "\n".join(out)


def office_text(path):
    with zipfile.ZipFile(path) as z:
        parts = [n for n in z.namelist() if n.endswith(".xml") and ("word/" in n or "sharedStrings" in n or "worksheets/" in n)]
        xml = " ".join(z.read(n).decode("utf8", "ignore") for n in parts)
    return re.sub(r"<[^>]+>", " ", xml)


def main(root):
    for dirpath, _, files in os.walk(root):
        for f in sorted(files):
            if f.startswith(".") or "__MACOSX" in dirpath:
                continue
            p = os.path.join(dirpath, f)
            rel = os.path.relpath(p, root)
            try:
                if f.lower().endswith(".pdf"):
                    n, title, text = pdf_text(p)
                elif f.lower().endswith((".docx", ".xlsx")):
                    n, title, text = "-", "", office_text(p)
                else:
                    continue
            except Exception as e:
                print(f"## {rel}\n   ERROR {e}")
                continue
            hits = sorted(set(m.group(0).upper() for m in PAT.finditer(text)))
            first = " | ".join(l.strip() for l in text.splitlines() if l.strip())[:220]
            print(f"## {rel}\n   pages={n} title={title[:90]!r}\n   marks={hits}\n   start={first!r}")


if __name__ == "__main__":
    main(sys.argv[1])
