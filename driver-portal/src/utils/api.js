export const API_URL = import.meta.env.VITE_API_URL || 'https://api.segecha.com';

export async function uploadFile(file, folder, filename, token) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('filename', filename);
    const res = await fetch(`${API_URL}/api/driver/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Upload failed');
    return data.url;
}
