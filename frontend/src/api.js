async function postForm(path, form) {
  const res = await fetch('/api' + path, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || res.statusText)
  return data
}

export function parseResume(file) {
  const form = new FormData()
  form.append('file', file)
  return postForm('/parse-resume', form)
}

export function matchCandidates(jobDescription, files, resumeIds = []) {
  const form = new FormData()
  for (const f of files) form.append('resumes', f)
  for (const id of resumeIds) form.append('resume_ids', id)
  return postForm('/match?job_description=' + encodeURIComponent(jobDescription), form)
}

export function generateCoverLetter(jobDescription, file, resumeId = null) {
  const form = new FormData()
  if (file) form.append('resume', file)
  if (resumeId) form.append('resume_id', resumeId)
  return postForm('/cover-letter?job_description=' + encodeURIComponent(jobDescription), form)
}

export async function getDashboard() {
  const res = await fetch('/api/dashboard')
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

export async function listResumes() {
  const res = await fetch('/api/resumes')
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}
