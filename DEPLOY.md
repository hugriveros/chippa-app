# Despliegue de CHIPPA

CHIPPA se publica como aplicación estática de Vite en Vercel. El inicio de sesión, las invitaciones entre dispositivos y los datos compartidos requieren un proyecto Supabase configurado.

## Supabase

1. Crea un proyecto, habilita Email en Authentication → Sign In / Providers y desactiva **Confirm email** en los ajustes del proveedor Email. Así, Supabase crea la sesión al registrarse sin exigir validación del correo.
2. En un proyecto nuevo, ejecuta [`supabase/schema.sql`](./supabase/schema.sql) en el SQL Editor. Si CHIPPA ya tenía el esquema base instalado, ejecuta [`supabase/friends.sql`](./supabase/friends.sql) para agregar amigos, invitaciones y encuentros.
3. En Authentication → URL Configuration configura:
   - **Site URL:** URL definitiva de CHIPPA.
   - **Redirect URLs:** URL exacta de producción, `https://*-<team-o-cuenta>.vercel.app/**` para previsualizaciones de Vercel y `http://localhost:5173/**` para desarrollo.
4. Con **Confirm email** desactivado, no se envían correos de confirmación. Las cuentas podrán registrarse con cualquier dirección y entrar de inmediato.

La aplicación solo necesita la URL del proyecto y su clave publicable/anon. Nunca configures una clave `service_role` o `sb_secret_` en Vercel ni en el navegador.

## Vercel

1. Importa este repositorio como un proyecto **Vite**.
2. Configura las variables de entorno para **Production** y **Preview**:

   ```env
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<clave-publicable>
   ```

3. El proyecto usa `vercel.json`: compila con `npm run check:deploy && npm run build` y publica `dist/`. La comprobación detiene el build si faltan las variables o si detecta una clave secreta.
4. Agrega el dominio de CHIPPA en Vercel → Settings → Domains. Copia ese dominio a **Site URL** de Supabase y vuelve a desplegar después de cambiar variables.
5. Valida registro sin confirmación de correo, inicio de sesión, dos cuentas, invitaciones, fotos privadas y acceso al historial antes de compartir el sitio.

Las variables Vite se incorporan al compilar; cualquier cambio requiere un nuevo deployment. La clave publicable/anon puede quedar visible en el navegador: la seguridad de los datos depende de las políticas RLS y del esquema instalado.

## Antes de abrirlo al público

- Completa en los documentos legales el nombre de quien administra CHIPPA y un correo de contacto para privacidad. No inventes esos datos.
- Confirma la región de Supabase y el dominio final.
- Premium sigue siendo una emulación de $0 sin cobros ni renovación automática; no habilita cargos reales.
- Ejecuta el esquema SQL en el proyecto de destino. No se ha aplicado desde este entorno.

## Comprobaciones locales

```bash
npm run check:deploy
npm run build
node scripts/check-friends.mjs
```

La navegación, el almacenamiento y las reglas de Supabase deben verificarse contra el proyecto de destino antes del lanzamiento. Los valores de `.env.local` no se deben subir al repositorio.
