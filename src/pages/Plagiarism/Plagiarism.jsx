import PlagiarismDetector from '../../components/PlagiarismChecker/PlagiarismDetector'

const Plagiarism = () => {
  return (
    <div className="p-5">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Plagiarism Checker</h1>
          <p className="text-gray-600">
            Upload your document and compare it against source documents using TF-IDF, BERT semantic similarity, and AI detection.
          </p>
        </div>
        <PlagiarismDetector isModal={false} />
      </div>
    </div>
  )
}

export default Plagiarism
