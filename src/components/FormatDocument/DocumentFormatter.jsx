import { useState } from 'react'
import {
  FaFileAlt,
  FaTimes,
  FaCheckCircle,
  FaSpinner,
  FaBook,
  FaCopy,
  FaEye,
  FaExclamationCircle,
  FaInfo,
  FaCheckSquare,
  FaTasks,
  FaQuoteRight,
  FaFilePdf,
  FaFileWord,
  FaCode,
} from 'react-icons/fa'
import { citationAPI } from '../../services/pythonNlpService'

const NLP_BASE = import.meta.env.VITE_NLP_API_URL || 'http://localhost:5001'

const DocumentFormatter = ({ document: propDocument, onClose, onFormatSuccess, isModal: isModalProp }) => {
  const isModal = isModalProp !== undefined ? isModalProp : !!onClose

  // Internal document state for standalone page mode
  const [uploadedDoc, setUploadedDoc]   = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)  // raw File for structured extraction
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState('')
  const document = propDocument || uploadedDoc
  // Normalise content — can be a plain string OR { raw: '...' } object
  const docText = typeof document?.content === 'string'
    ? document.content
    : (document?.content?.raw || document?.content?.formatted || '')

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadError('')
    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'txt') {
      // Plain text — read directly, no structured extraction needed
      const reader = new FileReader()
      reader.onload = (ev) => {
        setUploadedDoc({ title: file.name, content: ev.target.result })
        setUploadedFile(null)
      }
      reader.readAsText(file)
      return
    }

    // PDF / DOCX — keep the raw File; extract flat text only for preview display
    setUploadedFile(file)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${NLP_BASE}/api/extract/file`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Extraction failed')
      setUploadedDoc({ title: file.name, content: data.content || data.text || '' })
    } catch (err) {
      setUploadError(err.message || 'Failed to extract file content')
    } finally {
      setUploading(false)
    }
  }

  // State Management
  const [selectedStyle, setSelectedStyle] = useState('APA')
  const [formatting, setFormatting] = useState(false)
  const [formattedContent, setFormattedContent] = useState(null)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('styles') // 'styles', 'preview', 'rules', 'citations'
  const [appliedRules, setAppliedRules] = useState([])
  const [copySuccess, setCopySuccess] = useState(false)
  const [citationAnalysis, setCitationAnalysis] = useState(null)
  const [analyzingCitations, setAnalyzingCitations] = useState(false)
  const [aiResult, setAiResult]   = useState(null)   // full /ai-format response
  const [downloading, setDownloading] = useState('')  // 'pdf' | 'docx' | 'tex' | ''
  const [largeDocMode, setLargeDocMode] = useState(false)
  const [progress, setProgress] = useState(null)  // null | {stage,chunk,total,section,repairs,complete}

  // Formatting styles with descriptions
  const styles = [
    {
      id: 'APA',
      name: 'APA',
      edition: '7th Edition',
      organization: 'American Psychological Association',
      description: 'Widely used in social sciences, psychology, and education',
      example: 'Smith, J. (2023). Title of work. Publisher Name.',
      features: [
        // Typography & Spacing
        'Font: Times New Roman 12 pt  OR  Calibri 11 pt  OR  Arial 11 pt (consistent throughout)',
        'Line spacing: Double-spaced throughout — title page, abstract, body, references',
        'Paragraph indent: 0.5 in (first line) — NOT spaces',
        'No extra blank lines between paragraphs',
        'Abstract: 150–250 words, single block, no first-line indent',
        // Page Setup
        'Margins: 1 inch (2.54 cm) on ALL four sides',
        'Student papers: NO running head required (7th ed.)',
        'Professional papers: Running head ≤ 50 characters, ALL CAPS, top-left',
        'Page numbers in top-right header starting from page 1',
        // Headings
        'Level 1 — Centred, Bold, Title Case',
        'Level 2 — Left-aligned, Bold, Title Case',
        'Level 3 — Left-aligned, Bold Italic, Title Case',
        'Level 4 — Indented 0.5 in, Bold, Title Case, ends with period — text continues',
        'Level 5 — Indented 0.5 in, Bold Italic, Title Case, ends with period — text continues',
        'Do NOT use "Introduction" as a heading',
        // In-text Citations
        'One author: (Smith, 2023)  or  Smith (2023)',
        'Two authors: (Smith & Jones, 2023)',
        'Three or more: (Smith et al., 2023)',
        'Direct quote: (Smith, 2023, p. 45)',
        'Multiple works: (Brown, 2019; Smith, 2023) — alphabetical',
        'Same author same year: (Smith, 2023a, 2023b)',
        // References Page
        'New page, centred bold heading "References"',
        'Hanging indent: 0.5 in; double-spaced',
        'Alphabetical by first author last name',
        'Include DOI as https://doi.org/xxxxx when available',
        'Journal: Author. (Year). Title. Journal, vol(issue), pp. DOI',
        'Book: Author. (Year). Title. Publisher.',
        'Website: Author. (Year, Mon Day). Title. Site. URL',
      ],
    },
    {
      id: 'MLA',
      name: 'MLA',
      edition: '9th Edition',
      organization: 'Modern Language Association',
      description: 'Common in humanities, literature, and language studies',
      example: 'Smith, John. "Title of Work." Publisher Name, 2023.',
      features: [
        // Typography & Spacing
        'Font: Times New Roman 12 pt (preferred)',
        'Line spacing: Double-spaced throughout including Works Cited',
        'Paragraph indent: 0.5 in for every first line',
        'Long quotations (4+ prose lines): block quote, indented 0.5 in, no quotation marks',
        // Page Setup
        'Margins: 1 inch on all four sides',
        'NO separate title page (unless instructor requires)',
        'Header block top-left: Name / Instructor / Course / Date (Day Month Year)',
        'Title: Centred, Title Case, no bold/italic/underline',
        'Page header: Last Name + page number, top-right (e.g. Smith 3)',
        // Headings
        'Level 1 — Bold; Level 2 — Italic; Level 3 — Bold Italic; Level 4 — Underline',
        'Left-aligned; no period after heading',
        // In-text Citations
        'Author and page (NO comma): (Smith 45) or (Smith 45–46)',
        'Author in sentence: Smith argues that "…" (45).',
        'No author: Shortened title in quotes: ("Running Head" 12)',
        'Two authors: (Smith and Jones 34); Three or more: (Smith et al. 34)',
        'Same author multiple works: (Smith, Hamlet 45)',
        'Indirect source: (qtd. in Smith 45)',
        'Electronic sources without pages: (Smith) or paragraph (Smith, par. 4)',
        // Works Cited
        'Centred heading "Works Cited" — no bold, no italics',
        'New page at end; hanging indent 0.5 in; double-spaced',
        'Alphabetical by author last name; no author → alphabetise by title',
        'MLA 9 container system: Author. Title. Container, Contributor, Version, Number, Publisher, Date, Location.',
        'Journal: Author. "Article." Journal, vol. X, no. Y, Year, pp. Z–Z. DOI or URL.',
        'Book: Author. Book Title. Publisher, Year.',
        'Website: Author. "Page." Site, Day Month Year, URL.',
      ],
    },
    {
      id: 'IEEE',
      name: 'IEEE',
      edition: 'Latest',
      organization: 'Institute of Electrical and Electronics Engineers',
      description: 'Standard for technical, engineering, and computer science papers',
      example: '[1] J. Smith, "Title of work," Publisher, 2023.',
      features: [
        // Typography & Spacing
        'Font body: Times New Roman 10 pt; single-spaced',
        'Section headings: 10 pt small caps; subsection headings: italic 10 pt',
        'Abstract: 9 pt, single paragraph, no indent — begins with bold "Abstract—"',
        'Keywords: 9 pt, begins with italic "Index Terms—"',
        'Typical length: 6–8 pages (conference); 8–12 pages (journal)',
        // Page Setup
        'Paper: US Letter (8.5 × 11 in)',
        'Margins: Top 0.75 in; Left/Right 0.625 in; Bottom 1 in',
        'Layout: TWO-COLUMN; column width ~3.5 in; gutter 0.25 in',
        'Title block: Single-column, centred; authors centred with affiliations below',
        // Headings
        'Level 1: Roman numeral + SMALL CAPS, centred — e.g. I. INTRODUCTION',
        'Level 2: Capital letter + Italic, left-aligned — e.g. A. System Architecture',
        'Level 3: Italic, indented, ends with period — text continues on same line',
        'Do NOT number Abstract, Acknowledgments, or References sections',
        // In-text Citations
        'Numbered brackets [1], [2], [3] assigned in ORDER OF FIRST APPEARANCE',
        'Consecutive: [1]–[3]; non-consecutive: [1], [3], [5]',
        'Citation placed BEFORE punctuation: "…as shown in [2]."',
        'Do not use author name alone — always use bracket number',
        'Reuse same number when citing the same source again',
        // References Section
        'Heading: "REFERENCES" — no numeral, no section marker',
        'Number [N] flush left; hanging indent; numerical order (order of appearance)',
        'Author format: initials then last name — A. B. Smith and C. D. Jones',
        'Journal: [N] A. Author, "Title," Abbrev. Journal, vol. X, no. Y, pp. Z–Z, Mon. Year, doi:…',
        'Conference: [N] A. Author, "Title," in Proc. Conf. Name, City, Year, pp. Z–Z.',
        'Book: [N] A. Author, Title of Book, Xth ed. City: Publisher, Year.',
        'Webpage: [N] A. Author, "Title," Site. Accessed: Mon. DD, YYYY. [Online]. Available: URL',
        'Abbreviate journal names per IEEE standard list',
      ],
    },
    {
      id: 'Chicago',
      name: 'Chicago',
      edition: '17th Edition',
      organization: 'Chicago Manual of Style',
      description: 'Used in history, philosophy, and some business fields',
      example: 'Smith, John. Title of Work. Publisher, 2023.',
      features: [
        // Typography & Spacing
        'Font: Times New Roman 12 pt body text',
        'Spacing: Double-spaced body; single-spaced footnotes and bibliography entries',
        'Double-space BETWEEN bibliography entries',
        'Paragraph indent: 0.5 in for all paragraphs',
        'Block quotations (100+ words or 5+ lines): indented 0.5 in both margins, no quotes, single-spaced',
        'Footnote text: 10 pt, single-spaced within note',
        // Page Setup
        'Margins: 1 inch all sides (or 1.25 in left for binding)',
        'Title page: Title centred ~1/3 from top; author centred below; date/course at bottom',
        'Page numbers: top-right or bottom-centre; title page may omit',
        // Headings
        'Level 1 — Centred, Bold, Title Case',
        'Level 2 — Centred, Italic, Title Case',
        'Level 3 — Flush left, Bold, Title Case',
        'Level 4 — Flush left, Italic, Title Case',
        'Level 5 — Run-in, Bold, ends with period',
        'Consistency in capitalisation and typographic treatment is required',
        // Notes-Bibliography vs Author-Date
        'NOTES-BIBLIOGRAPHY: Superscript number in text; full citation in footnote',
        'First footnote (full): ¹ John Smith, Title (City: Publisher, 2010), 45.',
        'Subsequent footnotes (short): ² Smith, Title, 52.  OR  Ibid., 52.',
        'AUTHOR-DATE: In-text (Smith 2010) or (Smith 2010, 45)',
        'Author-date two authors: (Smith and Jones 2010)',
        'Author-date three or more: (Smith et al. 2010)',
        // Bibliography
        'Heading: "Bibliography" (N-B) or "References" (Author-Date)',
        'Hanging indent 0.5 in; alphabetical by last name; chronological same author',
        'N-B Book: Last, First. Title. City: Publisher, Year.',
        'N-B Journal: Last, First. "Article." Journal vol, no. issue (Year): pages. DOI.',
        'Author-Date Book: Smith, John. 2010. Title. City: Publisher.',
        'Author-Date Journal: Smith, John. 2010. "Article." Journal 12 (3): 45–67.',
        'Editor: Ed./Eds. follows editor name(s)',
      ],
    },
    {
      id: 'Harvard',
      name: 'Harvard',
      edition: 'Latest',
      organization: 'Harvard Referencing System',
      description: 'Popular in UK universities and scientific research',
      example: 'Smith, J. (2023) Title of work. Publisher Name.',
      features: [
        // Typography & Spacing
        'Font: Times New Roman 12 pt or Arial 12 pt',
        'Line spacing: 1.5 or double-spaced body text',
        'Single-spaced within reference entries; double-spaced between entries',
        'Hanging indent 0.5–1 in in reference list',
        'Block quotations (40+ words): indented, no quotation marks, citation follows',
        // Page Setup
        'Margins: 2.54 cm (1 in) all sides, or 3 cm left for binding',
        'Paper: A4 standard',
        'Page numbers: bottom-centre or top-right',
        'Title page (if required): title, author, student number, course, date, word count',
        // Headings
        'Level 1 — 14 pt Bold, Title Case',
        'Level 2 — 12 pt Bold, Title Case',
        'Level 3 — 12 pt Bold Italic',
        'Level 4 — 12 pt Italic',
        'Section numbers optional (1.0, 1.1, 1.2) for dissertations/reports',
        // In-text Citations
        'One author: (Smith 2023) or Smith (2023)',
        'Two authors: (Smith and Jones 2023) — spell out "and"',
        'Three or more: (Smith et al. 2023)',
        'Direct quote: (Smith 2023, p. 45) or (Smith 2023:45)',
        'No author: Shortened title in single quotes + year: (\'Running Head\' 2020)',
        'Multiple works in bracket: (Brown 2019; Smith 2023) — semicolon separated',
        'Same author same year: (Smith 2023a, 2023b)',
        'Page range: (Smith 2023, pp. 45–46)',
        // Reference List
        'Heading: "References" or "Reference List" — centred or left-aligned',
        'Alphabetical by last name; same author: chronological oldest first',
        'Journal: Last, A.B. (Year) \'Article title\', Journal, vol. X, no. Y, pp. Z–Z, doi:…',
        'Book: Last, A.B. (Year) Title, Edition (if not 1st), Publisher, City.',
        'Chapter: Last, A.B. (Year) \'Chapter title\', in A.B. Editor (ed.) Title, Publisher, pp. X–X.',
        'Website: Last, A.B. (Year) Title, viewed Day Month Year, <URL>.',
        'List ALL authors — do not truncate with et al. in reference list',
        'Always include DOI when available: doi:10.xxxx/xxxx format',
      ],
    },
  ]

  // ── Large-document stateful formatter (SSE streaming) ──────────────
  const handleLargeDocFormat = async () => {
    if (!uploadedFile) {
      setError('Large document mode requires a PDF or DOCX file upload.')
      return
    }
    setFormatting(true)
    setError('')
    setFormattedContent(null)
    setAiResult(null)
    setProgress({ stage: 1, chunk: 0, total: 0, section: 'Extracting document…', repairs: 0, complete: false })

    const docTitle = document?.title || 'Untitled Document'
    const formData = new FormData()
    formData.append('file', uploadedFile)
    formData.append('target_style', selectedStyle)
    formData.append('title', docTitle)

    try {
      const response = await fetch(`${NLP_BASE}/api/formatting/stateful-format`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error(`Server error ${response.status}`)

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === 'error') {
            throw new Error(event.message)
          } else if (event.type === 'stage') {
            setProgress(p => ({ ...p, stage: event.stage, section: event.description }))
          } else if (event.type === 'start') {
            setProgress(p => ({ ...p, total: event.total, bibEntries: event.bib_entries }))
          } else if (event.type === 'progress') {
            setProgress(p => ({
              ...p,
              chunk:   event.chunk,
              total:   event.total,
              section: event.section || p.section,
              repairs: (p.repairs || 0) + (event.repairs || 0),
            }))
          } else if (event.type === 'complete') {
            setAiResult({
              success:          true,
              latex:            event.latex || '',
              plain_sections:   [],
              gap_report:       {},
              citation_stats:   {},
              warnings:         [],
              stateful:         true,
              chunks_processed: event.chunks_processed,
              total_repairs:    event.total_repairs,
              bib_entry_count:  event.bib_entry_count,
              word_count:       event.word_count,
            })
            setFormattedContent(
              `✓ ${event.chunks_processed} chunks processed · ` +
              `${event.bib_entry_count} bib entries · ` +
              `${event.total_repairs} auto-repairs\n\n` +
              `LaTeX source ready — click the LaTeX (↓) button to download paper.tex`
            )
            setProgress(p => ({ ...p, complete: true }))
            setActiveTab('preview')
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Large document formatting failed')
    } finally {
      setFormatting(false)
    }
  }

  // Apply formatting via AI pipeline
  const handleApplyFormatting = async () => {
    if (largeDocMode) return handleLargeDocFormat()
    setFormatting(true)
    setError('')
    setFormattedContent(null)
    setAiResult(null)

    try {
      if (!docText && !uploadedFile) {
        setError('No document content found')
        setFormatting(false)
        return
      }

      let response
      const docTitle = document?.title || 'Untitled Document'

      if (uploadedFile) {
        // Structured path: send original file so backend uses pdfplumber / DOCX styles
        const formData = new FormData()
        formData.append('file', uploadedFile)
        formData.append('target_style', selectedStyle)
        formData.append('source_style', 'unknown')
        formData.append('title', docTitle)
        formData.append('generate_latex', 'true')
        response = await fetch(`${NLP_BASE}/api/formatting/ai-format`, {
          method: 'POST',
          body: formData,
        })
      } else {
        // Fallback: plain text (TXT files or propDocument from elsewhere)
        response = await fetch(`${NLP_BASE}/api/formatting/ai-format`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text:           docText,
            target_style:   selectedStyle,
            source_style:   'unknown',
            title:          docTitle,
            authors:        [],
            generate_latex: true,
          }),
        })
      }

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Formatting failed')
      }

      setAiResult(data)
      // plain text for clipboard copy only
      const plain = (data.plain_sections || [])
        .map(s => `== ${s.heading} ==\n${s.text}`)
        .join('\n\n')
      setFormattedContent(plain)
      setAppliedRules([])
      setActiveTab('preview')
    } catch (err) {
      setError(err.message || 'Failed to format document')
      console.error('Formatting error:', err)
    } finally {
      setFormatting(false)
    }
  }

  // Download via backend
  const handleDownload = async (fmt) => {
    if (!aiResult) return
    setDownloading(fmt)
    setError('')

    // Helper: trigger a browser file download from a Blob.
    // Revoke the object URL after a delay — revoking synchronously after click()
    // causes the download to silently fail in most browsers because the fetch
    // is scheduled asynchronously and the URL is already gone by then.
    const triggerDownload = (blob, filename) => {
      const url = URL.createObjectURL(blob)
      const a   = window.document.createElement('a')
      a.href     = url
      a.download = filename
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }

    const docTitle = (propDocument?.title || uploadedDoc?.title || 'document')
      .replace(/\.[^.]+$/, '')   // strip extension
      .replace(/\s+/g, '_')

    try {
      if (fmt === 'tex') {
        const blob = new Blob([aiResult.latex || ''], { type: 'text/plain' })
        triggerDownload(blob, `${docTitle}_${selectedStyle}.tex`)
        return
      }

      const sections = aiResult.plain_sections || []
      if (sections.length === 0) {
        throw new Error('No formatted sections available. Please re-format the document first.')
      }

      const mimeType = fmt === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      const response = await fetch(`${NLP_BASE}/api/formatting/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: sections,
          style:    selectedStyle,
          title:    propDocument?.title || uploadedDoc?.title || 'Untitled Document',
          authors:  [],
          format:   fmt,
        }),
      })

      if (!response.ok) {
        let msg = 'Download failed'
        try { const j = await response.json(); msg = j.error || msg } catch {}
        throw new Error(msg)
      }

      const blob = await response.blob()
      const ext  = fmt === 'pdf' ? 'pdf' : 'docx'
      triggerDownload(new Blob([blob], { type: mimeType }), `${docTitle}_${selectedStyle}.${ext}`)
    } catch (err) {
      setError('Download failed: ' + err.message)
    } finally {
      setDownloading('')
    }
  }

  // Copy to clipboard
  const handleCopyFormatted = async () => {
    try {
      await navigator.clipboard.writeText(formattedContent)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      setError('Failed to copy to clipboard')
    }
  }

  // Analyze citations
  const analyzeCitations = async () => {
    setAnalyzingCitations(true)
    setError('')

    try {
      const text = docText
      if (!text) {
        setError('No document content to analyze')
        return
      }

      const response = await citationAPI.matchCitations(text)
      setCitationAnalysis(response.data)
    } catch (err) {
      console.error('Citation analysis error:', err)
      setError('Failed to analyze citations: ' + (err.response?.data?.error || err.message))
    } finally {
      setAnalyzingCitations(false)
    }
  }

  // Page mode — no document yet: show upload screen
  if (!isModal && !document) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Document Formatter</h1>
          <p className="text-sm text-gray-600 mt-1">Upload a document to apply citation styles and export as PDF, Word or LaTeX</p>
        </div>
        <div className="max-w-xl mx-auto mt-12">
          <label className={`cursor-pointer block border-2 border-dashed rounded-xl p-12 text-center transition-all ${
            uploading ? 'border-purple-400 bg-purple-50' : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50'
          }`}>
            {uploading ? (
              <>
                <FaSpinner className="animate-spin text-4xl text-purple-500 mx-auto mb-4" />
                <p className="text-base font-semibold text-purple-700">Extracting document content…</p>
              </>
            ) : (
              <>
                <FaBook className="text-5xl text-purple-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-700 mb-2">Upload a document to format</p>
                <div className="flex justify-center gap-3 mb-5">
                  <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
                    <FaFilePdf /> PDF
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                    <FaFileWord /> DOCX
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium">
                    <FaFileAlt /> TXT
                  </span>
                </div>
                <span className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
                  Choose File
                </span>
              </>
            )}
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {uploadError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <FaExclamationCircle className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{uploadError}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={isModal ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4' : 'p-6'}>
      <div className={isModal ? 'bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl' : 'bg-white rounded-xl w-full overflow-y-auto flex flex-col shadow-2xl border border-gray-200'}>
        {/* Header */}}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 border-b border-purple-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <FaBook className="text-3xl" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Document Formatter</h2>
                <p className="text-purple-100 text-sm mt-1">
                  {document?.title || 'Document'} - Apply Citation Styles
                </p>
              </div>
            </div>
            {isModal && onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-purple-500 rounded-lg transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!formattedContent ? (
            <div className="p-8">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
                  <FaExclamationCircle className="text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-red-900">Error</h4>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Document Info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
                <div className="flex items-start gap-3">
                  <FaFileAlt className="text-purple-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Document Information</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {document?.title || 'Untitled Document'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {docText.length} characters • Last modified{' '}
                      {document?.updatedAt
                        ? new Date(document.updatedAt).toLocaleDateString()
                        : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Style Selection */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FaBook className="text-purple-600" />
                  Select Formatting Style
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {styles.map((style) => (
                    <label
                      key={style.id}
                      className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                        selectedStyle === style.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="style"
                          value={style.id}
                          checked={selectedStyle === style.id}
                          onChange={(e) => setSelectedStyle(e.target.value)}
                          disabled={formatting}
                          className="mt-1 w-5 h-5 text-purple-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg text-gray-900">{style.name}</h4>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              {style.edition}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-3">{style.organization}</p>
                          <p className="text-sm text-gray-700 mb-3">{style.description}</p>

                          <div className="bg-white border border-gray-200 rounded p-3 mb-3">
                            <p className="text-xs text-gray-600 mb-1">Example:</p>
                            <p className="text-xs font-mono text-gray-900">{style.example}</p>
                          </div>

                          <div className="space-y-1">
                            {style.features.map((feature, idx) => (
                              <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                                <FaCheckSquare className="text-purple-500" />
                                {feature}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Information Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <FaInfo className="text-blue-600 flex-shrink-0 mt-1" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-2">What happens when you format:</p>
                  <ul className="space-y-1 text-xs">
                    <li>✓ Applies consistent spacing and font settings</li>
                    <li>✓ Formats citations and references</li>
                    <li>✓ Adjusts heading styles per selected format</li>
                    <li>✓ Creates proper bibliography formatting</li>
                    <li>✓ Maintains your original content and structure</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            // Results View
            <div className="p-8">
              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b border-gray-200">
                {[
                  { id: 'preview', label: 'Preview', icon: FaEye },
                  { id: 'rules', label: 'Applied Rules', icon: FaTasks },
                  { id: 'citations', label: 'Citation Analysis', icon: FaQuoteRight },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveTab(id)
                      if (id === 'citations' && !citationAnalysis) {
                        analyzeCitations()
                      }
                    }}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === id
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="text-lg" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Preview Tab */}
              {activeTab === 'preview' && (
                <div className="space-y-4">
                  {/* Format Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <p className="text-xs text-gray-600 mb-1">Selected Style</p>
                      <p className="text-xl font-bold text-purple-700">{selectedStyle}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <p className="text-xs text-gray-600 mb-1">Rules Applied</p>
                      <p className="text-xl font-bold text-blue-700">{appliedRules.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <p className="text-xs text-gray-600 mb-1">Status</p>
                      <p className="text-xl font-bold text-green-700">Ready</p>
                    </div>
                  </div>

                  {/* Formatted Content — styled document preview */}
                  <div
                    className="bg-white border border-gray-300 shadow-sm rounded-lg overflow-y-auto"
                    style={{ maxHeight: '560px', padding: '56px 72px', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '12pt', color: '#111' }}
                  >
                    {(aiResult?.plain_sections || []).map((sec, idx) => {
                      const isRef = sec.section_type === 'references'
                      const isAbs = sec.section_type === 'abstract'
                      const bibLabels = { APA: 'References', MLA: 'Works Cited', IEEE: 'References', Chicago: 'Bibliography', Harvard: 'Reference List' }
                      const headingText = isRef ? (bibLabels[selectedStyle] || 'References') : (isAbs ? 'Abstract' : sec.heading)

                      // Per-style heading alignment
                      const hCentre = ['APA', 'MLA', 'Chicago', 'Harvard'].includes(selectedStyle)
                      const headingStyle = {
                        fontWeight: 'bold',
                        textAlign: (selectedStyle === 'IEEE') ? 'center' : (hCentre ? 'center' : 'left'),
                        fontStyle: 'normal',
                        textTransform: selectedStyle === 'IEEE' ? 'uppercase' : 'none',
                        marginBottom: '0',
                        marginTop: idx === 0 ? '0' : '1.4em',
                        lineHeight: '2',
                      }

                      // Split reference entries (one per line after backend sorting)
                      const refEntries = isRef
                        ? sec.text.split('\n').map(e => e.trim()).filter(Boolean)
                        : []

                      // Body paragraphs
                      const paragraphs = !isRef
                        ? sec.text.split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean)
                        : []

                      const lineH = selectedStyle === 'IEEE' ? '1.5' : '2'
                      const indent = (!isAbs && ['APA','MLA','Chicago','Harvard'].includes(selectedStyle)) ? '0.5in' : '0'

                      return (
                        <div key={idx}>
                          <p style={headingStyle}>{headingText}</p>
                          {paragraphs.map((para, pIdx) => (
                            <p key={pIdx} style={{ textIndent: indent, margin: 0, textAlign: 'justify', lineHeight: lineH }}>
                              {para}
                            </p>
                          ))}
                          {refEntries.map((entry, eIdx) => (
                            <p key={eIdx} style={{ paddingLeft: '0.5in', textIndent: '-0.5in', margin: '0 0 0.1em', textAlign: 'left', lineHeight: lineH }}>
                              {entry}
                            </p>
                          ))}
                        </div>
                      )
                    })}
                  </div>

                  {/* Download bar */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-semibold text-gray-700 mr-2">Download as:</span>

                    <button
                      onClick={() => handleDownload('pdf')}
                      disabled={!!downloading || !(aiResult?.plain_sections?.length)}
                      title={!(aiResult?.plain_sections?.length) ? 'Re-format the document to enable PDF/DOCX download' : undefined}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading === 'pdf' ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                      PDF
                    </button>

                    <button
                      onClick={() => handleDownload('docx')}
                      disabled={!!downloading || !(aiResult?.plain_sections?.length)}
                      title={!(aiResult?.plain_sections?.length) ? 'Re-format the document to enable PDF/DOCX download' : undefined}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading === 'docx' ? <FaSpinner className="animate-spin" /> : <FaFileWord />}
                      Word (.docx)
                    </button>

                    <button
                      onClick={() => handleDownload('tex')}
                      disabled={!!downloading || !aiResult?.latex}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading === 'tex' ? <FaSpinner className="animate-spin" /> : <FaCode />}
                      LaTeX (.tex)
                    </button>

                    <span className="text-xs text-gray-500 ml-auto">{selectedStyle} style applied</span>
                  </div>

              {/* Gap report */}
                  {aiResult?.gap_report?.missing_sections?.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                      <FaExclamationCircle className="text-yellow-600 flex-shrink-0 mt-1" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-semibold mb-1">Sections not found in your document:</p>
                        <p className="text-xs">{aiResult.gap_report.missing_sections.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rules Tab */}
              {activeTab === 'rules' && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {appliedRules && appliedRules.length > 0 ? (
                    appliedRules.map((rule, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                        <div className="flex items-start gap-3">
                          <FaCheckCircle className="text-green-600 flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{rule.rule}</h4>
                            <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                            {rule.applied && (
                              <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                                <FaCheckCircle />
                                Applied to document
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FaTasks className="text-3xl mx-auto mb-2 opacity-50" />
                      <p>No rules to display</p>
                    </div>
                  )}
                </div>
              )}

              {/* Citations Tab */}
              {activeTab === 'citations' && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {analyzingCitations ? (
                    <div className="text-center py-12">
                      <FaSpinner className="animate-spin text-4xl text-purple-600 mx-auto mb-4" />
                      <p className="text-gray-600">Analyzing citations...</p>
                    </div>
                  ) : citationAnalysis ? (
                    <>
                      {/* Citation Statistics */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
                          <div className="text-2xl font-bold text-blue-700">
                            {citationAnalysis.citations?.length || 0}
                          </div>
                          <div className="text-xs text-gray-600">Citations</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {citationAnalysis.references?.length || 0}
                          </div>
                          <div className="text-xs text-gray-600">References</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 text-center">
                          <div className="text-2xl font-bold text-purple-700">
                            {citationAnalysis.matched_count || 0}
                          </div>
                          <div className="text-xs text-gray-600">Matched</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 text-center">
                          <div className="text-2xl font-bold text-yellow-700">
                            {citationAnalysis.unmatched_citations || 0}
                          </div>
                          <div className="text-xs text-gray-600">Unmatched</div>
                        </div>
                      </div>

                      {/* Citation List Preview */}
                      {citationAnalysis.citations && citationAnalysis.citations.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-gray-900 mb-2">In-text Citations</h4>
                          {citationAnalysis.citations.slice(0, 5).map((citation, idx) => {
                            const isMatched = citationAnalysis.mapping && 
                                            citationAnalysis.mapping[idx] !== undefined

                            return (
                              <div
                                key={idx}
                                className={`border-l-4 p-3 rounded ${
                                  isMatched 
                                    ? 'border-green-500 bg-green-50' 
                                    : 'border-yellow-500 bg-yellow-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isMatched ? (
                                    <FaCheckCircle className="text-green-600" />
                                  ) : (
                                    <FaExclamationCircle className="text-yellow-600" />
                                  )}
                                  <code className="text-sm font-semibold">{citation.text}</code>
                                  <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                    Line {citation.line}
                                  </span>
                                </div>
                                {citation.author && (
                                  <p className="text-xs text-gray-600 mt-1 ml-6">
                                    Author: {citation.author}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                          {citationAnalysis.citations.length > 5 && (
                            <p className="text-xs text-gray-500 text-center">
                              + {citationAnalysis.citations.length - 5} more citations
                            </p>
                          )}
                        </div>
                      )}

                      {/* Recommendations */}
                      {citationAnalysis.unmatched_citations > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start gap-2">
                            <FaExclamationCircle className="text-yellow-600 mt-1" />
                            <div>
                              <h4 className="font-semibold text-yellow-900 text-sm">
                                Action Required
                              </h4>
                              <p className="text-xs text-yellow-800 mt-1">
                                {citationAnalysis.unmatched_citations} citation(s) do not have 
                                matching entries in the reference list. Consider adding them to 
                                ensure proper academic formatting.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <FaQuoteRight className="text-4xl text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Click to analyze document citations</p>
                      <button
                        onClick={analyzeCitations}
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        <FaQuoteRight />
                        Analyze Citations
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3">
          {formattedContent ? (
            <>
              <button
                onClick={() => {
                  setFormattedContent(null)
                  setAppliedRules([])
                  setError('')
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Format Another Style
              </button>
              <button
                onClick={handleCopyFormatted}
                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <FaCopy />
                {copySuccess ? 'Copied!' : 'Copy Text'}
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                disabled={!!downloading || !(aiResult?.plain_sections?.length)}
                title={!(aiResult?.plain_sections?.length) ? 'Re-format the document to enable PDF/DOCX download' : undefined}
                className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {downloading === 'pdf' ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                PDF
              </button>
              <button
                onClick={() => handleDownload('docx')}
                disabled={!!downloading || !(aiResult?.plain_sections?.length)}
                title={!(aiResult?.plain_sections?.length) ? 'Re-format the document to enable PDF/DOCX download' : undefined}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {downloading === 'docx' ? <FaSpinner className="animate-spin" /> : <FaFileWord />}
                Word
              </button>
              <button
                onClick={() => handleDownload('tex')}
                disabled={!!downloading || !aiResult?.latex}
                className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {downloading === 'tex' ? <FaSpinner className="animate-spin" /> : <FaCode />}
                LaTeX
              </button>
              {isModal && onClose && (
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  Close
                </button>
              )}
            </>
          ) : (
            <>
              {isModal && onClose && (
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              )}
              {/* Large-document mode toggle */}
              <div className="w-full flex items-center gap-3 mb-1">
                <button
                  type="button"
                  onClick={() => setLargeDocMode(v => !v)}
                  className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    largeDocMode
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                      : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  <FaTasks className={largeDocMode ? 'text-indigo-600' : 'text-gray-400'} />
                  {largeDocMode ? 'Large-Doc Pipeline ON' : 'Large-Doc Pipeline (100+ pages)'}
                </button>
                {largeDocMode && (
                  <span className="text-xs text-indigo-500">Stateful · chunked · resumable</span>
                )}
              </div>

              {/* Progress panel (large-doc mode only) */}
              {formatting && largeDocMode && progress && (
                <div className="w-full bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-1">
                  <div className="flex justify-between text-xs font-medium text-indigo-800 mb-1">
                    <span>
                      {progress.complete
                        ? '✓ Complete'
                        : progress.total > 0
                          ? `Stage ${progress.stage} · Chunk ${progress.chunk} / ${progress.total}`
                          : `Stage ${progress.stage}`}
                    </span>
                    <span>{progress.repairs > 0 && `${progress.repairs} repairs`}</span>
                  </div>
                  {progress.total > 0 && !progress.complete && (
                    <div className="w-full bg-indigo-200 rounded-full h-2 mb-1">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (progress.chunk / progress.total) * 100)}%` }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-indigo-600 truncate">{progress.section}</p>
                </div>
              )}

              <button
                onClick={handleApplyFormatting}
                disabled={formatting}
                className="flex-1 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formatting ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    {largeDocMode ? (progress?.total > 0 ? `${progress.chunk}/${progress.total} chunks…` : 'Processing…') : 'Formatting...'}
                  </>
                ) : (
                  <>
                    <FaBook />
                    {largeDocMode ? 'Format Large Document' : 'Apply Formatting'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DocumentFormatter
