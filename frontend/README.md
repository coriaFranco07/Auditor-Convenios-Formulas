# Frontend

Aplicacion Angular 15 para cargar Excel, ver resultados, filtrar issues, consultar detalle y descargar informes.

## Comandos

```powershell
npm run start --workspace frontend
npm run build --workspace frontend
npm run lint --workspace frontend
```

## Configuracion

`src/environments/environment.ts` define:

```typescript
apiUrl: 'http://localhost:3000/api'
```

## Pantallas

- Carga XLSX con drag-and-drop, selector, progreso y mensajes.
- Resumen con estado, severidades, conceptos, formulas y duracion.
- Tabla Angular Material con filtros por severidad, categoria, hoja, entidad, codigo, ID/texto y busqueda libre.
- Dialogo de detalle con formula, fragmento invalido, explicacion, recomendacion, referencia y ruta de dependencia.
- Botones de descarga JSON, CSV y Excel marcado.

Tailwind se usa para layout, espaciado y responsividad. Angular Material se usa para controles, tablas, dialogos, botones, formularios, paginacion, ordenamiento y snackbar.

