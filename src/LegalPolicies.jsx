import { useEffect } from 'react';

const laws = {
  privacy: [
    {
      label: 'Ley 19.628 sobre protección de la vida privada (vigente hasta el 30 de noviembre de 2026)',
      href: 'https://www.bcn.cl/leychile/N?f=2023-05-09&i=141599'
    },
    {
      label: 'Ley 21.719 sobre protección y tratamiento de datos personales (rige desde el 1 de diciembre de 2026)',
      href: 'https://www.bcn.cl/leychile/Navegar?idNorma=1209272'
    }
  ],
  terms: [
    {
      label: 'Ley 19.496 sobre protección de los derechos de los consumidores',
      href: 'https://www.bcn.cl/leychile/Navegar?idNorma=1160403&idParte=10239808'
    }
  ]
};

export function LegalFooter({ onOpen, className = '' }) {
  return <footer className={`legal-footer ${className}`}>
    <span>CHIPPA © 2026</span>
    <nav aria-label="Información legal">
      <button type="button" onClick={() => onOpen('terms')}>Términos y condiciones</button>
      <button type="button" onClick={() => onOpen('privacy')}>Privacidad y seguridad de datos</button>
    </nav>
  </footer>;
}

export function LegalPolicies({ document, onClose }) {
  useEffect(() => {
    if (!document) return undefined;
    const previousBodyOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [document, onClose]);

  if (!document) return null;
  const privacy = document === 'privacy';

  return <div className="modal-backdrop legal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card legal-card" role="dialog" aria-modal="true" aria-labelledby="legal-heading">
      <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
      <div className="eyebrow">CHIPPA · INFORMACIÓN LEGAL</div>
      <h2 id="legal-heading">{privacy ? 'Privacidad y seguridad de datos' : 'Términos y condiciones'}</h2>
      <p className="legal-updated">Actualizado el 16 de noviembre de 2026 · Chile</p>

      {privacy ? <div className="legal-copy" tabIndex={0} aria-label="Contenido de privacidad y seguridad de datos">
        <h3>1. La plataforma</h3>
        <p>CHIPPA es un espacio digital para crear, guardar y compartir recuerdos y experiencias. Esta política explica qué información se utiliza y cómo se protege al usar sus funciones.</p>

        <h3>2. Datos que se pueden guardar</h3>
        <p>Según las funciones que uses, CHIPPA puede tratar tu correo de cuenta; nombre o apodo y avatar; datos de la experiencia como título, fecha, lugar y descripción; respuestas, cartas, canciones, planes y preferencias; fotografías que decidas subir; y la información necesaria para vincular a las personas invitadas.</p>
        <h3>3. Para qué se usan y qué se comparte</h3>
        <p>Los datos se usan para iniciar sesión, crear y sincronizar experiencias, vincular a la persona invitada, mostrar recuerdos y permitir las funciones que elijas. Las respuestas personales se mantienen privadas hasta que actives la opción de compartir correspondiente. Una vez compartido un contenido, la otra persona puede verlo y guardar una copia fuera de CHIPPA.</p>

        <h3>4. Proveedores y transferencias</h3>
        <p>CHIPPA utiliza Supabase para autenticación, base de datos y almacenamiento privado de imágenes. Las imágenes se sirven mediante enlaces firmados que vencen en una hora. La página carga tipografías desde Google Fonts, por lo que el navegador se conecta a ese servicio para obtenerlas. Revisa los avisos de privacidad de <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase</a> y <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a>. Los datos se alojan en la región configurada para el proyecto de Supabase.</p>

        <h3>5. Seguridad y conservación</h3>
        <p>CHIPPA utiliza acceso autenticado, reglas de acceso por participante, almacenamiento privado para imágenes y enlaces de corta duración. Estas medidas ayudan a proteger la información, aunque ningún sistema conectado a internet puede garantizar seguridad absoluta. Los datos guardados en el navegador permanecen hasta que se eliminen del dispositivo. Los datos sincronizados se conservan mientras permanezcan asociados a la cuenta o experiencia.</p>

        <h3>6. Tus derechos y normas aplicables</h3>
        <p>Al 16 de noviembre de 2026, se aplica la Ley 19.628. La Ley 21.719 entra en vigor el 1 de diciembre de 2026. Puedes solicitar acceso, rectificación, eliminación o bloqueo de tus datos, según corresponda, de acuerdo con la normativa vigente.</p>
        <ul>{laws.privacy.map((law) => <li key={law.href}><a href={law.href} target="_blank" rel="noreferrer">{law.label}</a></li>)}</ul>

      </div> : <div className="legal-copy" tabIndex={0} aria-label="Contenido de términos y condiciones">
        <h3>1. Qué ofrece CHIPPA</h3>
        <p>CHIPPA permite crear un pasaporte de experiencias para recordar una cita, guardar respuestas y usar juegos, cartas y otras actividades para seguir construyendo recuerdos en conjunto.</p>

        <h3>2. Uso de la cuenta e invitaciones</h3>
        <p>Entrega información veraz, protege tus credenciales y comparte el enlace de invitación solo con la persona que quieras vincular. Cada persona debe usar el servicio desde su propio perfil para acceder a la experiencia compartida.</p>

        <h3>3. Tus contenidos y el consentimiento</h3>
        <p>Conservas la responsabilidad por los textos y archivos que agregues. Sube fotografías y datos personales de otra persona solo cuando tengas autorización para hacerlo. No publiques contenido ilegal, que vulnere derechos de terceros o que no quieras compartir con la persona vinculada.</p>
        <p>Las respuestas personales no se comparten hasta que elijas compartirlas dentro de la aplicación. La otra persona puede conservar fuera de CHIPPA aquello que ya pudo ver, por ejemplo mediante una captura de pantalla.</p>

        <h3>4. Disponibilidad y cambios</h3>
        <p>El acceso al servicio y la sincronización pueden verse interrumpidos por mantenimiento, conectividad u otros factores técnicos. El almacenamiento del navegador no es una copia de seguridad; conserva también una copia de los contenidos que quieras guardar a largo plazo.</p>

        <h3>5. Derechos y legislación</h3>
        <p>Estos términos no eliminan los derechos que la ley reconoce a las personas consumidoras. Cuando corresponda, se aplicará la Ley 19.496, además de las normas de privacidad y datos personales vigentes en Chile. La Ley 21.719 comenzará a regir el 1 de diciembre de 2026 y CHIPPA deberá ajustar sus documentos y procesos a ese cambio.</p>
        <ul>{laws.terms.map((law) => <li key={law.href}><a href={law.href} target="_blank" rel="noreferrer">{law.label}</a></li>)}{laws.privacy.map((law) => <li key={law.href}><a href={law.href} target="_blank" rel="noreferrer">{law.label}</a></li>)}</ul>

      </div>}
    </section>
  </div>;
}
