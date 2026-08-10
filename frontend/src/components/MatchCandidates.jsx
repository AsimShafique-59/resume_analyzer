import { useState } from 'react'
import { matchCandidates } from '../api'
import useResumeLibrary from '../useResumeLibrary'

export default function MatchCandidates() {
  const [library, refreshLibrary] = useResumeLibrary()
  const [jobDescription, setJobDescription] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)

  function toggleId(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSubmit() {
    if (!jobDescription || (!files.length && !selectedIds.length)) {
      setError('Add a job description and at least one resume (library or upload).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setResults(await matchCandidates(jobDescription, files, selectedIds))
      refreshLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Match candidates to a job</h2>
      <p className="hint">Pick resumes from your library and/or upload new ones, then rank them against a job description.</p>

      <label className="field-label" htmlFor="matchJob">
        Job description
      </label>
      <textarea
        id="matchJob"
        placeholder="Paste the job description here..."
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
      />

      {library.length > 0 && (
        <>
          <label className="field-label">Resume library</label>
          <div className="library-list">
            {library.map((r) => (
              <label className="library-item" key={r.id}>
                <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleId(r.id)} />
                {r.name || r.filename}
              </label>
            ))}
          </div>
        </>
      )}

      <label className="field-label" htmlFor="matchFiles">
        Upload new resumes
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
