"""
Run: python diagnose_citation.py <path_to_your_document>

Shows exactly what the pipeline extracts from your file so we can
identify where citation matching breaks.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from file_extractor import FileExtractor
from citation import CitationManager, extract_references_section, match_citations_to_references

if len(sys.argv) < 2:
    print("Usage: python diagnose_citation.py <file.pdf|file.docx|file.txt>")
    sys.exit(1)

path = sys.argv[1]
with open(path, 'rb') as f:
    content = f.read()

extractor = FileExtractor()
result = extractor.extract_text(content, os.path.basename(path))
if not result['success']:
    print(f"EXTRACTION FAILED: {result['error']}")
    sys.exit(1)

text = result['text']
print(f"=== Extracted {len(text)} characters, {len(text.splitlines())} lines ===\n")

# Show last 3000 chars (where references usually live)
print("--- Last 3000 characters of extracted text ---")
print(text[-3000:])
print("\n" + "="*60 + "\n")

manager = CitationManager()
style = manager.detect_citation_style(text)
print(f"Detected citation style: {style}\n")

citations = manager.extract_citations_from_text(text)
print(f"=== Citations found: {len(citations)} ===")
for i, c in enumerate(citations[:30]):   # show first 30
    print(f"  [{i}] text={c['text']!r:20s}  style={c['style_type']:12s}  context={c['context'][:60]!r}")
if len(citations) > 30:
    print(f"  ... and {len(citations)-30} more")

print()
references, ref_start = extract_references_section(text)
print(f"=== References found: {len(references)}  (starting line {ref_start}) ===")
for i, r in enumerate(references[:20]):
    print(f"  [{i}] ref_number={str(r.get('ref_number','-')):4s}  text={r['text'][:80]!r}")
if len(references) > 20:
    print(f"  ... and {len(references)-20} more")

print()
if citations and references:
    mapping = match_citations_to_references(citations, references)
    print(f"=== Mapping: {len(mapping)}/{len(citations)} citations matched ===")
    for k, v in list(mapping.items())[:20]:
        ct = citations[k]['text']
        rt = references[v]['text'][:55] if v < len(references) else "???"
        extras = citations[k].get('extra_ref_indices', [])
        extra_str = f"  +extras={extras}" if extras else ""
        print(f"  cit[{k}] {ct!r:15s}  ->  ref[{v}] {rt!r}{extra_str}")
    unmatched = [i for i in range(len(citations)) if i not in mapping]
    if unmatched:
        print(f"\n  UNMATCHED citations ({len(unmatched)}):")
        for i in unmatched[:10]:
            print(f"    [{i}] {citations[i]['text']!r}  context={citations[i]['context'][:60]!r}")
else:
    print("No citations or references found — nothing to match.")
    if not citations:
        print("  HINT: No citations detected. Check if style matches (IEEE uses [1], APA uses (Author, Year))")
    if not references:
        print("  HINT: No reference section found. Headers checked: References, Bibliography, Works Cited, Reference List, Sources")
        print("  The actual header in your document may be different. Last 20 lines:")
        for ln in text.splitlines()[-20:]:
            print(f"    {ln!r}")
