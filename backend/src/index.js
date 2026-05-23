import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { generateClassCode, getCurrentCode, getStudents, registerAttendance } from './sheets.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origen no permitido por CORS'));
    }
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/students', async (_req, res) => {
  try {
    const students = await getStudents();
    res.json({ students });
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudieron obtener alumnos.' });
  }
});

app.get('/current-code', async (_req, res) => {
  try {
    const data = await getCurrentCode();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudo obtener el código actual.' });
  }
});

app.post('/attendance', async (req, res) => {
  try {
    const { student, code, latitude, longitude } = req.body || {};

    if (!student || typeof student !== 'string') {
      return res.status(400).json({ message: 'Alumno inválido.' });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ message: 'Ubicación inválida.' });
    }

    const result = await registerAttendance({
      student,
      code: String(code || ''),
      latitude: lat,
      longitude: lng
    });

    return res.json({ message: 'Asistencia registrada.', ...result });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'No se pudo registrar asistencia.' });
  }
});

app.post('/generate-code', async (req, res) => {
  try {
    const { password } = req.body || {};
    const configuredPassword = process.env.ADMIN_PASSWORD;

    if (!configuredPassword) {
      return res.status(500).json({ message: 'ADMIN_PASSWORD no está configurada.' });
    }

    if (password !== configuredPassword) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    const data = await generateClassCode();
    return res.json({
      ...data,
      studentUrl: process.env.STUDENT_APP_URL || ''
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'No se pudo generar el código.' });
  }
});

app.listen(port, () => {
  console.log(`Backend listo en http://localhost:${port}`);
});
