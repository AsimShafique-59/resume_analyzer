import { useState } from 'react'
import { generateCoverLetter } from '../api'
import useResumeLibrary from '../useResumeLibrary'

const UPLOAD_NEW = 'upload-new'

export default function CoverLetter() {
  const [library, refreshLibrary] = useResumeLibrary()
  const [jobDescription, setJobDescription] = useState('')
  const [source, setSource] = useState(UPLOAD_NEW)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit() {
    const resumeId = source === UPLOAD_NEW ? null : Number(source)
    if (!jobDescription || (resumeId === null && !file)) {
      setError('Add a job description and pick or upload a resume.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await generateCoverLetter(jobDescription, resumeId === null ? file : null, resumeId))
      refreshLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Generate cover letter &amp; feedback</h2>
      <p className="hint">Get a tailored cover letter plus resume feedback for a specific job.</p>

      <label className="field-label" htmlFor="clJob">
        Job description
      </label>
      <textarea
        id="clJob"
        placeholder="Paste the job description here..."
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
      />

      <label className="field-label" htmlFor="clSource">
        Resume
      </label>
      <select id="clSource" value={source} onChange={(e) => setSource(e.target.value)}>
        <option value={UPLOAD_NEW}>Upload a new file…</option>
        {library.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name || r.filename}
          </option>
        ))}
      </select>

      {source === UPLOAD_NEW && (
        <input id="clFile" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files[0] ?? null)} />
      )}

      <button className="run" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Generating…' : 'Generate'}
      </button>

      <div className="result">
        {error && <p className="status error">{error}</p>}
        {result && (
          <>
            <div className="cover-letter-text">{result.cover_letter}</div>
            <div className="section-label">Resume feedback</div>
            <ul className="feedback">
              {(result.feedback || []).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
