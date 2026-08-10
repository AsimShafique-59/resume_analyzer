import { useState } from 'react'
import { parseResume } from '../api'
import ProfileGrid from './ProfileGrid'

export default function ParseResume() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)

  async function handleSubmit() {
    if (!file) {
      setError('Choose a resume file first.')
      return
    }
    setLoading(true)
    setError(null)
    setProfile(null)
    try {
      setProfile(await parseResume(file))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Parse a resume</h2>
      <p className="hint">Extract a structured candidate profile from a PDF or DOCX resume.</p>

      <label className="field-label" htmlFor="parseFile">
        Resume file
      </label>
      <input
        id="parseFile"
        type="file"
        accept=".pdf,.docx"
        onChange={(e) => setFile(e.target.files[0] ?? null)}
      />

      <button className="run" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Parsing…' : 'Parse resume'}
      </button>

      <div className="result">
        {error && <p className="status error">{error}</p>}
        {profile && (
          <>
            <p className="status">Saved to your resume library — pick it from Match &amp; Rank or Cover Letter.</p>
            <ProfileGrid profile={profile} />
          </>
        )}
      </div>
    </div>
  )
}
