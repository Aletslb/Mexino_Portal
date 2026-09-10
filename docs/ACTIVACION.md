# Activación de la primera etapa

El proyecto existente se despliega como **Cloudflare Worker**, no como Pages. Esta rama agrega un Worker con API y conserva Vite para la interfaz. No fusionar hasta configurar y comprobar los servicios siguientes en un entorno de prueba.

## Recursos necesarios

- D1: catálogo, metadatos de imágenes e historial. Binding `DB`.
- R2: fotografías y planos convertidos a imagen. Binding `BUCKET`. Mantener bucket privado.
- Cloudflare Access: inicio de sesión del equipo mediante correos autorizados. La API valida firma, emisor, audiencia y vencimiento del JWT, además del rol permitido.

Crear los recursos en la cuenta propietaria del Worker y añadir **los identificadores reales** a `wrangler.jsonc`:

```jsonc
"d1_databases": [{
  "binding": "DB",
  "database_name": "NOMBRE_REAL",
  "database_id": "ID_REAL",
  "migrations_dir": "migrations"
}],
"r2_buckets": [{ "binding": "BUCKET", "bucket_name": "NOMBRE_REAL" }]
```

Se omiten deliberadamente los IDs hasta crear los recursos. El Worker falla de forma cerrada si falta configuración; no usa almacenamiento del navegador ni credenciales de demostración.

## Autenticación

Configurar una aplicación Access para los destinos `/admin`, `/admin/*` y `/api/admin/*` del hostname elegido, con política Allow para los correos concretos del equipo y proveedor de identidad/código de un solo uso. Mantener el resto del portal público. Verificar el alcance de los paths en la cuenta, especialmente en `workers.dev`; si su protección abarca todo el hostname, configurar la aplicación por paths sobre el dominio personalizado antes de activarla.

Configurar en el Worker, como variables de entorno:

- `ACCESS_TEAM_DOMAIN`: dominio de equipo, sin protocolo; por ejemplo `equipo.cloudflareaccess.com`.
- `ACCESS_AUD`: audiencia de la aplicación Access.
- `ADMIN_EMAILS`: correos de administradores, separados por comas.
- `ADVISOR_EMAILS`: correos de asesores, separados por comas.

No hay registro público ni asignación de roles desde el navegador. Administradores y asesores pueden gestionar inventario y precios; el historial está reservado a administradores. La gestión gráfica de usuarios queda pendiente. Comprobar Access y las listas de roles conjuntamente al añadir o retirar usuarios. La imagen de un borrador requiere sesión; una imagen publicada se sirve solo mientras esté asociada a un registro publicado.

## Migración y despliegue

1. Ejecutar `npx wrangler d1 migrations apply NOMBRE_REAL --remote` con la cuenta y base verificadas.
2. Build de Cloudflare: `npm run build`. Deploy: `npx wrangler deploy`. El archivo Wrangler explícito evita la reconfiguración automática de Vite que ocurrió en el primer despliegue.
3. Probar sesión autorizada y no autorizada, crear un borrador, subir una foto, guardar, recargar y publicar. Verificar desde una sesión anónima.
4. Crear un desarrollo, subir un plano, agregar y delimitar un lote; comprobar cambios en el plano público. El PDF se convierte en el navegador, una página a la vez; no se conserva el original en esta etapa.
5. Solo después de la activación, fusionar la rama en `main` para actualizar producción.

Para desarrollo local completo, compilar y utilizar `wrangler dev` con bindings locales y `.dev.vars` ignorado. El servidor Vite por sí solo no ejecuta la API. Las pruebas automatizadas usan D1/R2 locales sin acceder a la cuenta de producción.

## Límites de esta entrega

- No se importan los anuncios, precios o ubicaciones ficticios de la versión inicial como inventario real.
- Datos reales de contacto aún no proporcionados. El portal no inventa un teléfono ni presenta un formulario que no entregue mensajes.
- Los mapas usan Leaflet y teselas estándar OpenStreetMap con atribución, sin precarga ni descarga masiva. Revisar proveedor/capacidad antes de un incremento significativo de tráfico.
- No hay todavía expediente de venta, cobranza, cancelación de ventas, entrega a propietarios ni caja. Marcar vendido actualiza únicamente disponibilidad. Volver de vendido a disponible está bloqueado hasta disponer del flujo de cancelación.
- Apartados se reservan en el modelo, pero no se ofrecen todavía como operación.
- Publicar un plano implica publicar la imagen completa: usar planos sin información personal impresa.
- No se han aplicado migraciones ni activado autenticación en la cuenta de Cloudflare desde esta sesión.

Referencias:
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://operations.osmfoundation.org/policies/tiles/
