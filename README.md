# Control de asistencia con geolocalización

Aplicación web completa (frontend + backend) para registrar asistencia universitaria con validación de código, expiración, geocerca y control de doble registro, usando **Google Sheets** como backend principal de datos.

## Stack

- Frontend: Vite + Vanilla JavaScript + HTML + CSS puro
- Backend: Node.js + Express + Google Sheets API (`googleapis`)
- Despliegue sugerido: Frontend en Vercel/Netlify + Backend en Render

## Estructura

```text
.
├── frontend
│   ├── admin.html
│   ├── index.html
│   ├── package.json
│   └── src
│       ├── admin.js
│       ├── api.js
│       ├── main.js
│       └── styles.css
└── backend
    ├── .env.example
    ├── package.json
    └── src
        ├── index.js
        └── sheets.js
```

## Requisitos previos

- Node.js 20+
- Una hoja de cálculo de Google con una pestaña llamada **Asistencia**

## Configuración exacta de Google Sheets

En la hoja **Asistencia**:

- `B2`: código actual
- `D2`: timestamp de generación del código
- `B3`: latitud aula
- `D3`: longitud aula
- `G2`: radio permitido (metros)

Encabezados:

- Fila `5`
- Columna `B`: `Alumno`
- Columnas `C` en adelante: fechas
- Penúltima columna: `% asist.`
- Última columna: `Faltas`

Alumnos:

- Desde `B6` hacia abajo

## Configurar Google Cloud + Service Account

1. Crea un proyecto en Google Cloud.
2. Habilita **Google Sheets API**.
3. Crea una **Service Account**.
4. Genera una clave JSON.
5. Copia:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (mantener saltos de línea como `\n`)
6. Comparte la hoja de Google Sheets con el correo de la service account con permiso de edición.
7. Copia el ID de la hoja (URL) en `GOOGLE_SHEET_ID`.

## Variables de entorno (backend)

Copia `backend/.env.example` a `backend/.env` y completa valores.

## Ejecutar local

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configura la URL de API en frontend con `VITE_API_BASE_URL` (por ejemplo `http://localhost:3001`).

## Endpoints backend

- `GET /students`
- `GET /current-code`
- `POST /attendance`
- `POST /generate-code`

## Flujo alumno

1. Abre `index.html`
2. Selecciona nombre
3. Ingresa código de 5 caracteres
4. Permite GPS
5. Presiona registrar asistencia

## Flujo docente

1. Abre `admin.html`
2. Ingresa contraseña (`ADMIN_PASSWORD`)
3. Genera código aleatorio de 5 caracteres
4. Copia enlace de alumnos

## Reglas implementadas

- Validación de código activo (`B2`)
- Expiración de 15 minutos (`D2`)
- Geocerca por Haversine (`B3`, `D3`, `G2`)
- No doble registro el mismo día
- Si no existe columna para fecha actual, se inserta antes de `% asist.`
- Registro de celda con formato `✓ HH:mm`
- Recalcula `% asist.` y `Faltas`

## Deploy

### Frontend en Vercel o Netlify

1. Importar carpeta `frontend`.
2. Build command: `npm run build`
3. Output: `dist`
4. Variable: `VITE_API_BASE_URL=https://TU_BACKEND`

### Backend en Render

1. New Web Service apuntando a `backend`.
2. Build command: `npm install`
3. Start command: `npm start`
4. Configurar todas las variables de entorno de `.env.example`.
5. En `CORS_ORIGIN`, usar la URL del frontend.
