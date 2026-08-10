import { useState } from 'react'
import { generateCoverLetter } from '../api'

export default function CoverLetter() {
  const [jobDescription, setJobDescription] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit() {
    if (!jobDescription || !file) {
      setError('Add a job description and a resume.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await generateCoverLetter(jobDescription, file))
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

      <label className="field-label" htmlFor="clFile">
        Resume file
      </label>
      <input id="clFile" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files[0] ?? null)} />

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
