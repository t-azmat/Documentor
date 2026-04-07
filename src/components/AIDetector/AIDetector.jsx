import { useState } from 'react'
import {
  FaRobot, FaTimes, FaUpload, FaSpinner, FaFileAlt,
  FaCheckCircle, FaExclamationTriangle, FaExclamationCircle, FaInfoCircle, FaArrowRight,
} from 'react-icons/fa'
import { fileExtractorAPI } from '../../services/pythonNlpService'

const NLP_URL = import.meta.env.VITE_NLP_API_URL || 'http://localhost:5001'

// isModal=true -> fixed overlay; isModal=false -> inline page card
const AIDetector = ({ document: propDocument, onClose, isModal = !!onClose }) => {
  const [text, setText] = useState(propDocument?.content?.raw || propDocument?.content || '')
  const [docTitle, setDocTitle] = useState(propDocument?.title || '')
  const [loading, setLoading] = useState(false)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const handleDocUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLoadingDoc(true)
    setError('')
    try {
      const response = await fileExtractorAPI.extractText(file)
      if (response.data.success) {
        setText(response.data.text)
        setDocTitle(file.name)
      } else {
        setError(response.data.error || 'Failed to extract text')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to read file: ' + err.message)
    } finally {
      setLoadingDoc(false)
    }
  }

  const handleDetect = async () => {
    if (!text.trim() || text.trim().length < 80) {
      setError('Please provide at least 80 characters of text to analyze')
      return
    }
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const response = await fetch(`${NLP_URL}/api/ai-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Detection failed')
      setResults(data)
    } catch (err) {
      setError(err.message || 'Failed to run AI detection')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (s) =>
    s >= 75 ? 'text-red-600' : s >= 55 ? 'text-orange-500' : s >= 40 ? 'text-yellow-600' : 'text-green-600'
  const barColor = (s) =>
    s >= 75 ? 'bg-red-500' : s >= 55 ? 'bg-orange-400' : s >= 40 ? 'bg-yellow-400' : 'bg-green-500'
  const scoreBg = (s) =>
    s >= 75 ? 'bg-red-50 border-red-200' : s >= 55 ? 'bg-orange-50 border-orange-200' : s >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
  const ScoreIcon = ({ s }) =>
    s >= 55 ? <FaExclamationTriangle className="text-orange-500" /> :
    s >= 40 ? <FaExclamationCircle className="text-yellow-500" /> :
    <FaCheckCircle className="text-green-500" />

  const inner = (
    <div className={`bg-white ${isModal ? 'rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl' : 'rounded-xl shadow-sm border border-gray-200'}`}>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <FaRobot className="text-3xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">AI Text Detector</h2>
              <p className="text-purple-100 text-sm mt-1">Detect ChatGPT / AI-generated content using multi-feature analysis</p>
            </div>
          </div>
          {isModal && onClose && (
            <button onClick={onClose} className="p-2 hover:bg-purple-500 rounded-lg transition-colors">
              <FaTimes className="text-xl" />
            </button>
          )}
        </div>
      </div>

      <div className={`${isModal ? 'flex-1 overflow-y-auto' : ''} p-6 space-y-5`}>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <FaExclamationCircle className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {!results ? (
          <>
            {/* Document input */}
            {!propDocument ? (
              <div className={`border-2 rounded-xl p-5 ${text ? 'border-green-300 bg-green-50' : 'border-purple-200 bg-purple-50'}`}>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FaFileAlt className="text-purple-600" /> Document to Analyze
                </h3>
                {text ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaCheckCircle className="text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">{docTitle || 'Text loaded'}</p>
                        <p className="text-xs text-gray-500">{text.trim().split(/\s+/).length} words · {text.length} characters</p>
                      </div>
                    </div>
                    <button onClick={() => { setText(''); setDocTitle('') }}
                      className="text-sm text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:bg-purple-100 cursor-pointer text-sm font-medium">
                      {loadingDoc ? <FaSpinner className="animate-spin" /> : <FaUpload />}
                      {loadingDoc ? 'Reading file...' : 'Upload PDF, DOCX, TXT, LaTeX'}
                      <input type="file" accept=".pdf,.docx,.txt,.tex,.latex"
                        onChange={handleDocUpload} className="hidden" disabled={loadingDoc} />
                    </label>
                    <p className="text-center text-xs text-gray-400">or paste text below</p>
                    <textarea
                      value={text}
                      onChange={e => { setText(e.target.value); if (!docTitle) setDocTitle('Pasted text') }}
                      placeholder="Paste the text you want to analyze for AI content..."
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
                <FaFileAlt className="text-purple-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">{propDocument.title}</p>
                  <p className="text-xs text-gray-500">{text.length} characters</p>
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex gap-3">
              <FaInfoCircle className="text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-purple-800 space-y-1">
                <p className="font-semibold">Multi-feature AI Detection:</p>
                <p><strong>Sentence burstiness</strong> — AI writes uniformly; humans mix short/long sentences</p>
                <p><strong>Sentence variance (CV)</strong> — very low variance indicates AI text</p>
                <p><strong>Filler phrase density</strong> — ChatGPT overuses formal transition phrases</p>
                <p><strong>GPT-2 perplexity</strong> — supplementary signal</p>
              </div>
            </div>

            <button onClick={handleDetect} disabled={loading || text.trim().length < 80}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-3">
              {loading
                ? <><FaSpinner className="animate-spin" /> Analyzing text...</>
                : <><FaRobot /> Detect AI Content <FaArrowRight /></>}
            </button>
          </>
        ) : (
          /* ── RESULTS ── */
          <>
            {/* Big score */}
            <div className={`border-2 rounded-2xl p-6 text-center ${scoreBg(results.ai_score)}`}>
              <p className="text-xs uppercase font-semibold text-gray-500 mb-2">AI Probability Score</p>
              <p className={`text-7xl font-black mb-1 ${scoreColor(results.ai_score)}`}>
                {results.ai_score ?? '--'}%
              </p>
              <div className="w-full max-w-xs mx-auto h-3 bg-gray-200 rounded-full overflow-hidden my-3">
                <div className={`h-full rounded-full ${barColor(results.ai_score)}`} style={{ width: `${results.ai_score}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 max-w-xs mx-auto mb-3">
                <span>Human</span><span>Uncertain</span><span>AI</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <ScoreIcon s={results.ai_score} />
                <p className="text-xl font-bold text-gray-900">{results.ai_label}</p>
              </div>
            </div>

            {/* Feature breakdown */}
            {results.ai_features && Object.keys(results.ai_features).length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Feature Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {results.ai_features.burstiness != null && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">Sentence Burstiness</p>
                      <p className={`text-xl font-bold ${results.ai_features.burstiness < -0.2 ? 'text-red-600' : results.ai_features.burstiness > 0.2 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {results.ai_features.burstiness}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {results.ai_features.burstiness < -0.2 ? 'Uniform → AI' : results.ai_features.burstiness > 0.2 ? 'Varied → Human' : 'Mixed signal'}
                      </p>
                    </div>
                  )}
                  {results.ai_features.sentence_cv != null && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">Sentence Variance (CV)</p>
                      <p className={`text-xl font-bold ${results.ai_features.sentence_cv < 0.4 ? 'text-red-600' : results.ai_features.sentence_cv > 0.6 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {results.ai_features.sentence_cv}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {results.ai_features.sentence_cv < 0.4 ? 'Too uniform → AI' : 'Natural variation'}
                      </p>
                    </div>
                  )}
                  {results.ai_features.mean_sentence_len != null && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">Avg Sentence Length</p>
                      <p className="text-xl font-bold text-gray-700">{results.ai_features.mean_sentence_len}</p>
                      <p className="text-xs text-gray-500 mt-1">{results.ai_features.sentence_count} sentences</p>
                    </div>
                  )}
                  {results.ai_features.filler_density != null && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">Filler Phrase Density</p>
                      <p className={`text-xl font-bold ${results.ai_features.filler_density > 0.3 ? 'text-red-600' : 'text-gray-700'}`}>
                        {(results.ai_features.filler_density * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {results.ai_features.filler_density > 0.3 ? 'High → AI' : 'Normal'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {results.ai_perplexity != null && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                GPT-2 perplexity: <strong>{results.ai_perplexity}</strong> (supplementary signal — low perplexity alone does not indicate AI for modern LLM outputs)
              </p>
            )}

            {/* What this means */}
            <div className={`border rounded-xl p-4 ${scoreBg(results.ai_score)}`}>
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <ScoreIcon s={results.ai_score} /> What this means
              </h4>
              {results.ai_score >= 75 ? (
                <ul className="text-sm text-red-800 space-y-1">
                  <li>Strong indicators of AI-generated text found</li>
                  <li>Sentence structure is unusually uniform — typical of ChatGPT/GPT-4</li>
                  <li>Multiple AI-typical filler phrases detected</li>
                </ul>
              ) : results.ai_score >= 55 ? (
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>Some AI-typical patterns found — may be AI-assisted writing</li>
                  <li>Consider reviewing sentence variety and removing filler phrases</li>
                </ul>
              ) : results.ai_score >= 40 ? (
                <p className="text-sm text-yellow-800">Mixed signals — the text shows both human and AI-like patterns. Inconclusive.</p>
              ) : (
                <p className="text-sm text-green-800">Text appears to be human-written. Sentence structure and vocabulary show natural variation.</p>
              )}
            </div>

            <button onClick={() => setResults(null)}
              className="w-full py-3 border border-purple-300 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition-colors">
              Analyze Another Document
            </button>
          </>
        )}
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
  return <div className="max-w-3xl mx-auto">{inner}</div>
}

export default AIDetector
