# CHIPPA · Pasaporte de experiencias

Aplicación para conectar con amigos, crear encuentros compartidos, jugar y guardar recuerdos. Está construida con React, Vite y Supabase.

## Preparar el entorno local

1. Instala Node.js 20.19+ o 22.12+.
2. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con la URL del proyecto y su clave publicable/anon.
3. En Supabase, habilita Email en Authentication → Sign In / Providers y desactiva **Confirm email** en los ajustes del proveedor Email para permitir el registro sin validar el correo. Luego ejecuta [`supabase/schema.sql`](./supabase/schema.sql) en SQL Editor.
4. Inicia la aplicación:

   ```bash
   npm install
   npm run dev
   ```

Sin Supabase, el desarrollo local permite previsualizar la interfaz en un solo dispositivo. Ese recorrido no crea cuentas ni sincroniza información.

## Publicar en Vercel

Consulta [`DEPLOY.md`](./DEPLOY.md) para configurar el proyecto, sus variables, el dominio y Supabase Auth.

## Funciones

- Amigos, invitaciones de un solo uso y creación de encuentros entre cuentas conectadas.
- Historial de citas e interacciones compartidas por amigo, sin revelar borradores privados.
- Juegos, cartas, aventuras, cápsula, pasaporte, playlist y generador de planes.
- Timbre de CHIPPA por actividad completada y desbloqueo Premium con pago simulado de $0.
- Supabase Auth, PostgreSQL, políticas RLS, almacenamiento privado y Realtime.

La suscripción Premium de esta versión es una emulación local sin cobros ni renovaciones. No es una integración de pagos comerciales.
