import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const url = env.VITE_SUPABASE_URL?.trim();
const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim();
const problems = [];

if (!url) problems.push('VITE_SUPABASE_URL no está configurada.');
else {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || /your-project|example|placeholder/i.test(url)) {
      problems.push('VITE_SUPABASE_URL debe ser la URL HTTPS real de tu proyecto.');
    }
  } catch { problems.push('VITE_SUPABASE_URL no es una URL válida.'); }
}

if (!key || key.length < 20 || /your-|example|placeholder|<|>/i.test(key)) {
  problems.push('Configura VITE_SUPABASE_PUBLISHABLE_KEY con la clave publicable del proyecto.');
} else if (key.startsWith('sb_secret_')) {
  problems.push('VITE_SUPABASE_PUBLISHABLE_KEY no puede ser una clave secreta.');
} else if (key.startsWith('sb_publishable_')) {
  if (key.length <= 'sb_publishable_'.length + 16) problems.push('VITE_SUPABASE_PUBLISHABLE_KEY no parece una clave publicable completa.');
} else if (key.split('.')[1]) {
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    if (claims.role === 'service_role') problems.push('No uses una clave service_role en una aplicación web.');
    else if (claims.role !== 'anon') problems.push('VITE_SUPABASE_PUBLISHABLE_KEY debe ser la clave anon/publicable.');
  } catch { problems.push('La clave anon heredada no tiene un formato JWT válido.'); }
} else problems.push('La clave debe tener formato publicable o JWT anon heredada.');

if (problems.length) {
  console.error('Falta completar la configuración de producción:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Configuración de Supabase lista para compilar.');
}
