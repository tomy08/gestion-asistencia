import { getStudents, registerAttendance } from './api';

const form = document.querySelector('#attendance-form');
const studentSelect = document.querySelector('#student');
const codeInput = document.querySelector('#code');
const submitBtn = document.querySelector('#submit-btn');
const statusEl = document.querySelector('#status');
const spinner = document.querySelector('#spinner');
const toast = document.querySelector('#toast');

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
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

function getPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

async function loadStudents() {
  try {
    const { students } = await getStudents();
    studentSelect.innerHTML = '<option value="">Selecciona tu nombre</option>';

    students.forEach((student) => {
      const option = document.createElement('option');
      option.value = student;
      option.textContent = student;
      studentSelect.appendChild(option);
    });
  } catch (error) {
    setStatus(error.message, 'error');
    studentSelect.innerHTML = '<option value="">No se pudieron cargar alumnos</option>';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const student = studentSelect.value;
  const code = codeInput.value.trim().toUpperCase();

  if (!student) {
    setStatus('Selecciona un alumno válido.', 'error');
    return;
  }

  if (!/^[A-Z0-9]{5}$/.test(code)) {
    setStatus('El código debe tener 5 caracteres alfanuméricos.', 'error');
    return;
  }

  try {
    setLoading(true);
    setStatus('Obteniendo ubicación GPS...', 'info');
    const position = await getPosition();

    setStatus('Registrando asistencia...', 'info');
    await registerAttendance({
      student,
      code,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    });

    setStatus('Asistencia registrada correctamente.', 'success');
    showToast('¡Asistencia registrada con éxito!', 'success');
    codeInput.value = '';
  } catch (error) {
    setStatus(error.message || 'No se pudo registrar la asistencia.', 'error');
    showToast(error.message || 'Error al registrar asistencia', 'error');
  } finally {
    setLoading(false);
  }
});

loadStudents();
