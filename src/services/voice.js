// Push-to-talk audio capture + Whisper transcription
// Pure utility — no imports from other services, no side effects outside this module.
//
// Usage:
//   await startRecording()               — opens mic, starts capture
//   const blob = await stopRecording()   — stops capture, returns audio blob
//   const text = await transcribe(blob, apiKey)  — calls Whisper API, returns string|null

const MIN_BYTES = 1500  // blobs smaller than this are too short to be real speech

let mediaStream = null
let recorder    = null
let chunks      = []

export async function startRecording() {
  if (recorder) return  // already recording — ignore double-calls
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  chunks = []
  recorder = new MediaRecorder(mediaStream)
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  recorder.start()
}

export function stopRecording() {
  return new Promise((resolve) => {
    if (!recorder) { resolve(null); return }
    const r = recorder
    recorder = null
    r.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      chunks = []
      mediaStream?.getTracks().forEach(t => t.stop())
      mediaStream = null
      resolve(blob)
    }
    r.stop()
  })
}

export async function transcribe(blob, apiKey) {
  if (!blob || blob.size < MIN_BYTES) return null
  const form = new FormData()
  form.append('file', new File([blob], 'audio.webm', { type: 'audio/webm' }))
  form.append('model', 'whisper-1')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.text?.trim() || null
}
