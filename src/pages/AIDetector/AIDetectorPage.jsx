import AIDetector from '../../components/AIDetector/AIDetector'

const AIDetectorPage = () => {
  return (
    <div className="p-5">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Content Detector</h1>
          <p className="text-gray-600">
            Detect ChatGPT and AI-generated text using sentence burstiness, variance analysis, and filler phrase detection.
          </p>
        </div>
        <AIDetector isModal={false} />
      </div>
    </div>
  )
}

export default AIDetectorPage
