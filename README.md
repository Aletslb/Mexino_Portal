# Casa Mexino · Portal inmobiliario

Primera versión del nuevo sitio de Casa Mexino, desarrollada con React, TypeScript y Vite para desplegarse en Cloudflare Pages.

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

## Configuración en Cloudflare Pages

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Production branch: `main`

Cuando el despliegue temporal de Pages funcione, se puede conectar `casamexino.com` desde **Workers & Pages → Custom domains**.

## Estado actual

- Portada adaptable a escritorio y móvil
- Navegación por secciones
- Buscador demostrativo de propiedades
- Propiedades destacadas
- Servicios, presentación y contacto

Los inmuebles, precios y datos de contacto actuales son contenido demostrativo pendiente de validación.
