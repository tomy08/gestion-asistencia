import { generateCode, getCurrentCode } from './api';

const passwordInput = document.querySelector('#admin-password');
const generateBtn = document.querySelector('#generate-btn');
const refreshBtn = document.querySelector('#refresh-btn');
const copyLinkBtn = document.querySelector('#copy-link-btn');
const currentCode = document.querySelector('#current-code');
const currentTimestamp = document.querySelector('#current-timestamp');
const statusEl = document.querySelector('#status');
const spinner = document.querySelector('#spinner');
const toast = document.querySelector('#toast');

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  refreshBtn.disabled = isLoading;
  spinner.classList.toggle('hidden', !isLoading);
}

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => {
    toast.className = 'toast hidden';
  }, 2800);
}

function formatTimestamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-PE');
}

async function loadCurrentCode() {
  try {
    setLoading(true);
    const data = await getCurrentCode();
    currentCode.textContent = data.code || '-';
    currentTimestamp.textContent = formatTimestamp(data.timestamp);
    setStatus('Código actualizado.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

generateBtn.addEventListener('click', async () => {
  const password = passwordInput.value;
  if (!password) {
    setStatus('Ingresa la contraseña del docente.', 'error');
    return;
  }

  try {
    setLoading(true);
    const data = await generateCode(password);
    currentCode.textContent = data.code;
    currentTimestamp.textContent = formatTimestamp(data.timestamp);
    setStatus('Nuevo código generado correctamente.', 'success');
    showToast('Código generado', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
    showToast(error.message, 'error');
  } finally {
    setLoading(false);
  }
});

refreshBtn.addEventListener('click', loadCurrentCode);

copyLinkBtn.addEventListener('click', async () => {
  const studentUrl = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/`;
  try {
    await navigator.clipboard.writeText(studentUrl);
    showToast('Link copiado al portapapeles.', 'success');
  } catch {
    showToast('No se pudo copiar el link.', 'error');
  }
});

loadCurrentCode();
