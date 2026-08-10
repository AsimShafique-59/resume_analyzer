import { useState } from 'react'
import './App.css'
import ParseResume from './components/ParseResume'
import MatchCandidates from './components/MatchCandidates'
import CoverLetter from './components/CoverLetter'
import Dashboard from './components/Dashboard'

const TABS = [
  { id: 'parse', label: 'Parse Resume' },
  { id: 'match', label: 'Match & Rank' },
  { id: 'cover', label: 'Cover Letter' },
  { id: 'dashboard', label: 'Dashboard' },
]

export default function App() {
  const [tab, setTab] = useState('parse')
  const [jobDescription, setJobDescription] = useState('')
  const [results, setResults] = useState(null)

  return (
    <>
      <header className="app-header">
        <span className="eyebrow">AI-Powered</span>
        <h1>Resume &amp; Job-Matching Platform</h1>
        <p>Parse resumes, rank candidates, and generate tailored cover letters in seconds.</p>
      </header>

      <main>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'parse' && <ParseResume />}
        {tab === 'match' && (
          <MatchCandidates
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            results={results}
            setResults={setResults}
          />
        )}
        {tab === 'cover' && <CoverLetter />}
        {tab === 'dashboard' && <Dashboard jobDescription={jobDescription} results={results} />}
      </main>

      <footer>AI Resume &amp; Job-Matching Platform · MVP</footer>
    </>
  )
}
