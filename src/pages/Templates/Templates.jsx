import { useState } from 'react'
import { FaBook, FaFileAlt, FaDownload, FaEye, FaTimes, FaQuoteRight, FaListUl, FaFont, FaRuler, FaTag } from 'react-icons/fa'

const templates = [
  {
    id: 1,
    name: 'APA 7th Edition',
    style: 'APA',
    organization: 'American Psychological Association',
    description: 'Author-date citation system. Widely used in social sciences, psychology, education, and nursing.',
    color: '#3B82F6',
    badge: '7th ed.',
    sections: [
      {
        icon: 'typography',
        title: 'Typography & Spacing',
        rules: [
          'Font: Times New Roman 12 pt  OR  Calibri 11 pt  OR  Arial 11 pt (consistent throughout)',
          'Line spacing: Double-spaced throughout — including title page, abstract, body, references',
          'Paragraph indent: 0.5 in (first line) using Tab or indent setting — NOT spaces',
          'No extra blank lines between paragraphs',
          'Abstract: 150–250 words, single block, no indent on first line',
          'Keywords line: italicised "Keywords:" followed by comma-separated list',
        ],
      },
      {
        icon: 'margins',
        title: 'Page Setup & Margins',
        rules: [
          'Margins: 1 inch (2.54 cm) on ALL four sides',
          'Paper size: US Letter (8.5 × 11 in) or A4',
          'Page numbers: Top-right header, starting from page 1 (title page)',
          'Student papers: NO running head required (7th ed. change)',
          'Professional papers: Running head — shortened title ≤ 50 characters, ALL CAPS, top-left; page number top-right',
        ],
      },
      {
        icon: 'headings',
        title: 'Heading Levels',
        rules: [
          'Level 1 — Centred, Bold, Title Case',
          'Level 2 — Left-aligned, Bold, Title Case',
          'Level 3 — Left-aligned, Bold Italic, Title Case',
          'Level 4 — Indented (0.5 in), Bold, Title Case, ends with period. Text continues on same line.',
          'Level 5 — Indented (0.5 in), Bold Italic, Title Case, ends with period. Text continues on same line.',
          'Do not use "Introduction" as a heading — begin body text directly after abstract',
        ],
      },
      {
        icon: 'intext',
        title: 'In-Text Citations',
        rules: [
          'One author: (Smith, 2023)  or  Smith (2023) argues…',
          'Two authors: (Smith & Jones, 2023)',
          'Three or more authors: (Smith et al., 2023)',
          'Direct quote: (Smith, 2023, p. 45)  or  (Smith, 2023, pp. 45–46)',
          'No author: Use title (shortened, in quotation marks for article; italics for book) + year: ("Running Head," 2020)',
          'Multiple works same parenthesis: (Brown, 2019; Smith, 2023) — alphabetical order',
          'Same author multiple years: (Smith, 2019, 2021)',
          'Same author same year: (Smith, 2023a, 2023b)',
          'Secondary source: "as cited in" — cite the secondary source in reference list',
        ],
      },
      {
        icon: 'references',
        title: 'References Page',
        rules: [
          'New page, centred heading "References" (bold, not italicised)',
          'Hanging indent: 0.5 in (second and subsequent lines)',
          'Alphabetical by first author last name',
          'Double-spaced, no extra blank lines between entries',
          'DOI format: https://doi.org/xxxxx (hyperlinked, not underlined)',
          'URL: Retrieved from https://… — only if content may change; no retrieval date for stable content',
          'Journal article: Author, A. A., & Author, B. B. (Year). Title of article. Journal Name, volume(issue), page–page. https://doi.org/xxxxx',
          'Book: Author, A. A. (Year). Title of work: Capital letter also for subtitle. Publisher.',
          'Book chapter: Author, A. A. (Year). Title of chapter. In E. E. Editor (Ed.), Title of book (pp. xxx–xxx). Publisher.',
          'Website: Author, A. A. (Year, Month Day). Title of page. Site Name. URL',
        ],
      },
      {
        icon: 'examples',
        title: 'Formatted Examples',
        rules: [
          'Journal:  Grady, J. S., Her, M., Moreno, G., Perez, C., & Yelinek, J. (2019). Emotions in storybooks. Psychology of Popular Media Culture, 8(2), 207–217. https://doi.org/10.1037/ppm0000185',
          'Book:  Sapolsky, R. M. (2017). Behave: The biology of humans at our best and worst. Penguin Books.',
          'Website:  World Health Organization. (2018, March 22). Cancer. https://www.who.int/news-room/fact-sheets/detail/cancer',
          'In-text quote:  "The experiment confirmed a 12% increase" (Sapolsky, 2017, p. 102).',
        ],
      },
    ],
    downloadSample: `Title of Your Paper

Your Name
Department, University
Course Number: Course Name
Instructor Name
Due Date

Abstract

[150–250 words. No indent on first line. Keywords below.]

Keywords: keyword one, keyword two, keyword three

Introduction

[Begin text here — no "Introduction" heading required in APA.]

Method

Participants

[Describe participants...]

Procedure

[Describe procedure...]

Results

[Present results...]

Discussion

[Interpret results...]

References

Author, A. A. (Year). Title. Journal, vol(issue), pages. https://doi.org/xxxxx`,
  },

  {
    id: 2,
    name: 'MLA 9th Edition',
    style: 'MLA',
    organization: 'Modern Language Association',
    description: 'Parenthetical author-page citation. Standard in humanities, literature, languages, and cultural studies.',
    color: '#10B981',
    badge: '9th ed.',
    sections: [
      {
        icon: 'typography',
        title: 'Typography & Spacing',
        rules: [
          'Font: Times New Roman 12 pt (preferred); legible serif/sans-serif acceptable',
          'Line spacing: Double-spaced throughout — including Works Cited',
          'Paragraph indent: 0.5 in for first line of every paragraph',
          'No extra blank lines between paragraphs or between heading and text',
          'Long quotations (4+ prose lines / 3+ poetry lines): block quote, indented 0.5 in from left margin, no quotation marks, citation AFTER final punctuation',
        ],
      },
      {
        icon: 'margins',
        title: 'Page Setup & Margins',
        rules: [
          'Margins: 1 inch on ALL four sides',
          'NO separate title page (unless instructor requires one)',
          'Header block (top-left, before title): Student name / Instructor name / Course name / Date (format: Day Month Year, e.g. 15 March 2024)',
          'Title: Centred, Title Case, no bold/italic/underline, no quotation marks; NOT a heading level',
          'Header: Last Name + Space + Page number — top-right every page (e.g. Smith 3)',
          'Page number begins on first page',
        ],
      },
      {
        icon: 'headings',
        title: 'Headings (Optional)',
        rules: [
          'MLA allows but does not require section headings in papers',
          'If used — numbered or unnumbered, consistent size/format throughout',
          'Recommended: Level 1 — bold; Level 2 — italics; Level 3 — bold italics; Level 4 — underline',
          'Left-aligned; no period after heading',
          'Heading does not count as first sentence of following paragraph',
        ],
      },
      {
        icon: 'intext',
        title: 'In-Text Citations',
        rules: [
          'Author and page number (NO comma): (Smith 45) or (Smith 45–46)',
          'Author named in sentence: Smith argues that "…" (45).',
          'No author: Shortened title in quotation marks: ("Running Head" 12)',
          'Multiple authors: Two: (Smith and Jones 34); Three or more: (Smith et al. 34)',
          'Same author multiple works: (Smith, Hamlet 45) — use shortened title',
          'Indirect source: (qtd. in Smith 45)',
          'Electronic sources without page numbers: (Smith) — paragraph number if available: (Smith, par. 4)',
          'Verse: Line numbers instead of pages: (Milton 1.1–4)',
        ],
      },
      {
        icon: 'references',
        title: 'Works Cited Page',
        rules: [
          'Centred heading "Works Cited" — no bold, no italics, no quotation marks',
          'New page at end of paper',
          'Hanging indent: 0.5 in; double-spaced; no blank lines between entries',
          'Alphabetical by author last name; no author: alphabetise by title (ignore "A", "An", "The")',
          'MLA 9 "container" system: Core elements in order: Author. Title. Container, Other contributors, Version, Number, Publisher, Publication date, Location.',
          'Punctuate each element with a period or comma as specified',
          'Journal article: Author. "Article Title." Journal Name, vol. X, no. Y, Year, pp. Z–Z. DOI or URL.',
          'Book: Author. Book Title. Publisher, Year.',
          'Website: Author. "Page Title." Website Name, Day Month Year, URL.',
          'Accessed date: Only for time-sensitive or likely-to-change content: Accessed 15 Mar. 2024.',
        ],
      },
      {
        icon: 'examples',
        title: 'Formatted Examples',
        rules: [
          'Journal:  Piper, Andrew. "Sense and the Digital: Reading Literature with Computers." New Literary History, vol. 36, no. 1, 2005, pp. 141–158.',
          'Book:  Toni Morrison. Beloved. Vintage Books, 1987.',
          'Website:  Hollmichel, Stefanie. "The Reading Brain: Differences Between Digital and Print." So Many Books, 25 Apr. 2013, somanybooksblog.com/2013/04/25/the-reading-brain.',
          'In-text:  Morrison describes the house as a place of "spiteful" memory (3).',
        ],
      },
    ],
    downloadSample: `Student Name
Instructor Name
Course Name
15 March 2024

Title of Your Essay

[Begin text here. Indent each paragraph 0.5 in.]

[In-text example: According to Smith, "quoted material" (45).]

Works Cited

Author, Last. "Article Title." Journal, vol. X, no. Y, Year, pp. X–X.
Author, Last. Book Title. Publisher, Year.`,
  },

  {
    id: 3,
    name: 'IEEE Style',
    style: 'IEEE',
    organization: 'Institute of Electrical and Electronics Engineers',
    description: 'Numbered bracket citation system. Standard for engineering, computer science, and technical disciplines.',
    color: '#F59E0B',
    badge: 'Conference',
    sections: [
      {
        icon: 'typography',
        title: 'Typography & Spacing',
        rules: [
          'Font body: Times New Roman 10 pt',
          'Font headings: Section — Times New Roman 10 pt small caps; Subsection — italic 10 pt',
          'Spacing: Single-spaced body text',
          'Abstract: 9 pt, single paragraph, no indent. Begin with bold "Abstract—" (em dash, no space before text)',
          'Keywords: 9 pt, begin with italic "Index Terms—"',
          'Paper length: typically 6–8 pages for conference; 8–12 for journal',
        ],
      },
      {
        icon: 'margins',
        title: 'Page Setup & Columns',
        rules: [
          'Paper: US Letter (8.5 × 11 in)',
          'Margins: Top 0.75 in; Left 0.625 in; Right 0.625 in; Bottom 1 in',
          'Layout: TWO-COLUMN; column width ~3.5 in; gutter 0.25 in',
          'Title block: Single-column, centred; Authors block: centred, affiliations below names',
          'Page numbers: Centred at bottom (conference) or top-right (journal)',
          'No running head required for conference papers',
        ],
      },
      {
        icon: 'headings',
        title: 'Section Headings',
        rules: [
          'Section (Level 1): Roman numeral + period + Title IN SMALL CAPS, centred. Example:  I. INTRODUCTION',
          'Subsection (Level 2): Capital letter + period + Italic Title, left-aligned. Example:  A. System Architecture',
          'Sub-subsection (Level 3): Italic, indented, ends with period/colon, text continues on same line.',
          'Do NOT number abstract, acknowledgment, or references sections',
          'Sections are short Roman numerals: I, II, III…',
          'Authors listed with superscript affiliation numbers when multiple institutions',
        ],
      },
      {
        icon: 'intext',
        title: 'In-Text Citations',
        rules: [
          'Numbered brackets: [1], [2], [3] — assigned in ORDER OF FIRST APPEARANCE in text',
          'Multiple consecutive: [1]–[3] (en dash); non-consecutive: [1], [3], [5]',
          'Never write "Ref. [1]" as a subject — "in [1], Smith shows…" is acceptable',
          'Citation placed BEFORE punctuation: "…as shown in [2]." NOT "…as shown in." [2]',
          'Do not use author name in citation — just the number',
          'Repeat the same number if citing the same source again',
        ],
      },
      {
        icon: 'references',
        title: 'References Section',
        rules: [
          'Heading: "REFERENCES" (no numeral, no section marker)',
          'Number in square brackets: [1] flush left, hanging indent for subsequent lines',
          'Order: Strictly numerical (order of appearance in paper)',
          'Single-spaced within entry; no blank line between entries (or small space)',
          'Author initials first, then last name. Multiple: A. B. Smith and C. D. Jones  OR  A. B. Smith, C. D. Jones, and E. F. Brown',
          'Journal: [N] A. Author, "Title of paper," Abbrev. Journal, vol. X, no. Y, pp. Z1–Z2, Mon. Year, doi: 10.xxxx/xxxxx.',
          'Conference: [N] A. Author, "Title," in Proc. Conf. Name (ABBR), City, State, Year, pp. Z1–Z2.',
          'Book: [N] A. Author, Title of Book, Xth ed. City, State: Publisher, Year.',
          'Webpage: [N] A. Author, "Title," Website Name. Accessed: Mon. DD, YYYY. [Online]. Available: URL',
          'Abbreviate journal names per IEEE standard list',
        ],
      },
      {
        icon: 'examples',
        title: 'Formatted Examples',
        rules: [
          'Journal:  [1] G. Liu, K. Y. Lee, and H. M. Jordan, "TDM and FDM power systems," IEEE Trans. Power Syst., vol. 14, no. 2, pp. 472–480, May 1999.',
          'Conference:  [2] B. Smith and A. Jones, "Adaptive neural networks," in Proc. Int. Conf. Neural Netw. (ICNN), Houston, TX, USA, 1997, pp. 1542–1546.',
          'Book:  [3] S. M. Sze, Physics of Semiconductor Devices, 2nd ed. New York, NY: Wiley, 1981.',
          'In-text:  The results in [1] demonstrate a 15% improvement over the baseline [2], [3].',
        ],
      },
    ],
    downloadSample: `\\documentclass[10pt, conference]{IEEEtran}
\\usepackage{cite}
\\begin{document}

\\title{Paper Title}
\\author{\\IEEEauthorblockN{Author Name}
\\IEEEauthorblockA{Department, University, City, Country\\\\email@example.com}}
\\maketitle

\\begin{abstract}
Abstract text here (9pt, no indent). Begin with bold "Abstract—"
\\end{abstract}

\\begin{IEEEkeywords}
keyword1, keyword2, keyword3
\\end{IEEEkeywords}

\\section{Introduction}
Body text [1].

\\section{References}
\\begin{thebibliography}{1}
\\bibitem{ref1} A. Author, "Title," Journal, vol. X, no. Y, pp. Z, Year.
\\end{thebibliography}
\\end{document}`,
  },

  {
    id: 4,
    name: 'Chicago 17th Edition',
    style: 'Chicago',
    organization: 'Chicago Manual of Style',
    description: 'Two systems: Notes-Bibliography (humanities) and Author-Date (sciences). Highly flexible and comprehensive.',
    color: '#EF4444',
    badge: '17th ed.',
    sections: [
      {
        icon: 'typography',
        title: 'Typography & Spacing',
        rules: [
          'Font: Times New Roman 12 pt (body text)',
          'Spacing: Double-spaced body; single-spaced block quotations, footnotes, bibliography entries themselves (double-space BETWEEN entries)',
          'Paragraph indent: 0.5 in for all paragraphs',
          'Block quotation: 5 lines or more (or 100 words). Indented 0.5 in from both margins; no quotation marks; single-spaced; source citation follows in parentheses or footnote',
          'Footnote/endnote text: 10 pt, single-spaced within note, blank line between notes',
        ],
      },
      {
        icon: 'margins',
        title: 'Page Setup & Margins',
        rules: [
          'Margins: 1 inch on all four sides (some institutions require 1.25 in left for binding)',
          'Paper: US Letter or A4',
          'Page numbers: Top-right (or bottom-centre) — first page may omit number',
          'Title page: Title centred at approx. 1/3 from top; author name centred below; date, course info at bottom centre',
          'Running head: Not required for student papers; optional for professional submissions',
        ],
      },
      {
        icon: 'headings',
        title: 'Heading Levels',
        rules: [
          'Chicago does not mandate a strict heading format — follow house/instructor style',
          'Recommended hierarchy: Level 1 — centred, bold, Title Case; Level 2 — centred, italic, Title Case; Level 3 — flush left, bold, Title Case; Level 4 — flush left, italic, Title Case; Level 5 — run-in, bold, ends with period',
          'No heading numbering required unless document warrants it (theses, long reports)',
          'Consistency in capitalization and typographic treatment is essential',
        ],
      },
      {
        icon: 'intext',
        title: 'Notes-Bibliography vs Author-Date',
        rules: [
          '── NOTES-BIBLIOGRAPHY (humanities) ──',
          'Footnote/endnote: superscript number in text; full citation in note',
          'First note (full): ¹ John Smith, The Title of the Book (City: Publisher, 2010), 45.',
          'Subsequent notes (short): ² Smith, Title, 52.  OR  ² Ibid., 52. (immediately following)',
          'Bibliography entry differs from note: no superscript; author reversed; no parentheses around pub. info',
          '── AUTHOR-DATE (sciences) ──',
          'In-text: (Smith 2010) or (Smith 2010, 45) for page reference',
          'Two authors: (Smith and Jones 2010)',
          'Three or more: (Smith et al. 2010)',
          'Reference list (not "Bibliography") — same format as bibliography but with year after author',
        ],
      },
      {
        icon: 'references',
        title: 'Bibliography / Reference List',
        rules: [
          'Heading: "Bibliography" (N-B) or "References" (Author-Date) — centred, no formatting',
          'Hanging indent: 0.5 in',
          'Alphabetical by last name; chronological for same author (earliest first)',
          'N-B Book: Last, First. Title of Book. City: Publisher, Year.',
          'N-B Journal: Last, First. "Article Title." Journal Name volume, no. issue (Year): pages. DOI.',
          'N-B Website: Last, First. "Page Title." Website Name. Month Day, Year. URL.',
          'Author-Date Book: Smith, John. 2010. Title of Book. City: Publisher.',
          'Author-Date Journal: Smith, John. 2010. "Article Title." Journal Name 12 (3): 45–67.',
          'For works with editors: Ed./Eds. follows editor name(s)',
          'Translator: "Translated by First Last" or "Trans. First Last"',
        ],
      },
      {
        icon: 'examples',
        title: 'Formatted Examples',
        rules: [
          'N-B footnote:  ¹ Orlando Figes, A People\'s Tragedy (London: Pimlico, 1997), 123.',
          'N-B bibliog.:  Figes, Orlando. A People\'s Tragedy. London: Pimlico, 1997.',
          'Author-date in-text:  The revolution began in February (Figes 1997, 123).',
          'Author-date ref.:  Figes, Orlando. 1997. A People\'s Tragedy. London: Pimlico.',
        ],
      },
    ],
    downloadSample: `Title of Paper

Author Name
Course / Department
Date

[Body text begins here. Double-spaced. 0.5 in paragraph indent.]

[Footnote example in text.¹]

───────────────── FOOTNOTES ─────────────────
¹ First Name Last Name, Title of Book (City: Publisher, Year), page.

───────────────── BIBLIOGRAPHY ────────────────
Last, First. Title of Book. City: Publisher, Year.
Last, First. "Article Title." Journal Name vol., no. issue (Year): pages.`,
  },

  {
    id: 5,
    name: 'Harvard Referencing',
    style: 'Harvard',
    organization: 'Author-Date System (UK / Australian universities)',
    description: 'Author-date system widely used in UK, Australian, and South African universities. No single official manual — follows institutional guidelines.',
    color: '#8B5CF6',
    badge: 'Author-Date',
    sections: [
      {
        icon: 'typography',
        title: 'Typography & Spacing',
        rules: [
          'Font: Times New Roman 12 pt or Arial 12 pt (check institutional guidelines)',
          'Line spacing: 1.5 or double-spaced body text; single-spaced within reference entries',
          'Paragraph indent: 0 or 0.5 in (varies by institution; be consistent)',
          'Reference list: Double-spaced between entries; hanging indent 0.5–1 in',
          'Block quotations (40+ words): Indented, no quotation marks, citation follows',
        ],
      },
      {
        icon: 'margins',
        title: 'Page Setup & Margins',
        rules: [
          'Margins: 2.54 cm (1 in) all sides, OR 3 cm left / 2.5 cm others for binding',
          'Paper: A4 standard',
          'Page numbers: Bottom-centre or top-right',
          'Title page (if required): Title, author, student number, course, submission date, word count',
          'No running head typically required',
        ],
      },
      {
        icon: 'headings',
        title: 'Heading Levels',
        rules: [
          'Harvard does not prescribe heading styles — follow institutional guidelines',
          'Common practice: Level 1 — 14 pt Bold, Title Case; Level 2 — 12 pt Bold, Title Case; Level 3 — 12 pt Bold Italic; Level 4 — 12 pt Italic',
          'Section numbers optional (e.g. 1.0, 1.1, 1.2) for dissertations/reports',
          'Headings left-aligned unless house style specifies otherwise',
        ],
      },
      {
        icon: 'intext',
        title: 'In-Text Citations',
        rules: [
          'One author: (Smith 2023) or Smith (2023)',
          'Two authors: (Smith and Jones 2023) — spell out "and" (NOT "&")',
          'Three or more authors: (Smith et al. 2023) — "et al." in italics for some institutions',
          'Direct quote: (Smith 2023, p. 45) or (Smith 2023:45)',
          'No author: Shortened title in single quotes + year: (\'Running Head\' 2020)',
          'Multiple works same bracket: (Brown 2019; Smith 2023) — semicolon, chronological or alphabetical',
          'Same author same year: (Smith 2023a, 2023b)',
          'Organisation as author: (WHO 2022) — abbreviate after first mention',
          'Page range: (Smith 2023, pp. 45–46)',
        ],
      },
      {
        icon: 'references',
        title: 'Reference List',
        rules: [
          'Heading: "References" or "Reference List" — centred or left-aligned',
          'Alphabetical by author last name; same author: chronological (oldest first)',
          'Hanging indent 0.5–1 in; no serial number; double-space between entries',
          'Journal article: Last, A.B. (Year) \'Article title\', Journal Name, vol. X, no. Y, pp. Z–Z, doi:xxxxx.',
          'Book: Last, A.B. (Year) Title of Book, Edition (if not 1st), Publisher, City.',
          'Book chapter: Last, A.B. (Year) \'Chapter title\', in A.B. Editor (ed.) Title of Book, Publisher, City, pp. X–X.',
          'Website: Last, A.B. (Year) Title of page, Publisher/Website, viewed Day Month Year, <URL>.',
          'No author: start with title, then year.',
          'Multiple authors: list ALL authors (unlike APA/MLA which truncate with et al.)',
          'DOI: always include when available — doi:10.xxxx/xxxx format',
        ],
      },
      {
        icon: 'examples',
        title: 'Formatted Examples',
        rules: [
          'Journal:  Thompson, R.L. and Davies, A.P. (2021) \'Climate adaptation in urban settings\', Environmental Studies, vol. 14, no. 3, pp. 210–225, doi:10.1234/es.2021.14.3.210.',
          'Book:  Johnson, K. (2020) Academic Writing: A Practical Guide, 3rd edn, Pearson, London.',
          'Website:  World Health Organisation (2023) Cancer facts, WHO, viewed 1 March 2024, <https://www.who.int/cancer>.',
          'In-text:  Research shows that adaptation is critical (Thompson and Davies 2021, p. 212).',
        ],
      },
    ],
    downloadSample: `Title of Assignment

Student Name | Student ID
Course Name | Submission Date | Word Count: XXXX

1.0 Introduction

[Body text here. 1.5 or double-spaced. Author-date citations (Smith 2023, p. 45).]

2.0 Literature Review

[Continue text...]

References

Last, A.B. (Year) 'Article title', Journal, vol. X, no. Y, pp. X–X.
Last, A.B. (Year) Title of Book, Publisher, City.`,
  },
]

