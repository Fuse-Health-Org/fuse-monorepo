# Fuse Affiliate Portal Frontend

Portal dedicado para affiliates de Fuse Health. Permite a los affiliates ver analytics, revenue y gestionar su branding.

## Características

- Dashboard de analytics (datos desidentificados, HIPAA compliant)
- Tracking de revenue y comisiones
- Gestión de branding (nombre y website)
- Sistema de toasts para notificaciones
- Mensajes informativos cuando no hay datos suficientes

## Desarrollo

```bash
# Instalar dependencias
pnpm install

# Ejecutar en desarrollo (puerto 3005)
pnpm dev

# Build para producción
pnpm build

# Iniciar en producción
pnpm start
```

## Variables de Entorno

Crea un archivo `.env.local` en la raíz del monorepo con:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## URLs

- Desarrollo: `http://localhost:3005`
- Producción: `admin.limitless.health` (affiliate merchants)
- Producción: `ufc.limitless.health/sign-in` (affiliate patients)

