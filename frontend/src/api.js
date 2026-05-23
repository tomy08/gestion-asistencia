const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Ocurrió un error en la solicitud');
  }

  return data;
}

export async function getStudents() {
  return request('/students');
}

export async function registerAttendance(payload) {
  return request('/attendance', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getCurrentCode() {
  return request('/current-code');
}

export async function generateCode(password) {
  return request('/generate-code', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}
