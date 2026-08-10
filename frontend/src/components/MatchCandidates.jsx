import { useState } from 'react'
import { matchCandidates } from '../api'

export default function MatchCandidates() {
  const [jobDescription, setJobDescription] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)

  async function handleSubmit() {
    if (!jobDescription || !files.length) {
      setError('Add a job description and at least one resume.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setResults(await matchCandidates(jobDescription, files))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Match candidates to a job</h2>
      <p className="hint">Upload multiple resumes and rank them against a job description.</p>

      <label className="field-label" htmlFor="matchJob">
        Job description
      </label>
      <textarea
        id="matchJob"
        placeholder="Paste the job description here..."
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
      />

      <label className="field-label" htmlFor="matchFiles">
        Resumes (multiple)
      </label>
      <input
        id="matchFiles"
        type="file"
        accept=".pdf,.docx"
        multiple
        onChange={(e) => setFiles([...e.target.files])}
      />

      <button className="run" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Ranking…' : 'Rank candidates'}
      </button>

      <div className="result">
        {error && <p className="status error">{error}</p>}
        {results &&
          results.map((r, i) => (
            <div className="match-row" key={r.filename}>
              <div className="match-rank">{i + 1}</div>
              <div className="match-info">
                <div className="match-name">{r.profile?.name || r.filename}</div>
                <div className="match-file">{r.filename}</div>
              </div>
              <div className="match-score">
                <span className="pct">{Math.round(r.score * 100)}%</span>
                <div className="bar">
                  <span style={{ width: `${Math.round(r.score * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        {results && !results.length && <p className="status">No results.</p>}
        {results && results.length > 0 && (
          <p className="status" style={{ marginTop: '.75rem' }}>
            See the Dashboard tab for a sortable ranked view.
          </p>
        )}
      </div>
    </div>
  )
}
