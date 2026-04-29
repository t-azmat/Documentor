import { useEffect, useRef, useState } from 'react'
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
import { documentAPI } from '../../services/documentService'
import api from '../../services/api'

const DocumentFormatter = ({ document: propDocument, onClose, onFormatSuccess, isModal: isModalProp }) => {
  const isModal = isModalProp !== undefined ? isModalProp : !!onClose

  const [selectedDocument, setSelectedDocument] = useState(propDocument || null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [availableDocuments, setAvailableDocuments] = useState([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingSelectedDocument, setLoadingSelectedDocument] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const document = propDocument || selectedDocument

  const pollTimerRef = useRef(null)
  const pollingInFlightRef = useRef(false)

  const clearPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollingInFlightRef.current = false
  }

  useEffect(() => {
    if (propDocument?._id) {
      setSelectedDocument(propDocument)
    }
  }, [propDocument])

  useEffect(() => {
    if (propDocument) return

    let alive = true
    const loadDocuments = async () => {
      setLoadingDocuments(true)
      setUploadError('')

      try {
        const response = await documentAPI.getAll({ limit: 100, page: 1 })
        if (!alive) return

        const docs = response.data?.documents || []
        setAvailableDocuments(docs)
        if (docs.length > 0) {
          setSelectedDocumentId((current) => current || docs[0]._id)
        }
      } catch (error) {
        if (!alive) return
        setUploadError(error.response?.data?.message || error.message || 'Failed to load documents')
      } finally {
        if (alive) {
          setLoadingDocuments(false)
        }
      }
    }

    loadDocuments()
    return () => {
      alive = false
    }
  }, [propDocument])

  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [])

  const loadSelectedDocument = async () => {
    if (!selectedDocumentId) {
      setUploadError('Please select a document first')
      return
    }

    setLoadingSelectedDocument(true)
    setUploadError('')

    try {
      const response = await documentAPI.getOne(selectedDocumentId)
      const doc = response.data?.document
      if (!doc) {
        throw new Error('Selected document could not be loaded')
      }
      setSelectedDocument(doc)
    } catch (error) {
      setUploadError(error.response?.data?.message || error.message || 'Failed to load selected document')
    } finally {
      setLoadingSelectedDocument(false)
    }
  }

  // Normalise content — can be a plain string OR { raw: '...' } object
  const docText = typeof document?.content === 'string'
    ? document.content
    : (document?.content?.raw || document?.content?.formatted || '')

  // State Management
  const [engineMode, setEngineMode] = useState('experimental') // 'legacy' | 'experimental'
  const [selectedStyle, setSelectedStyle] = useState('APA')
  const [experimentalStyle, setExperimentalStyle] = useState('ieee')
  const [formatting, setFormatting] = useState(false)
  const [formattedContent, setFormattedContent] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('styles') // 'styles', 'preview', 'rules', 'citations'
  const [appliedRules, setAppliedRules] = useState([])
  const [copySuccess, setCopySuccess] = useState(false)
  const [citationAnalysis, setCitationAnalysis] = useState(null)
  const [analyzingCitations, setAnalyzingCitations] = useState(false)
  const [aiResult, setAiResult]   = useState(null)   // full /ai-format response
  const [downloading, setDownloading] = useState('')  // 'pdf' | 'docx' | 'tex' | ''
  const [largeDocMode, setLargeDocMode] = useState(false)
  const [activeJobId, setActiveJobId] = useState(null)
  const [progress, setProgress] = useState(null)  // null | {stage,chunk,total,section,repairs,complete}
  const [guidelinesFile, setGuidelinesFile] = useState(null)

  const updateProgressFromJob = (job) => {
    const pct = Math.max(0, Math.min(100, job?.progress?.percentage || 0))
    setProgress({
      stage: job?.progress?.stageIndex || 0,
      chunk: job?.progress?.currentChunk || 0,
      total: job?.progress?.totalChunks || 0,
      section: job?.progress?.message || job?.progress?.stageName || 'Processing',
      repairs: job?.progress?.retries || 0,
      complete: job?.status === 'completed',
      percentage: pct,
      status: job?.status || 'queued'
    })
  }

  const hydrateCompletedJob = async (jobId, sourceDocumentId) => {
    const resultResponse = await documentAPI.getFormattingJobResult(jobId)
    const result = resultResponse.data?.result || {}
    const plainSections = Array.isArray(result.plainSections) ? result.plainSections : []

    const normalizedResult = {
      success: true,
      plain_sections: plainSections,
      latex: result.latex || '',
      bib: result.bib || '',
      gap_report: result.gapReport || {},
      citation_stats: result.citationStats || {},
      warnings: result.warnings || [],
      stateful: Boolean(result.stateful),
      chunks_processed: result.metadata?.chunksProcessed || 0,
      total_repairs: result.metadata?.totalRepairs || 0,
      bib_entry_count: result.metadata?.bibEntryCount || 0,
      word_count: result.metadata?.wordCount || 0,
      job_id: jobId
    }

    setAiResult(normalizedResult)

    const plain = plainSections.length > 0
      ? plainSections.map((section) => `== ${section.heading} ==\n${section.text}`).join('\n\n')
      : (
          `✓ Formatting complete via backend job ${jobId}\n\n` +
          `${normalizedResult.chunks_processed || 0} chunks processed · ` +
          `${normalizedResult.bib_entry_count || 0} bibliography entries · ` +
          `${normalizedResult.total_repairs || 0} auto-repairs`
        )

    setFormattedContent(plain)
    setAppliedRules([])
    setActiveTab('preview')
    setFormatting(false)

    if (sourceDocumentId) {
      try {
        const docResponse = await documentAPI.getOne(sourceDocumentId)
        const updatedDoc = docResponse.data?.document
        if (updatedDoc && !propDocument) {
          setSelectedDocument(updatedDoc)
        }
        if (updatedDoc && onFormatSuccess) {
          onFormatSuccess(updatedDoc)
        }
      } catch (refreshError) {
        console.warn('Failed to refresh formatted document:', refreshError)
      }
    }
  }

  const startJobPolling = (jobId, sourceDocumentId) => {
    clearPolling()

    const tick = async () => {
      if (pollingInFlightRef.current) return
      pollingInFlightRef.current = true

      try {
        const statusResponse = await documentAPI.getFormattingJobStatus(jobId)
        const latestJob = statusResponse.data?.job
        if (!latestJob) {
          throw new Error('Missing job status response')
        }

        setActiveJobId(jobId)
        updateProgressFromJob(latestJob)

        if (latestJob.status === 'completed') {
          clearPolling()
          await hydrateCompletedJob(jobId, sourceDocumentId)
          return
        }

        if (latestJob.status === 'failed' || latestJob.status === 'canceled') {
          clearPolling()
          setFormatting(false)
          setError(latestJob.error?.message || latestJob.progress?.message || `Formatting ${latestJob.status}`)
          return
        }
      } catch (statusError) {
        clearPolling()
        setFormatting(false)
        setError(statusError.response?.data?.message || statusError.message || 'Failed to poll formatting job')
      } finally {
        pollingInFlightRef.current = false
      }
    }

    tick()
    pollTimerRef.current = setInterval(tick, 1500)
  }

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

  const experimentalStyles = [
    { id: 'ieee', label: 'IEEE' },
    { id: 'apa', label: 'APA' },
    { id: 'acm', label: 'ACM' },
    { id: 'nature', label: 'Nature' },
    { id: 'elsevier', label: 'Elsevier' },
    { id: 'chicago', label: 'Chicago' }
  ]

  const handleApplyExperimentalFormatting = async () => {
    if (!document?._id) {
      setError('Please select a document before formatting')
      return
    }

    setFormatting(true)
    setError('')
    setFormattedContent(null)
    setAiResult(null)
    setCitationAnalysis(null)
    clearPolling()
    setActiveJobId(null)
    setProgress({
      stage: 1,
      chunk: 0,
      total: 0,
      section: 'Running experimental formatting engine...',
      repairs: 0,
      complete: false,
      percentage: 15,
      status: 'running'
    })

    try {
      const runResponse = await documentAPI.runExperimentalFormattingEngine({
        documentId: document._id,
        targetJournal: experimentalStyle,
        useAi: true,
        guidelinesFile
      })

      const engineResult = runResponse.data?.result || runResponse.data || {}
      const previewSections = Array.isArray(engineResult.preview?.sections)
        ? engineResult.preview.sections
        : []

      const plainSections = []
      if (engineResult.preview?.abstract) {
        plainSections.push({
          heading: 'Abstract',
          text: engineResult.preview.abstract,
          section_level: 1,
          section_type: 'abstract',
          layout_source: 'metadata'
        })
      }
      previewSections.forEach((section) => {
        const subsections = Array.isArray(section.subsections) ? section.subsections : []
        if (subsections.length > 0) {
          subsections.forEach((subsection) => {
            plainSections.push({
              heading: subsection.title || section.title || 'Untitled Section',
              text: (subsection.paragraphs || []).join('\n\n'),
              section_level: 1,
              section_type: 'section',
              layout_source: subsection.layout_source || section.layout_source || 'unknown'
            })
          })
        } else {
          plainSections.push({
            heading: section.title || 'Untitled Section',
            text: (section.paragraphs || []).join('\n\n'),
            section_level: 1,
            section_type: 'section',
            layout_source: section.layout_source || 'unknown'
          })
        }
      })
      if (Array.isArray(engineResult.preview?.references) && engineResult.preview.references.length > 0) {
        plainSections.push({
          heading: 'References',
          text: engineResult.preview.references.map((reference) => reference.formatted || '').filter(Boolean).join('\n'),
          section_level: 1,
          section_type: 'references',
          layout_source: 'layout_references'
        })
      }

      const normalizedResult = {
        success: true,
        experimental: true,
        engine: engineResult.engine || 'new_engine',
        engine_mode: engineResult.engine_mode || 'local_rules',
        plain_sections: plainSections,
        latex: '',
        bib: '',
        warnings: engineResult.warnings || [],
        job_id: null,
        new_engine: {
          run_id: engineResult.run_id,
          engine: engineResult.engine || 'new_engine',
          engine_mode: engineResult.engine_mode || 'local_rules',
          target_style: engineResult.target_style || experimentalStyle,
          available_files: engineResult.available_files || [],
          preview: engineResult.preview || {},
          engine_report: engineResult.preview?.engine_report || {},
          custom_guidelines: engineResult.custom_guidelines || null
        }
      }

      setAiResult(normalizedResult)
      const guidelineRules = [
        ...((engineResult.custom_guidelines?.heading_rules || []).map((rule) => ({
          rule: 'Guide heading rule',
          description: rule,
          applied: true
        }))),
        ...((engineResult.custom_guidelines?.formatting_rules || []).slice(0, 20).map((rule) => ({
          rule: 'Guide formatting rule',
          description: rule,
          applied: true
        })))
      ]

      const summary = previewSections.length > 0
        ? previewSections
            .map((section) => `== ${section.title || 'Untitled Section'} ==\n${(section.paragraphs || []).join('\n\n')}`)
            .join('\n\n')
        : `Experimental formatting complete. Run ID: ${engineResult.run_id || 'N/A'}`

      setFormattedContent(summary)
      setAppliedRules(guidelineRules)
      setActiveTab('preview')
      setProgress({
        stage: 2,
        chunk: 1,
        total: 1,
        section: 'Experimental formatting complete',
        repairs: 0,
        complete: true,
        percentage: 100,
        status: 'completed'
      })
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Experimental formatting failed')
      console.error('Experimental formatting error:', err)
    } finally {
      setFormatting(false)
    }
  }

  const handleApplyFormatting = async () => {
    await handleApplyExperimentalFormatting()
  }

  const handleCancelFormatting = async () => {
    if (!activeJobId) return

    try {
      await documentAPI.cancelFormattingJob(activeJobId)
      clearPolling()
      setFormatting(false)
      setError('Formatting canceled.')
      setProgress((prev) => ({
        ...(prev || {}),
        status: 'canceled',
        section: 'Formatting canceled by user',
        complete: false
      }))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to cancel formatting job')
    }
  }

  const parseFilenameFromDisposition = (disposition, fallbackName) => {
    if (!disposition) return fallbackName
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1])
    }
    const basicMatch = disposition.match(/filename="?([^";]+)"?/i)
    return basicMatch?.[1] || fallbackName
  }

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = filename
    window.document.body.appendChild(anchor)
    anchor.click()
    window.document.body.removeChild(anchor)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const handleDownload = async (fmt) => {
    if (!aiResult) return

    const isExperimentalResult = Boolean(aiResult?.experimental && aiResult?.new_engine?.run_id)
    const jobId = aiResult.job_id || activeJobId
    if (!jobId) {
      if (!isExperimentalResult) {
        setError('Missing job id for download. Please format the document again.')
        return
      }
    }

    setDownloading(fmt)
    setError('')

    const docTitle = (document?.title || 'document')
      .replace(/\.[^.]+$/, '')
      .replace(/\s+/g, '_')

    try {
      let response
      if (isExperimentalResult) {
        const keyMap = { pdf: 'pdf', docx: 'docx', tex: 'tex', ir: 'ir', layout: 'layout' }
        response = await documentAPI.downloadExperimentalFormattingResult(
          aiResult.new_engine.run_id,
          {
            file: keyMap[fmt] || 'docx',
            documentId: document?._id
          }
        )
      } else {
        response = await documentAPI.downloadFormattingJobResult(jobId, fmt)
      }
      const blob = response.data
      const ext = fmt === 'pdf' ? 'pdf' : (fmt === 'docx' ? 'docx' : fmt)
      const styleLabel = isExperimentalResult
        ? (aiResult?.new_engine?.target_style || experimentalStyle).toUpperCase()
        : selectedStyle
      const fallbackName = `${docTitle}_${styleLabel}.${ext}`
      const fileName = parseFilenameFromDisposition(response.headers?.['content-disposition'], fallbackName)
      triggerDownload(blob, fileName)
    } catch (err) {
      setError('Download failed: ' + (err.response?.data?.message || err.message))
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

      const response = await api.post('/citations/match', { text })
      setCitationAnalysis(response.data)
    } catch (err) {
      console.error('Citation analysis error:', err)
      setError('Failed to analyze citations: ' + (err.response?.data?.error || err.message))
    } finally {
      setAnalyzingCitations(false)
    }
  }

  const isExperimentalResult = Boolean(aiResult?.experimental && aiResult?.new_engine?.run_id)
  const experimentalFiles = new Set(aiResult?.new_engine?.available_files || [])
  const layoutSourceLabel = (source) => {
    const value = String(source || '')
    if (value === 'groq_heading_candidates') return 'Groq structured'
    if (value === 'groq_no_headings') return 'Groq checked'
    if (value.includes('ai_cap')) return 'Rule-based cap'
    if (value.includes('rate_limit')) return 'Rule-based limit'
    if (value.includes('no_heading_candidates')) return 'Rule-based'
    if (value.includes('short_section')) return 'Rule-based'
    if (value.startsWith('deterministic')) return 'Rule-based'
    return value || 'Unknown'
  }
  const canDownloadFormat = (fmt) => {
    if (isExperimentalResult) {
      const map = { pdf: 'pdf', docx: 'docx', tex: 'tex', ir: 'ir', layout: 'layout' }
      return experimentalFiles.has(map[fmt] || fmt)
    }
    if (fmt === 'pdf' || fmt === 'docx') {
      return Boolean(aiResult?.plain_sections?.length)
    }
    if (fmt === 'tex') {
      return Boolean(aiResult?.latex)
    }
    return false
  }

  const activeStyleLabel = isExperimentalResult
    ? (aiResult?.new_engine?.target_style || experimentalStyle).toUpperCase()
    : selectedStyle
  const previewMeta = aiResult?.new_engine?.preview || {}
  const previewFont = previewMeta.font || 'Times New Roman'
  const previewBodySize = `${previewMeta.body_size_pt || 12}pt`
  const previewLineHeight = previewMeta.line_spacing ? String(previewMeta.line_spacing) : (activeStyleLabel === 'IEEE' ? '1.15' : '2')
  const previewIndent = Number(previewMeta.first_line_indent_inches || 0)
  const previewRefIndent = Number(previewMeta.reference_hanging_indent_inches || 0.5)
  const previewTextAlign = previewMeta.body_alignment === 'justified' ? 'justify' : (previewMeta.body_alignment || 'left')

  // Page mode — no document yet: select an existing uploaded document
  if (!isModal && !document) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Document Formatter</h1>
          <p className="text-sm text-gray-600 mt-1">Select an uploaded document to start backend formatting jobs</p>
        </div>
        <div className="max-w-xl mx-auto mt-12 bg-white rounded-xl border border-gray-200 p-6">
          {loadingDocuments ? (
            <div className="text-center py-10">
              <FaSpinner className="animate-spin text-4xl text-purple-500 mx-auto mb-4" />
              <p className="text-sm text-gray-600">Loading your documents...</p>
            </div>
          ) : availableDocuments.length === 0 ? (
            <div className="text-center py-10">
              <FaBook className="text-4xl text-purple-400 mx-auto mb-3" />
              <p className="text-sm text-gray-700 font-medium">No documents available</p>
              <p className="text-xs text-gray-500 mt-1">Upload a document first from the Documents page, then return here to format it.</p>
            </div>
          ) : (
            <>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Choose Document</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800"
                value={selectedDocumentId}
                onChange={(e) => setSelectedDocumentId(e.target.value)}
              >
                {availableDocuments.map((doc) => (
                  <option key={doc._id} value={doc._id}>
                    {doc.title}
                  </option>
                ))}
              </select>

              <button
                onClick={loadSelectedDocument}
                disabled={loadingSelectedDocument || !selectedDocumentId}
                className="w-full mt-4 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {loadingSelectedDocument ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Loading Document...
                  </>
                ) : (
                  <>
                    <FaFileAlt />
                    Open Formatter
                  </>
                )}
              </button>
            </>
          )}

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
        {/* Header */}
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

                <div className="mb-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setEngineMode('experimental')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      engineMode === 'experimental'
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    New Engine (Local Rules)
                  </button>
                </div>

                {engineMode === 'experimental' ? (
                  <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-5">
                    <label className="block text-sm font-semibold text-indigo-900 mb-2">
                      Target Journal Style
                    </label>
                    <select
                      className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                      value={experimentalStyle}
                      onChange={(e) => setExperimentalStyle(e.target.value)}
                      disabled={formatting}
                    >
                      {experimentalStyles.map((style) => (
                        <option key={style.id} value={style.id}>
                          {style.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-indigo-700 mt-2">
                      This mode runs the standalone formatting engine and returns preview + artifact downloads.
                    </p>
                    <div className="mt-4 border-t border-indigo-200 pt-4">
                      <label className="block text-sm font-semibold text-indigo-900 mb-2">
                        Document Guidelines
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        disabled={formatting}
                        onChange={(event) => setGuidelinesFile(event.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700 disabled:opacity-60"
                      />
                      {guidelinesFile ? (
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-indigo-800">
                          <span className="truncate">{guidelinesFile.name}</span>
                          <button
                            type="button"
                            onClick={() => setGuidelinesFile(null)}
                            className="text-indigo-700 hover:text-indigo-900"
                            disabled={formatting}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-indigo-700 mt-2">
                          Upload a PDF, DOCX, or TXT guide so the engine can extract custom heading and layout rules.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
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
                )}
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
                      <p className="text-xl font-bold text-purple-700">{activeStyleLabel}</p>
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

                  {isExperimentalResult && aiResult?.new_engine?.engine_report && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                      <p className="text-sm font-semibold text-indigo-900 mb-2">New Engine Layout Mix</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-indigo-700">Groq calls</p>
                          <p className="font-bold text-indigo-950">{aiResult.new_engine.engine_report.groq_called_sections || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-indigo-700">Groq structured</p>
                          <p className="font-bold text-indigo-950">{aiResult.new_engine.engine_report.groq_sections || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-indigo-700">Fallback sections</p>
                          <p className="font-bold text-indigo-950">{aiResult.new_engine.engine_report.fallback_sections || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-indigo-700">Skipped sections</p>
                          <p className="font-bold text-indigo-950">{aiResult.new_engine.engine_report.skipped_sections || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-indigo-700">Total sections</p>
                          <p className="font-bold text-indigo-950">{aiResult.new_engine.engine_report.total_sections || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Formatted Content — styled document preview */}
                  <div
                    className="bg-white border border-gray-300 shadow-sm rounded-lg overflow-y-auto"
                    style={{ maxHeight: '560px', padding: '56px 72px', fontFamily: previewFont, fontSize: previewBodySize, color: '#111' }}
                  >
                    {isExperimentalResult && previewMeta.title && (
                      <div style={{ textAlign: 'center', marginBottom: '1.2em' }}>
                        <p style={{ fontWeight: 'bold', fontSize: `calc(${previewBodySize} + 6pt)`, margin: 0, lineHeight: 1.25 }}>
                          {previewMeta.title}
                        </p>
                        {Array.isArray(previewMeta.authors) && previewMeta.authors.length > 0 && (
                          <p style={{ margin: '0.7em 0 0', lineHeight: 1.25 }}>{previewMeta.authors.join(', ')}</p>
                        )}
                        {previewMeta.affiliation && (
                          <p style={{ margin: '0.4em 0 0', fontStyle: 'italic', lineHeight: 1.25 }}>{previewMeta.affiliation}</p>
                        )}
                      </div>
                    )}
                    {(aiResult?.plain_sections?.length > 0) ? (aiResult.plain_sections || []).map((sec, idx) => {
                      const isRef = sec.section_type === 'references'
                      const isAbs = sec.section_type === 'abstract'
                      const bibLabels = { APA: 'References', MLA: 'Works Cited', IEEE: 'References', Chicago: 'Bibliography', Harvard: 'Reference List' }
                      const renderStyle = activeStyleLabel
                      const headingText = isRef ? (bibLabels[renderStyle] || 'References') : (isAbs ? 'Abstract' : sec.heading)

                      // Per-style heading alignment
                      const hCentre = ['APA', 'MLA', 'Chicago', 'Harvard'].includes(renderStyle)
                      const headingStyle = {
                        fontWeight: 'bold',
                        textAlign: (renderStyle === 'IEEE') ? 'center' : (hCentre ? 'center' : 'left'),
                        fontStyle: 'normal',
                        textTransform: renderStyle === 'IEEE' ? 'uppercase' : 'none',
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

                      const lineH = previewLineHeight
                      const indent = (!isAbs && previewIndent) ? `${previewIndent}in` : '0'

                      return (
                        <div key={idx}>
                          <p style={headingStyle}>
                            {headingText}
                            {isExperimentalResult && sec.layout_source && (
                              <span style={{ marginLeft: '8px', fontSize: '8pt', fontWeight: 'normal', textTransform: 'none', color: '#4f46e5' }}>
                                {layoutSourceLabel(sec.layout_source)}
                              </span>
                            )}
                          </p>
                          {paragraphs.map((para, pIdx) => (
                            <p key={pIdx} style={{ textIndent: indent, margin: 0, textAlign: previewTextAlign, lineHeight: lineH }}>
                              {para}
                            </p>
                          ))}
                          {refEntries.map((entry, eIdx) => (
                            <p key={eIdx} style={{ paddingLeft: `${previewRefIndent}in`, textIndent: `-${previewRefIndent}in`, margin: '0 0 0.1em', textAlign: 'left', lineHeight: lineH }}>
                              {entry}
                            </p>
                          ))}
                        </div>
                      )
                    }) : (
                      <div className="space-y-5">
                        <div>
                          <p style={{ fontWeight: 'bold', textAlign: 'center', margin: 0, lineHeight: '1.8' }}>
                            Formatting Completed
                          </p>
                          <p style={{ marginTop: '14px', marginBottom: 0, whiteSpace: 'pre-wrap', lineHeight: '1.7', textAlign: 'left' }}>
                            {formattedContent || 'Formatting finished successfully. Use LaTeX download for the full output.'}
                          </p>
                        </div>

                        {aiResult?.stateful && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
                            <p className="font-semibold text-blue-900 mb-1">Stateful Pipeline Output</p>
                            <p className="text-blue-800">
                              This job used the large-document stateful formatter. PDF/DOCX preview sections are not generated for this mode, but LaTeX and bibliography artifacts are ready to download.
                            </p>
                          </div>
                        )}

                        {isExperimentalResult && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
                            <p className="font-semibold text-indigo-900 mb-1">New Engine Output</p>
                            <p className="text-indigo-800">
                              Run ID: {aiResult?.new_engine?.run_id || 'N/A'} · Files available: {(aiResult?.new_engine?.available_files || []).join(', ') || 'none'}
                            </p>
                          </div>
                        )}

                        {aiResult?.latex && (
                          <div>
                            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>LaTeX Snippet</p>
                            <pre
                              className="bg-gray-50 border border-gray-200 rounded p-3"
                              style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', lineHeight: '1.5' }}
                            >
                              {aiResult.latex.slice(0, 2000)}
                              {aiResult.latex.length > 2000 ? '\n\n... (truncated; download .tex for full content)' : ''}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Download bar */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-semibold text-gray-700 mr-2">Download as:</span>

                    <button
                      onClick={() => handleDownload('pdf')}
                      disabled={!!downloading || !canDownloadFormat('pdf')}
                      title={!canDownloadFormat('pdf') ? 'PDF artifact is not available for this run' : undefined}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading === 'pdf' ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                      PDF
                    </button>

                    <button
                      onClick={() => handleDownload('docx')}
                      disabled={!!downloading || !canDownloadFormat('docx')}
                      title={!canDownloadFormat('docx') ? 'DOCX artifact is not available for this run' : undefined}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading === 'docx' ? <FaSpinner className="animate-spin" /> : <FaFileWord />}
                      Word (.docx)
                    </button>

                    <button
                      onClick={() => handleDownload('tex')}
                      disabled={!!downloading || !canDownloadFormat('tex')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading === 'tex' ? <FaSpinner className="animate-spin" /> : <FaCode />}
                      LaTeX (.tex)
                    </button>

                    {isExperimentalResult && (
                      <button
                        onClick={() => handleDownload('ir')}
                        disabled={!!downloading || !canDownloadFormat('ir')}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                      >
                        {downloading === 'ir' ? <FaSpinner className="animate-spin" /> : <FaCode />}
                        IR (.json)
                      </button>
                    )}

                    {isExperimentalResult && (
                      <button
                        onClick={() => handleDownload('layout')}
                        disabled={!!downloading || !canDownloadFormat('layout')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
                      >
                        {downloading === 'layout' ? <FaSpinner className="animate-spin" /> : <FaCode />}
                        Layout (.json)
                      </button>
                    )}

                    <span className="text-xs text-gray-500 ml-auto">{activeStyleLabel} style applied</span>
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
                  setAiResult(null)
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
                disabled={!!downloading || !canDownloadFormat('pdf')}
                title={!canDownloadFormat('pdf') ? 'PDF artifact is not available for this run' : undefined}
                className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {downloading === 'pdf' ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                PDF
              </button>
              <button
                onClick={() => handleDownload('docx')}
                disabled={!!downloading || !canDownloadFormat('docx')}
                title={!canDownloadFormat('docx') ? 'DOCX artifact is not available for this run' : undefined}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {downloading === 'docx' ? <FaSpinner className="animate-spin" /> : <FaFileWord />}
                Word
              </button>
              <button
                onClick={() => handleDownload('tex')}
                disabled={!!downloading || !canDownloadFormat('tex')}
                className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {downloading === 'tex' ? <FaSpinner className="animate-spin" /> : <FaCode />}
                LaTeX
              </button>
              {isExperimentalResult && (
                <button
                  onClick={() => handleDownload('ir')}
                  disabled={!!downloading || !canDownloadFormat('ir')}
                  className="flex-1 px-4 py-3 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {downloading === 'ir' ? <FaSpinner className="animate-spin" /> : <FaCode />}
                  IR
                </button>
              )}
              {isExperimentalResult && (
                <button
                  onClick={() => handleDownload('layout')}
                  disabled={!!downloading || !canDownloadFormat('layout')}
                  className="flex-1 px-4 py-3 bg-slate-600 text-white font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {downloading === 'layout' ? <FaSpinner className="animate-spin" /> : <FaCode />}
                  Layout
                </button>
              )}
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
              {engineMode === 'legacy' && (
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
              )}

              {/* Progress panel */}
              {formatting && progress && (
                <div className="w-full bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-1">
                  <div className="flex justify-between text-xs font-medium text-indigo-800 mb-1">
                    <span>
                      {progress.complete
                        ? '✓ Complete'
                        : progress.total > 0
                          ? `Stage ${progress.stage} · Chunk ${progress.chunk} / ${progress.total}`
                          : `Stage ${progress.stage || 0}`}
                    </span>
                    <span>
                      {progress.status ? progress.status.toUpperCase() : ''}
                      {progress.repairs > 0 && ` · retries ${progress.repairs}`}
                    </span>
                  </div>
                  {!progress.complete && (
                    <div className="w-full bg-indigo-200 rounded-full h-2 mb-1">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, progress.percentage || (progress.total > 0 ? Math.min(100, (progress.chunk / progress.total) * 100) : 0))}%` }}
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
                    {progress?.section || 'Formatting...'}
                  </>
                ) : (
                  <>
                    <FaBook />
                    Run New Engine
                  </>
                )}
              </button>

              {engineMode === 'legacy' && formatting && activeJobId && (
                <button
                  onClick={handleCancelFormatting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FaTimes />
                  Cancel Job
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DocumentFormatter
