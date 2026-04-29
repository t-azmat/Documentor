import React from 'react'

const StatCard = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
    <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
  </div>
)

const renderStructureElement = (element, index) => {
  const key = `${element.type || 'item'}-${index}-${String(element.content || '').slice(0, 20)}`

  switch (element.type) {
    case 'heading1':
      return <h1 key={key} className="mt-8 mb-4 text-3xl font-bold text-slate-900">{element.content}</h1>
    case 'heading2':
      return <h2 key={key} className="mt-6 mb-3 text-2xl font-bold text-slate-800">{element.content}</h2>
    case 'heading3':
      return <h3 key={key} className="mt-5 mb-2 text-xl font-semibold text-slate-700">{element.content}</h3>
    case 'list-item':
      return <li key={key} className="ml-5 list-disc text-slate-800">{element.content}</li>
    case 'table': {
      const rows = element.tableData?.data || element.content || []
      return (
        <div key={key} className="my-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full border-collapse bg-white text-sm">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${key}-row-${rowIndex}`} className={rowIndex === 0 ? 'bg-slate-100' : 'border-t border-slate-200'}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${key}-cell-${rowIndex}-${cellIndex}`}
                      className={`px-3 py-2 align-top text-slate-800 ${rowIndex === 0 ? 'font-semibold' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'image':
    case 'figure':
      return (
        <div key={key} className="my-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-700">{element.caption || 'Image / Figure'}</div>
          <div className="mt-1 text-sm text-slate-500">{element.content || element.reference || 'Visual asset detected in extraction.'}</div>
        </div>
      )
    case 'paragraph':
    default:
      return <p key={key} className="mb-4 whitespace-pre-wrap leading-7 text-slate-800">{element.content}</p>
  }
}

const MediaGallery = ({ mediaReferences }) => {
  if (!mediaReferences.length) return null

  return (
    <section className="mt-8">
      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Media</div>
      <div className="grid gap-4 md:grid-cols-2">
        {mediaReferences.map((media, index) => (
          <div key={`media-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {media.relativePath ? (
              <img
                src={`/${media.relativePath.replace(/\\/g, '/')}`}
                alt={media.altText || media.caption || `Media ${index + 1}`}
                className="mb-3 max-h-72 w-full rounded-lg border border-slate-200 object-contain bg-slate-50"
              />
            ) : null}
            <div className="text-sm font-semibold text-slate-800">{media.caption || media.filename || `Media ${index + 1}`}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{media.type || 'image'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

const TocPanel = ({ toc }) => {
  if (!toc.length) return null

  return (
    <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Table Of Contents</div>
      <div className="space-y-2">
        {toc.map((entry, index) => (
          <div
            key={`toc-${index}`}
            className="text-sm text-slate-700"
            style={{ paddingLeft: `${Math.max(0, (entry.level || 1) - 1) * 16}px` }}
          >
            <span className="mr-2 inline-flex min-w-6 justify-center rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-amber-700">
              {entry.level || 1}
            </span>
            {entry.text}
          </div>
        ))}
      </div>
    </aside>
  )
}

const DocumentRenderer = ({ document }) => {
  if (!document) {
    return <div className="italic text-slate-500">No content available</div>
  }

  const content = document.content || {}
  const structure = Array.isArray(content.structure) ? content.structure : []
  const mediaReferences = Array.isArray(content.mediaReferences) ? content.mediaReferences : []
  const toc = Array.isArray(content.tableOfContents) ? content.tableOfContents : []
  const rawContent = content.raw || ''
  const structuredBlocks = Array.isArray(content.structuredBlocks) ? content.structuredBlocks : []
  const docling = content.docling || null
  const extractionBackend = document.metadata?.extractionBackend || 'native'

  if (!structure.length) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="Backend" value={extractionBackend} />
          <StatCard label="Words" value={document.metadata?.wordCount || 0} />
          <StatCard label="Blocks" value={structuredBlocks.length} />
          <StatCard label="TOC Entries" value={toc.length} />
        </div>
        <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-6 font-sans leading-relaxed text-slate-800">
          {rawContent || 'No content available'}
        </pre>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 md:grid-cols-5">
        <StatCard label="Backend" value={extractionBackend} />
        <StatCard label="Words" value={document.metadata?.wordCount || 0} />
        <StatCard label="Blocks" value={structuredBlocks.length} />
        <StatCard label="TOC Entries" value={toc.length} />
        <StatCard label="Media Items" value={mediaReferences.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Structured Preview</div>
            <div className="mt-2 text-sm text-slate-600">
              Rendering extracted structure from {extractionBackend === 'docling' ? 'Docling' : 'the native extractor'}.
            </div>
          </div>
          <div className="prose prose-slate max-w-none">
            {structure.map((element, index) => renderStructureElement(element, index))}
          </div>
          {rawContent && (
            <details className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">Show raw extracted text</summary>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{rawContent}</pre>
            </details>
          )}
        </article>

        <div className="space-y-6">
          <TocPanel toc={toc} />

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Extraction Detail</div>
            <div className="space-y-2 text-sm text-slate-700">
              <div>Structure items: {structure.length}</div>
              <div>Structured blocks: {structuredBlocks.length}</div>
              <div>Has Docling payload: {docling ? 'Yes' : 'No'}</div>
            </div>
            {docling ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-emerald-800">Inspect serialized Docling payload</summary>
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">
                  {JSON.stringify(docling, null, 2)}
                </pre>
              </details>
            ) : null}
          </section>
        </div>
      </div>

      <MediaGallery mediaReferences={mediaReferences} />
    </div>
  )
}

export default DocumentRenderer
