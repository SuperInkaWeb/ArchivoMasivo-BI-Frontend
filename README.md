# datafilter-frontend

Interfaz para **subir archivos grandes (CSV/TXT/Excel), filtrarlos por columnas y descargar solo el resultado filtrado**. Consume el API de `datafilter-backend`.

## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind v4** (plugin `@tailwindcss/vite`)
- Componentes UI propios estilo shadcn (sin dependencias de UI externas)

## Arquitectura (separación de responsabilidades)

```
src/
├── lib/          api (fetch) · utils · filters (coerción de valores)
├── types/        contratos con el backend
├── services/     llamadas al API (datasets)
├── hooks/        useDatasets (lista + polling) · useDatasetDetail
├── components/
│   ├── ui/       Button · Field · Card · Badge · Feedback
│   ├── UploadDropzone · DatasetList
│   ├── FilterBuilder · FilterRow
│   └── PreviewTable · DownloadBar
└── pages/        WorkspacePage (orquestador)
```

## Puesta en marcha

```bash
npm install
copy .env.example .env    # ajusta VITE_API_URL si el backend no está en :8000
npm run dev               # http://localhost:5173
```

Requiere el backend corriendo y con `CORS_ORIGINS` incluyendo `http://localhost:5173`.

## Flujo

1. **Subir** — arrastra o elige archivos; se ingiere en background (badge de estado con polling automático).
2. **Seleccionar** un dataset `Listo` → carga su esquema y muestra la vista previa completa.
3. **Filtrar** — agrega condiciones (columna · operador · valor), combina con Y/O, aplica.
4. **Descargar** — CSV o Excel, solo las filas que cumplen el filtro.

## Notas

- El valor se coacciona a número cuando la columna es numérica; la validación fuerte (whitelist de columnas, binding) vive en el backend.
- La descarga usa `fetch` → `Blob` → enlace temporal. En navegadores embebidos con sandbox la descarga puede bloquearse; funciona en un navegador normal.
