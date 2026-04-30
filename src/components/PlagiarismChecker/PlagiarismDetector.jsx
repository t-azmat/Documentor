import { useState } from 'react'
import {
  FaSearch, FaTimes, FaExclamationTriangle, FaCheckCircle,
  FaInfoCircle, FaFileAlt, FaLink, FaSpinner,
  FaExclamationCircle, FaUpload, FaDatabase, FaChartBar, FaArrowRight,
  FaGlobe, FaExternalLinkAlt,
} from 'react-icons/fa'
import { fileExtractorAPI } from '../../services/pythonNlpService'
import api from '../../services/api'

// isModal: true  -> renders as fixed overlay (from DocumentWorkspace)
// isModal: false -> renders as full page (from Plagiarism.jsx)
const PlagiarismDetector = ({ document: propDocument, onClose, isModal = !!onClose }) => {
  // Step 0 - load the document to check (only when no propDocument given)
  const [docText, setDocText] = useState(propDocument?.content?.raw || propDocument?.content || '')
  const [docTitle, setDocTitle] = useState(propDocument?.title || '')
  const [docLoading, setDocLoading] = useState(false)

  // Step 1 - sources
  const [sources, setSources] = useState([{ name: '', text: '' }])

  // Step 2 - results
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  // Online (Wikipedia / Web) check
  const [onlineResults, setOnlineResults] = useState(null)
  const [onlineChecking, setOnlineChecking] = useState(false)
  const [onlineError, setOnlineError] = useState('')

  const [referenceLibrary, setReferenceLibrary] = useState(() => {
    try { return JSON.parse(localStorage.getItem('plagiarism_reference_library') || '[]') }
    catch { return [] }
  })

  const removeFromLibrary = (id) => {
    const updated = referenceLibrary.filter(r => r.id !== id)
    setReferenceLibrary(updated)
    localStorage.setItem('plagiarism_reference_library', JSON.stringify(updated))
  }

  const useAsSource = (entry) => {
    const emptyIdx = sources.findIndex(s => s.text.trim() === '')
    const updated = [...sources]
    if (emptyIdx !== -1) updated[emptyIdx] = { name: entry.name, text: entry.text }
    else updated.push({ name: entry.name, text: entry.text })
    setSources(updated)
  }

  const handleSourceChange = (index, field, value) => {
    const updated = [...sources]
    updated[index] = { ...updated[index], [field]: value }
    setSources(updated)
  }

  const handleDocUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setDocLoading(true)
    setError('')
    try {
      const response = await fileExtractorAPI.extractText(file)
      if (response.data.success) {
        setDocText(response.data.text)
        setDocTitle(file.name)
      } else {
        setError(response.data.error || 'Failed to extract text')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to read file: ' + err.message)
    } finally {
      setDocLoading(false)
    }
  }

  const handleSourceFileUpload = async (e, index) => {
    const file = e.target.files[0]
    if (!file) return
    setChecking(true)
    setError('')
    try {
      const response = await fileExtractorAPI.extractText(file)
      if (response.data.success) {
        const updated = [...sources]
        updated[index] = { name: file.name, text: response.data.text }
        setSources(updated)
      } else {
        setError(response.data.error || 'Failed to extract text')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load file: ' + err.message)
    } finally {
      setChecking(false)
    }
  }

  const handleOnlineCheck = async () => {
    if (!docText.trim()) { setOnlineError('No document content to check'); return }
    setOnlineChecking(true)
    setOnlineError('')
    setOnlineResults(null)
    try {
      const response = await api.post('/plagiarism/check-online', { text: docText, threshold: 0.72 })
      const data = response.data
      if (!data.success) throw new Error(data.error || 'Online check failed')
      setOnlineResults(data.data)
    } catch (err) {
      setOnlineError(err.response?.data?.error || err.message || 'Failed to run online check')
    } finally {
      setOnlineChecking(false)
    }
  }

  const handleCheck = async () => {
    const validSources = sources.filter(s => s.text.trim().length > 0).map((s, i) => ({
      name: s.name || `Source ${i + 1}`,
      text: s.text.trim()
    }))
    if (validSources.length === 0) { setError('Please provide at least one source text'); return }
    if (!docText.trim()) { setError('No document content to check'); return }
    setChecking(true)
    setError('')
    setResults(null)
    try {
      const response = await api.post('/plagiarism/studio', { text: docText, sources: validSources })
      const data = response.data
      if (!data.success) throw new Error(data.error || 'Check failed')
      setResults(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to check plagiarism')
    } finally {
      setChecking(false)
    }
  }

  const scoreColor = (pct) => {
    if (pct >= 75) return 'text-red-600'
    if (pct >= 50) return 'text-orange-500'
    if (pct >= 25) return 'text-yellow-600'
    return 'text-green-600'
  }
  const scoreBg = (pct) => {
    if (pct >= 75) return 'bg-red-50 border-red-200'
    if (pct >= 50) return 'bg-orange-50 border-orange-200'
    if (pct >= 25) return 'bg-yellow-50 border-yellow-200'
    return 'bg-green-50 border-green-200'
  }
  const scoreLabel = (pct) => {
    if (pct >= 75) return { text: 'High', cls: 'bg-red-100 text-red-800' }
    if (pct >= 50) return { text: 'Medium', cls: 'bg-orange-100 text-orange-800' }
    if (pct >= 25) return { text: 'Low', cls: 'bg-yellow-100 text-yellow-800' }
    return { text: 'Minimal', cls: 'bg-green-100 text-green-800' }
  }

  const inner = (
    <div className={`bg-white ${isModal ? 'rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl' : 'rounded-xl shadow-sm border border-gray-200'}`}>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <FaSearch className="text-3xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Plagiarism Detection</h2>
              <p className="text-blue-100 text-sm mt-1">Cosine (TF-IDF) + BERT Semantic similarity</p>
            </div>
          </div>
          {isModal && onClose && (
            <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded-lg transition-colors">
              <FaTimes className="text-xl" />
            </button>
          )}
        </div>
      </div>

      <div className={`${isModal ? 'flex-1 overflow-y-auto' : ''} p-6 space-y-6`}>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <FaExclamationCircle className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* STEP 0 - Load document to check (only when no prop document) */}
        {!propDocument && (
          <div className={`border-2 rounded-xl p-5 ${docText ? 'border-green-300 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FaFileAlt className="text-blue-600" />
              Step 1 — Document to Check
            </h3>
            {docText ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaCheckCircle className="text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{docTitle || 'Document loaded'}</p>
                    <p className="text-xs text-gray-500">{docText.trim().split(/\s+/).length} words</p>
                  </div>
                </div>
                <button onClick={() => { setDocText(''); setDocTitle('') }}
                  className="text-sm text-red-500 hover:text-red-700">Remove</button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-100 cursor-pointer text-sm font-medium">
                  {docLoading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
                  {docLoading ? 'Reading file...' : 'Upload PDF, DOCX, TXT, LaTeX'}
                  <input type="file" accept=".pdf,.docx,.txt,.tex,.latex"
                    onChange={handleDocUpload} className="hidden" disabled={docLoading} />
                </label>
                <p className="text-center text-xs text-gray-400">or paste text below</p>
                <textarea
                  value={docText}
                  onChange={e => { setDocText(e.target.value); if (!docTitle) setDocTitle('Pasted text') }}
                  placeholder="Paste the document text you want to check..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Show document info when comes via prop */}
        {propDocument && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <FaFileAlt className="text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900">{propDocument?.title || 'Untitled'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{docText.length} characters</p>
            </div>
          </div>
        )}

        {!results ? (
          <>
            {/* Reference Library */}
            {referenceLibrary.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FaDatabase className="text-orange-500" />
                    Reference Library
                    {!propDocument && <span className="text-xs text-gray-500 font-normal">— Step 2</span>}
                  </h3>
                  <span className="text-xs text-gray-500">{referenceLibrary.length} saved</span>
                </div>
                <div className="space-y-2">
                  {referenceLibrary.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between bg-white border border-orange-100 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FaFileAlt className="text-orange-400 flex-shrink-0 text-sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{entry.name}</p>
                          <p className="text-xs text-gray-400">{Math.round(entry.text.split(/\s+/).length)} words</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3 flex-shrink-0">
                        <button onClick={() => useAsSource(entry)} disabled={checking}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg">
                          Use as Source
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Remove "${entry.name}" from library?`)) removeFromLibrary(entry.id) }}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <FaTimes className="text-xs" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FaLink className="text-blue-600" />
                  {propDocument ? 'Source Documents to Check Against' : 'Step 3 — Sources to Check Against'}
                </h3>
                <span className="text-sm text-gray-500">{sources.filter(s => s.text.trim()).length} active</span>
              </div>

              {sources.map((src, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="text" value={src.name}
                      onChange={e => handleSourceChange(idx, 'name', e.target.value)}
                      placeholder={`Source ${idx + 1} name`}
                      className="flex-1 min-w-0 text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={checking} />
                    <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 flex-shrink-0">
                      <FaUpload className="text-xs" /> Upload
                      <input type="file" accept=".pdf,.docx,.txt,.tex,.latex"
                        onChange={e => handleSourceFileUpload(e, idx)} className="hidden" disabled={checking} />
                    </label>
                    {sources.length > 1 && (
                      <button onClick={() => setSources(sources.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 text-sm flex-shrink-0" disabled={checking}>Remove</button>
                    )}
                  </div>
                  <textarea value={src.text}
                    onChange={e => handleSourceChange(idx, 'text', e.target.value)}
                    placeholder="Paste source text here or upload a file..."
                    rows={4} disabled={checking}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-none" />
                  <p className="text-xs text-gray-400">{src.text.trim() ? src.text.trim().split(/\s+/).length : 0} words</p>
                </div>
              ))}

              <button onClick={() => setSources([...sources, { name: '', text: '' }])} disabled={checking}
                className="w-full py-2 border border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium disabled:opacity-50">
                + Add Another Source
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <FaInfoCircle className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 space-y-1">
                <p className="font-semibold">Three-layer PlagiarismStudio analysis:</p>
                <p><strong>Cosine (TF-IDF)</strong> — surface word overlap</p>
                <p><strong>BERT Semantic</strong> — paraphrase / meaning similarity</p>
                <p className="text-blue-600 text-xs">Tip: use AI Detector for AI-content detection</p>
              </div>
            </div>

            <button onClick={handleCheck} disabled={checking || !docText.trim()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-3">
              {checking
                ? <><FaSpinner className="animate-spin" /> Analyzing... (BERT + AI may take a moment)</>
                : <><FaSearch /> Run Plagiarism Check <FaArrowRight /></>}
            </button>
          </>
        ) : (
          /* ── RESULTS ── */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Highest Similarity</p>
                <p className={`text-4xl font-bold ${scoreColor(results.max_similarity)}`}>
                  {results.max_similarity?.toFixed(1) ?? '--'}%
                </p>
                <p className="text-xs text-gray-500 mt-1">across {results.sources.length} source(s)</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">BERT Analysis</p>
                <p className={`text-2xl font-bold ${results.bert_available ? 'text-green-700' : 'text-gray-400'}`}>
                  {results.bert_available ? 'Active' : 'Unavailable'}
                </p>
                <p className="text-xs text-gray-500 mt-1">semantic similarity</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FaChartBar className="text-blue-600" /> Per-Source Breakdown
              </h3>
              {results.sources.map((src, idx) => {
                const overall = src.overall ?? src.cosine ?? 0
                const lbl = scoreLabel(overall)
                return (
                  <div key={idx} className={`border rounded-xl p-5 ${scoreBg(overall)}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FaFileAlt className="text-gray-400" />
                        <p className="font-semibold text-gray-900">{src.name}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${lbl.cls}`}>{lbl.text} Risk</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Cosine (TF-IDF)</p>
                        <p className={`text-2xl font-bold ${scoreColor(src.cosine ?? 0)}`}>
                          {src.cosine != null ? `${src.cosine}%` : '--'}
                        </p>
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${src.cosine ?? 0}%` }} />
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">BERT Semantic</p>
                        {src.bert != null ? (
                          <>
                            <p className={`text-2xl font-bold ${scoreColor(src.bert)}`}>{src.bert}%</p>
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${src.bert}%` }} />
                            </div>
                          </>
                        ) : <p className="text-sm text-gray-400 mt-1">Not available</p>}
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Overall Score</p>
                        <p className={`text-2xl font-bold ${scoreColor(overall)}`}>{overall}%</p>
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${overall >= 75 ? 'bg-red-400' : overall >= 50 ? 'bg-orange-400' : overall >= 25 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${overall}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={`border rounded-xl p-5 ${results.max_similarity >= 75 ? 'bg-red-50 border-red-200' : results.max_similarity >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                {results.max_similarity >= 75 ? <FaExclamationTriangle className="text-red-500" /> :
                 results.max_similarity >= 50 ? <FaExclamationCircle className="text-yellow-500" /> :
                 <FaCheckCircle className="text-green-500" />}
                Recommendation
              </h3>
              {results.max_similarity >= 75 ? (
                <ul className="text-sm text-red-800 space-y-1">
                  <li>Significant similarity found — rewrite flagged sections</li>
                  <li>Add proper citations for paraphrased content</li>
                  <li>Use quotation marks for directly copied text</li>
                </ul>
              ) : results.max_similarity >= 50 ? (
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>Moderate similarity — review source comparisons above</li>
                  <li>Ensure proper paraphrasing and attribution</li>
                </ul>
              ) : (
                <p className="text-sm text-green-800">Low similarity detected. Your document appears largely original.</p>
              )}
            </div>

            <button onClick={() => { setResults(null); setOnlineResults(null) }}
              className="w-full py-3 border border-blue-300 text-blue-600 rounded-xl font-medium hover:bg-blue-50 transition-colors">
              Check Again with Different Sources
            </button>
          </>
        )}

        {/* ── Wikipedia & Web Check Panel ── */}
        <div className="border-t border-gray-200 pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FaGlobe className="text-indigo-600" /> Wikipedia &amp; Web Check
            </h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">No sources needed</span>
          </div>
          <p className="text-xs text-gray-500">
            Automatically searches Wikipedia and web sources for content similar to your document.
            May take 15–30 seconds.
          </p>

          {onlineError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-800">
              <FaExclamationCircle className="text-red-500 flex-shrink-0 mt-0.5" />
              {onlineError}
            </div>
          )}

          <button
            onClick={handleOnlineCheck}
            disabled={onlineChecking || !docText.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {onlineChecking
              ? <><FaSpinner className="animate-spin" /> Searching Wikipedia &amp; Web&hellip;</>
              : <><FaGlobe /> Check Wikipedia &amp; Web <FaArrowRight /></>}
          </button>

          {onlineResults && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Online Score</p>
                  <p className={`text-2xl font-bold ${scoreColor(onlineResults.plagiarismPercentage)}`}>
                    {onlineResults.plagiarismPercentage.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Matches</p>
                  <p className="text-2xl font-bold text-gray-700">{onlineResults.matchCount}</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Pages Checked</p>
                  <p className="text-2xl font-bold text-gray-700">{onlineResults.articlesChecked}</p>
                </div>
              </div>

              {onlineResults.matchCount === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-2">
                  <FaCheckCircle className="text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800">No matches found in Wikipedia or web sources.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {onlineResults.matchCount} online match(es) found:
                  </h4>
                  {onlineResults.matches.map((m, i) => (
                    <div key={i} className="bg-white border border-indigo-100 rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <FaLink className="text-indigo-400 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{m.source}</p>
                            {m.url && (
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline flex items-center gap-1"
                              >
                                <FaExternalLinkAlt className="text-xs" /> View source
                              </a>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${scoreColor(m.percentMatch)}`}>
                          {m.percentMatch.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 italic">&ldquo;{m.chunk}&rdquo;</p>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            m.percentMatch >= 75 ? 'bg-red-400' :
                            m.percentMatch >= 50 ? 'bg-orange-400' : 'bg-yellow-400'
                          }`}
                          style={{ width: `${Math.min(m.percentMatch, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        {inner}
      </div>
    )
  }
  return <div className="max-w-5xl mx-auto">{inner}</div>
}

export default PlagiarismDetector
