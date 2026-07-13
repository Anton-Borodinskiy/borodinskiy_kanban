// Minimal "cloud" sync with zero backend: store the workspace JSON in a private
// GitHub Gist. The user supplies a personal-access token with the `gist` scope
// once; we create/update a single secret gist and read it back on other devices.
const API = 'https://api.github.com'
const FILENAME = 'borodinskiy-kanban.json'

function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  }
}

async function failMessage(res) {
  let detail = ''
  try { detail = (await res.json())?.message || '' } catch (_) { /* ignore */ }
  if (res.status === 401) return 'Invalid or expired token (needs the "gist" scope).'
  if (res.status === 404) return 'Gist not found — check the Gist ID.'
  return `GitHub error ${res.status}${detail ? ': ' + detail : ''}`
}

// Create a new gist (no id) or update the existing one. Returns the gist id.
export async function pushGist(token, gistId, data) {
  if (!token) throw new Error('No token set')
  const payload = {
    description: 'Borodinskiy Kanban — workspace backup',
    files: { [FILENAME]: { content: JSON.stringify(data) } }
  }
  const url = gistId ? `${API}/gists/${gistId}` : `${API}/gists`
  const method = gistId ? 'PATCH' : 'POST'
  if (!gistId) payload.public = false
  const res = await fetch(url, { method, headers: authHeaders(token), body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(await failMessage(res))
  const json = await res.json()
  return json.id
}

// Read the workspace JSON back out of the gist.
export async function pullGist(token, gistId) {
  if (!token) throw new Error('No token set')
  if (!gistId) throw new Error('No Gist ID set')
  const res = await fetch(`${API}/gists/${gistId}`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error(await failMessage(res))
  const json = await res.json()
  const file = json.files?.[FILENAME]
  if (!file) throw new Error('This gist has no Kanban backup file.')
  // GitHub truncates large file contents in the gist response; fetch raw if so.
  let content = file.content
  if (file.truncated && file.raw_url) {
    const raw = await fetch(file.raw_url)
    if (!raw.ok) throw new Error('Could not download the full backup.')
    content = await raw.text()
  }
  return JSON.parse(content)
}