const SECTION_ICONS = {
  typography: <FaFont className="text-blue-500" />,
  margins:    <FaRuler className="text-green-500" />,
  headings:   <FaFileAlt className="text-yellow-500" />,
  intext:     <FaQuoteRight className="text-purple-500" />,
  references: <FaListUl className="text-red-500" />,
  examples:   <FaTag className="text-teal-500" />,
}

const STYLE_COLORS = {
  APA:     { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-800',   tab: 'bg-blue-600'   },
  MLA:     { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-800', tab: 'bg-green-600'  },
  IEEE:    { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-800', tab: 'bg-amber-500'  },
  Chicago: { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-800',     tab: 'bg-red-600'    },
  Harvard: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800', tab: 'bg-purple-600' },
}

const Templates = () => {
  const [selectedStyle, setSelectedStyle] = useState('all')
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [activeSection, setActiveSection] = useState(0)
  const [showSample, setShowSample] = useState(false)

  const styles = ['all', 'APA', 'MLA', 'IEEE', 'Chicago', 'Harvard']

  const filteredTemplates =
    selectedStyle === 'all'
      ? templates
      : templates.filter((t) => t.style === selectedStyle)

  const handleDownloadSample = (template) => {
    const blob = new Blob([template.downloadSample], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${template.style}_sample_template.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openPreview = (template) => {
    setPreviewTemplate(template)
    setActiveSection(0)
    setShowSample(false)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Formatting Templates</h1>
        <p className="mt-1 text-sm text-gray-600">
          Complete style-guide rules for APA, MLA, IEEE, Chicago, and Harvard — typography, margins, headings, citations, and reference formats.
        </p>
      </div>

      {/* Style Filter */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-wrap gap-2">
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                selectedStyle === style
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {style === 'all' ? 'All Styles' : style}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((template) => {
          const colors = STYLE_COLORS[template.style] || {}
          return (
            <div
              key={template.id}
              className={`bg-white rounded-xl border ${colors.border} hover:shadow-lg transition-shadow overflow-hidden flex flex-col`}
            >
              {/* Coloured top bar */}
              <div className="h-2 w-full" style={{ backgroundColor: template.color }} />

              <div className="p-5 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{template.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{template.organization}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                    {template.badge}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-4 leading-relaxed">{template.description}</p>

                {/* Rule categories preview */}
                <div className="space-y-1.5 mb-4 flex-1">
                  {template.sections.map((sec) => (
                    <div key={sec.title} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-4 flex-shrink-0">{SECTION_ICONS[sec.icon]}</span>
                      <span className="font-medium">{sec.title}</span>
                      <span className="text-gray-400 text-xs ml-auto">{sec.rules.length} rules</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openPreview(template)}
                    className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FaEye className="text-xs" />
                    View Rules
                  </button>
                  <button
                    onClick={() => handleDownloadSample(template)}
                    className="flex-1 py-2 px-3 text-sm font-medium text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: template.color }}
                  >
                    <FaDownload className="text-xs" />
                    Sample
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick reference summary */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <FaBook className="text-blue-600" />
          <h2 className="text-base font-bold text-gray-900">Quick Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Feature</th>
                <th className="text-left px-4 py-3 font-semibold text-blue-700">APA 7</th>
                <th className="text-left px-4 py-3 font-semibold text-green-700">MLA 9</th>
                <th className="text-left px-4 py-3 font-semibold text-amber-700">IEEE</th>
                <th className="text-left px-4 py-3 font-semibold text-red-700">Chicago 17</th>
                <th className="text-left px-4 py-3 font-semibold text-purple-700">Harvard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['Citation type',     'Author-date',      'Author-page',     'Numeric [N]',      'Footnote / Author-date', 'Author-date'],
                ['Font',              'TNR 12pt / Cal 11', 'TNR 12pt',       'TNR 10pt',         'TNR 12pt',              'TNR/Arial 12pt'],
                ['Line spacing',      'Double',           'Double',          'Single',           'Double (body)',         '1.5 or double'],
                ['Margins',           '1 in all',         '1 in all',        '0.625 in L/R',     '1 in all',              '2.54 cm all'],
                ['Column layout',     'Single',           'Single',          'Two-column',       'Single',                'Single'],
                ['Reference heading', 'References',       'Works Cited',     'References',       'Bibliography',          'References'],
                ['Title page',       'Required',         'No (info block)',  'Author block',     'Optional',              'Optional'],
                ['Running head',     'Professional only', 'None',           'None',             'Optional',              'None'],
                ['Page numbers',     'Top-right p.1+',   'Top-right p.1+',  'Bottom-centre',    'Top-right',             'Bottom-centre'],
              ].map(([feature, ...vals]) => (
                <tr key={feature} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">{feature}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-4 py-2.5 text-gray-600">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview / Rules Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: previewTemplate.color }} />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{previewTemplate.name}</h2>
                  <p className="text-xs text-gray-500">{previewTemplate.organization}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSample(previewTemplate)}
                  className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
                  style={{ backgroundColor: previewTemplate.color }}
                >
                  <FaDownload className="text-xs" />
                  Download Sample
                </button>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Section tabs */}
            <div className="flex overflow-x-auto border-b border-gray-200 flex-shrink-0 px-2 pt-2 gap-1">
              {previewTemplate.sections.map((sec, idx) => (
                <button
                  key={idx}
                  onClick={() => { setActiveSection(idx); setShowSample(false) }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 ${
                    activeSection === idx && !showSample
                      ? 'border-current text-gray-900 bg-gray-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  style={activeSection === idx && !showSample ? { borderColor: previewTemplate.color } : {}}
                >
                  {SECTION_ICONS[sec.icon]}
                  {sec.title}
                </button>
              ))}
              <button
                onClick={() => setShowSample(true)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 ml-auto ${
                  showSample
                    ? 'border-current text-gray-900 bg-gray-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                style={showSample ? { borderColor: previewTemplate.color } : {}}
              >
                <FaFileAlt className="text-gray-400" />
                Template Sample
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6">
              {showSample ? (
                <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap leading-relaxed text-gray-800">
                  {previewTemplate.downloadSample}
                </pre>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">{SECTION_ICONS[previewTemplate.sections[activeSection].icon]}</span>
                    <h3 className="text-base font-bold text-gray-900">
                      {previewTemplate.sections[activeSection].title}
                    </h3>
                    <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {previewTemplate.sections[activeSection].rules.length} rules
                    </span>
                  </div>

                  <div className="space-y-2">
                    {previewTemplate.sections[activeSection].rules.map((rule, idx) => {
                      const isSeparator = rule.startsWith('──')
                      const isExample  = previewTemplate.sections[activeSection].icon === 'examples'
                      return isSeparator ? (
                        <div key={idx} className="pt-2 pb-1">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{rule.replace(/──/g, '').trim()}</p>
                        </div>
                      ) : isExample ? (
                        <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-xs font-mono text-gray-700 leading-relaxed">{rule}</p>
                        </div>
                      ) : (
                        <div key={idx} className="flex gap-3 items-start">
                          <span
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5"
                            style={{ backgroundColor: previewTemplate.color }}
                          >
                            {idx + 1}
                          </span>
                          <p className="text-sm text-gray-700 leading-relaxed">{rule}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default Templates



