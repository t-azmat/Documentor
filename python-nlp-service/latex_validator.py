"""
LaTeX Validator & Auto-Repairer  —  Stage 5 of the Stateful AI Formatter Pipeline

validate(snippet)  → {'valid': bool, 'issues': [str]}
auto_repair(snippet) → (repaired_str, repairs_made: [str])
missing_cites(snippet, bib_keys) → [str]  (keys not in bib)
"""

import re
from typing import Dict, List, Set, Tuple


class LaTeXValidator:
    """
    Fast, deterministic validation and repair of individual LaTeX snippets.
    No external dependencies. Runs after every chunk in Stage 5.
    """

    def validate(self, snippet: str) -> Dict:
        """
        Check snippet for structural problems.

        Returns
        -------
        {'valid': bool, 'issues': [str]}
        """
        issues: List[str] = []

        # 1. Brace balance
        opens  = snippet.count('{')
        closes = snippet.count('}')
        if opens != closes:
            issues.append(
                f"Unbalanced braces: {opens} open, {closes} close"
            )

        # 2. \\begin / \\end environment matching
        begins = re.findall(r'\\begin\{([^}]+)\}', snippet)
        ends   = re.findall(r'\\end\{([^}]+)\}', snippet)
        if begins != ends:
            issues.append(
                f"Environment mismatch — begin: {begins}  end: {ends}"
            )

        # 3. Unclosed inline math (odd number of bare $)
        dollar_count = len(re.findall(r'(?<!\\)\$', snippet))
        if dollar_count % 2 != 0:
            issues.append("Unclosed inline math: odd number of $ signs")

        # 4. Empty \\cite{}
        if re.search(r'\\cite[a-z]*\{\s*\}', snippet):
            issues.append("Empty \\cite{} command")

        return {'valid': len(issues) == 0, 'issues': issues}

    # ------------------------------------------------------------------

    def auto_repair(self, snippet: str) -> Tuple[str, List[str]]:
        """
        Apply deterministic structural repairs.

        Returns
        -------
        (repaired_snippet, list_of_repair_descriptions)
        """
        repairs: List[str] = []

        # 1. Brace balance
        opens  = snippet.count('{')
        closes = snippet.count('}')
        if opens > closes:
            diff    = opens - closes
            snippet = snippet + ('}' * diff)
            repairs.append(f"Appended {diff} missing '}}'")
        elif closes > opens:
            extra = closes - opens
            for _ in range(extra):
                idx = snippet.rfind('}')
                if idx >= 0:
                    snippet = snippet[:idx] + snippet[idx + 1:]
            repairs.append(f"Removed {extra} surplus '}}'")

        # 2. Remove orphaned \\end{env} (no matching \\begin)
        begins = re.findall(r'\\begin\{([^}]+)\}', snippet)
        ends   = re.findall(r'\\end\{([^}]+)\}', snippet)
        begin_counts: Dict[str, int] = {}
        for e in begins:
            begin_counts[e] = begin_counts.get(e, 0) + 1
        end_counts: Dict[str, int] = {}
        for e in ends:
            end_counts[e] = end_counts.get(e, 0) + 1

        for env, cnt in end_counts.items():
            extra_ends = cnt - begin_counts.get(env, 0)
            for _ in range(extra_ends):
                snippet = re.sub(
                    r'\\end\{' + re.escape(env) + r'\}',
                    '', snippet, count=1
                )
                repairs.append(f"Removed orphaned \\\\end{{{env}}}")

        # 3. Close unclosed math
        dollar_count = len(re.findall(r'(?<!\\)\$', snippet))
        if dollar_count % 2 != 0:
            snippet = snippet + '$'
            repairs.append("Appended $ to close unclosed math mode")

        # 4. Strip empty \\cite{}
        before = snippet
        snippet = re.sub(r'\\cite[a-z]*\{\s*\}', '', snippet)
        if snippet != before:
            repairs.append("Removed empty \\cite{} commands")

        return snippet, repairs

    # ------------------------------------------------------------------

    def missing_cites(self, snippet: str, bib_keys: Set[str]) -> List[str]:
        """
        Return cite keys referenced in the snippet that are absent from bib_keys.
        Handles multi-key \\cite{a,b,c} as well as \\parencite etc.
        """
        cited_groups = re.findall(r'\\cite[a-z]*\{([^}]+)\}', snippet)
        missing: List[str] = []
        seen: Set[str] = set()
        for group in cited_groups:
            for key in re.split(r'[,\s]+', group):
                key = key.strip()
                if key and key not in bib_keys and key not in seen:
                    missing.append(key)
                    seen.add(key)
        return missing

    # ------------------------------------------------------------------

    def validate_and_repair(
        self,
        snippet: str,
        bib_keys: Set[str],
    ) -> Tuple[str, Dict]:
        """
        Convenience: validate → auto_repair → re-validate.

        Returns
        -------
        (final_snippet, report_dict)
        """
        first = self.validate(snippet)
        repairs_made: List[str] = []

        if not first['valid']:
            snippet, repairs_made = self.auto_repair(snippet)

        second    = self.validate(snippet)
        missing   = self.missing_cites(snippet, bib_keys)

        return snippet, {
            'initially_valid': first['valid'],
            'initial_issues':  first['issues'],
            'repairs_applied': repairs_made,
            'still_invalid':   not second['valid'],
            'remaining_issues': second['issues'],
            'missing_cite_keys': missing,
        }
