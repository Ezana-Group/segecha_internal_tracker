/**
 * Shared helper for driver portal photo uploads.
 * Used by driver page (trip start/end), fuel page, and expenses page.
 */
export async function uploadDriverPhoto(file: File, folder: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const res = await fetch('/api/upload/driver-photo', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error || 'Photo upload failed')
  }
  const { url } = await res.json()
  return url
}
