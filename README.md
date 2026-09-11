# Casa Mexino · Portal inmobiliario

Portal y administración de inventario de Casa Mexino. React, TypeScript y Vite con API en Cloudflare Workers, D1 y R2. Acceso del equipo validado con Cloudflare Access.

## Desarrollo local

```bash
npm install
npm run dev
```

## Compilar para producción

```bash
npm run build
```

El resultado se genera en `dist/`.

## Configuración en Cloudflare Workers

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Assets: `dist`
- Root directory: `/`
- Production branch: `main`

Antes de publicar esta etapa, completar [la activación de D1, R2 y Access](docs/ACTIVACION.md). `npm run dev` sirve solo la interfaz; usar `wrangler dev` para la API local. Verificación automatizada: `npm test`.

## Estado actual

- Portada adaptable a escritorio y móvil
- Catálogo con filtros, mapa de Matehuala y detalle de propiedad
- Panel de propiedades, imágenes y fraccionamientos
- Planos PDF/imagen con delimitación de lotes y disponibilidad
- Expedientes de clientes, apartados y ventas con permisos por rol
- Cancelaciones con revisión administrativa antes de liberar inventario
- API con permisos, validación, revisiones concurrentes e historial

El inventario inicia vacío. Los anuncios ficticios anteriores no se importan. La fotografía de portada es ilustrativa. La cobranza, recibos, entregas a propietarios y caja corresponden a la siguiente etapa; los acuerdos completos están en [Alcance](docs/ALCANCE.md).
