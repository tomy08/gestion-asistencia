import { google } from 'googleapis';

const SHEET_NAME = process.env.SHEET_NAME || 'Asistencia';

function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno: ${name}`);
  return value;
}

function getSheetsClient() {
  const clientEmail = getEnv('GOOGLE_CLIENT_EMAIL');
  const privateKey = getEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

function columnToLetter(column) {
  let temp = column;
  let letter = '';

  while (temp > 0) {
    const modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }

  return letter;
}

function parseSheetDate(rawValue) {
  if (!rawValue) return null;

  if (typeof rawValue === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(rawValue));
    return epoch;
  }

  const asNumber = Number(rawValue);
  if (!Number.isNaN(asNumber) && /^\d+(\.\d+)?$/.test(String(rawValue))) {
    return parseSheetDate(asNumber);
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

function getTodayLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getHourLabel() {
  return new Date().toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

export async function getStudents() {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!B6:B`
  });

  const students = (result.data.values || []).map((row) => row[0]).filter(Boolean);
  return students;
}

export async function getCurrentCode() {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');

  const result = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${SHEET_NAME}!B2`, `${SHEET_NAME}!D2`]
  });

  const [codeRange, tsRange] = result.data.valueRanges || [];

  return {
    code: codeRange?.values?.[0]?.[0] || '',
    timestamp: tsRange?.values?.[0]?.[0] || ''
  };
}

export async function generateClassCode() {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const timestamp = new Date().toISOString();

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `${SHEET_NAME}!B2`, values: [[code]] },
        { range: `${SHEET_NAME}!D2`, values: [[timestamp]] }
      ]
    }
  });

  return { code, timestamp };
}

export async function registerAttendance({ student, code, latitude, longitude }) {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  const configRanges = [`${SHEET_NAME}!B2`, `${SHEET_NAME}!D2`, `${SHEET_NAME}!B3`, `${SHEET_NAME}!D3`, `${SHEET_NAME}!G2`];

  const configData = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: configRanges
  });

  const getConfigValue = (index) => configData.data.valueRanges?.[index]?.values?.[0]?.[0];
  const validCode = String(getConfigValue(0) || '').trim().toUpperCase();
  const generatedAt = parseSheetDate(getConfigValue(1));
  const roomLat = Number(getConfigValue(2));
  const roomLng = Number(getConfigValue(3));
  const radius = Number(getConfigValue(4));

  if (!/^[A-Z0-9]{5}$/.test(code)) {
    throw new Error('El código debe tener 5 caracteres alfanuméricos.');
  }

  if (!validCode || validCode !== code.toUpperCase()) {
    throw new Error('Código inválido.');
  }

  if (!generatedAt) {
    throw new Error('No se pudo validar la expiración del código.');
  }

  const elapsedMs = Date.now() - generatedAt.getTime();
  if (elapsedMs > 15 * 60 * 1000) {
    throw new Error('El código ha expirado.');
  }

  if ([roomLat, roomLng, radius].some((value) => Number.isNaN(value))) {
    throw new Error('Configuración de geolocalización inválida en la hoja.');
  }

  const distance = haversineDistanceMeters(roomLat, roomLng, latitude, longitude);
  if (distance > radius) {
    throw new Error('Estás fuera del radio permitido para registrar asistencia.');
  }

  const metadataResponse = await sheets.spreadsheets.get({ spreadsheetId });
  const targetSheet = metadataResponse.data.sheets?.find((sheet) => sheet.properties?.title === SHEET_NAME);
  if (!targetSheet) {
    throw new Error(`No se encontró la hoja ${SHEET_NAME}.`);
  }

  const sheetId = targetSheet.properties.sheetId;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!B5:ZZ5`
  });
  const headerValues = headerResponse.data.values?.[0] || [];

  const studentsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!B6:B`
  });
  const studentRows = (studentsResponse.data.values || []).map((row, index) => ({
    rowNumber: 6 + index,
    name: row[0] || ''
  }));

  const studentRow = studentRows.find((row) => normalizeText(row.name) === normalizeText(student));
  if (!studentRow) {
    throw new Error('El alumno no existe en la hoja de asistencia.');
  }

  const percentIndex = headerValues.findIndex((value) => normalizeText(value) === normalizeText('% asist.'));
  if (percentIndex === -1) {
    throw new Error('No se encontró la columna % asist. en la fila de encabezado.');
  }

  const todayLabel = getTodayLabel();
  const dateHeaders = headerValues.slice(1, percentIndex);
  const todayRelativeIndex = dateHeaders.findIndex((value) => normalizeText(value) === normalizeText(todayLabel));

  let attendanceColumn = null;
  let percentColumn = 2 + percentIndex;

  if (todayRelativeIndex >= 0) {
    attendanceColumn = 3 + todayRelativeIndex;
  } else {
    attendanceColumn = percentColumn;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: attendanceColumn - 1,
                endIndex: attendanceColumn
              },
              inheritFromBefore: true
            }
          }
        ]
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!${columnToLetter(attendanceColumn)}5`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[todayLabel]]
      }
    });

    percentColumn += 1;
  }

  const absencesColumn = percentColumn + 1;

  const attendanceCell = `${SHEET_NAME}!${columnToLetter(attendanceColumn)}${studentRow.rowNumber}`;
  const attendanceValue = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: attendanceCell
  });

  const alreadyRegistered = attendanceValue.data.values?.[0]?.[0];
  if (alreadyRegistered) {
    throw new Error('Ya tienes asistencia registrada hoy.');
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: attendanceCell,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[`✓ ${getHourLabel()}`]]
    }
  });

  const finalHeaderResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!B5:${columnToLetter(absencesColumn)}5`
  });
  const finalHeaders = finalHeaderResponse.data.values?.[0] || [];
  const finalPercentIndex = finalHeaders.findIndex((value) => normalizeText(value) === normalizeText('% asist.'));
  const finalDateIndexes = [];

  for (let index = 1; index < finalPercentIndex; index += 1) {
    if (finalHeaders[index]) finalDateIndexes.push(index);
  }

  const totalSessions = finalDateIndexes.length;
  const studentsRange = `${SHEET_NAME}!B6:${columnToLetter(absencesColumn)}`;
  const studentsData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: studentsRange
  });

  const updates = [];
  (studentsData.data.values || []).forEach((row, idx) => {
    const name = row[0];
    if (!name) return;

    const attendanceCount = finalDateIndexes.reduce((acc, dateIndex) => {
      const value = row[dateIndex] || '';
      return value.startsWith('✓') ? acc + 1 : acc;
    }, 0);

    const percentage = totalSessions === 0 ? '0%' : `${((attendanceCount / totalSessions) * 100).toFixed(2)}%`;
    const absences = String(Math.max(totalSessions - attendanceCount, 0));
    const targetRow = 6 + idx;

    updates.push({
      range: `${SHEET_NAME}!${columnToLetter(percentColumn)}${targetRow}:${columnToLetter(absencesColumn)}${targetRow}`,
      values: [[percentage, absences]]
    });
  });

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates
      }
    });
  }

  return { success: true, distance: Math.round(distance) };
}
