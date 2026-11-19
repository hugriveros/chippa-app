export const destinations = [
  'Barrio Lastarria', 'Parque O’Higgins', 'Jardín Japonés',
  'Mercado Urbano Tobalaba (MUT)', 'Parque Araucano', 'Otro lugar'
];

export const modules = [
  { id: 'moment', title: 'Nuestro momento', desc: 'Revivan lo que hizo especial esta cita.', emoji: '📓', art: '/assets/chippa/camara.png', group: 'Revive la cita', tone: 'lilac' },
  { id: 'letters', title: 'Tienes una carta', desc: 'Una pregunta para seguir conversando.', emoji: '💌', art: '/assets/chippa/corazon-1.png', group: 'Cartas', tone: 'pink' },
  { id: 'next', title: 'Nuestra próxima aventura', desc: 'Elijan una idea para volver a encontrarse.', emoji: '🧭', art: '/assets/chippa/sello-avion.png', group: 'Aventuras', tone: 'sky', premium: true },
  { id: 'same', title: '¿Pensamos lo mismo?', desc: 'Mismas preguntas, dos versiones.', emoji: '✨', group: 'Juegos', tone: 'butter', premium: true },
  { id: 'story', title: 'Completa nuestra historia', desc: 'Escriban juntos el próximo capítulo.', emoji: '✍️', group: 'Juegos', tone: 'peach', premium: true },
  { id: 'memory', title: 'Match de recuerdos', desc: 'Encuentren los pares de su cita.', emoji: '🃏', group: 'Juegos', tone: 'mint' },
  { id: 'missions', title: 'Misión desbloqueada', desc: 'Pequeños desafíos para su colección.', emoji: '⭐', group: 'Juegos', tone: 'butter' },
  { id: 'trivia', title: 'Trivia post-cita', desc: '¿Qué recuerdan de ese día?', emoji: '🎯', group: 'Juegos', tone: 'sky' },
  { id: 'memory-bingo', title: 'Bingo de recuerdos', desc: 'Marquen las pequeñas cosas que vivieron.', emoji: '🎟️', group: 'Juegos', tone: 'lilac', premium: true },
  { id: 'couple-quiz', title: '¿Quién conoce más?', desc: 'Una ronda sobre sus gustos.', emoji: '❔', group: 'Juegos', tone: 'peach', premium: true },
  { id: 'guess-the-place', title: 'Adivina el lugar', desc: 'Descubran el destino con pistas.', emoji: '📍', group: 'Juegos', tone: 'mint', premium: true },
  { id: 'questions', title: 'Banco de preguntas', desc: 'Elijan una conversación al azar.', emoji: '🗂️', group: 'Conózcanse', tone: 'peach' },
  { id: 'passport', title: 'Pasaporte digital', desc: 'Un nuevo lugar para su colección.', emoji: '🛂', art: '/assets/chippa/sello-avion.png', group: 'Guarden recuerdos', tone: 'lilac' },
  { id: 'capsule', title: 'Cápsula compartida', desc: 'Los mejores momentos merecen quedarse.', emoji: '📸', group: 'Guarden recuerdos', tone: 'pink' },
  { id: 'future', title: 'Carta del futuro', desc: 'Un mensaje que espera su momento.', emoji: '⏳', group: 'Guarden recuerdos', tone: 'sky', premium: true },
  { id: 'playlist', title: 'Playlist de la cita', desc: 'La banda sonora de este capítulo.', emoji: '🎧', group: 'Guarden recuerdos', tone: 'mint', premium: true },
  { id: 'plans', title: 'Generador de planes', desc: 'Una idea nueva según sus gustos.', emoji: '🎲', group: 'Aventuras', tone: 'butter', premium: true }
];

export const letterDeck = {
  CONVERSA: ['¿Qué te gustaría descubrir sobre mí?', '¿Qué tema nos quedó pendiente?', '¿Qué fue lo más interesante que conversamos?'],
  DESAFÍO: ['Describe nuestra cita con solo tres emojis.', 'Escribe una frase graciosa que represente el encuentro.', 'Busca una canción que describa nuestra aventura.'],
  ELIGE: ['¿Segunda cita en un café o en un parque?', '¿Una salida espontánea o planificada?', '¿Una cita de día o de noche?'],
  RECUERDA: ['¿Qué detalle recuerdas mejor?', '¿Qué fue lo primero que te llamó la atención?', '¿Qué momento repetirías?'],
  SORPRESA: ['Envíale una recomendación inesperada.', 'Inventa el título de una película sobre su cita.', 'Propón una actividad que nunca hayas realizado.'],
  CONEXIÓN: ['¿Qué aprendiste de mí?', '¿Qué tenemos en común?', '¿Qué te gustaría que supiera sobre ti?']
};

export const sameQuestions = [
  { q: '¿Cuál fue el mejor momento de nuestra cita?', options: ['Al llegar', 'La conversación', 'Algo inesperado', 'El final'] },
  { q: '¿Qué actividad te gustaría repetir?', options: ['Pasear', 'Conversar', 'Probar algo rico', 'Explorar'] },
  { q: '¿Qué palabra describe mejor el encuentro?', options: ['Divertido', 'Tranquilo', 'Inesperado', 'Especial'] },
  { q: '¿Cuál fue la parte más divertida?', options: ['Una anécdota', 'El camino', 'Un juego', 'La sobremesa'] },
  { q: '¿Qué tipo de cita deberíamos tener después?', options: ['Cultural', 'Al aire libre', 'Creativa', 'Gastronómica'] },
  { q: '¿Qué fue lo más inesperado?', options: ['Un tema', 'Un lugar', 'Una coincidencia', 'Una risa'] },
  { q: '¿Qué lugar elegirías para una segunda salida?', options: ['Una plaza', 'Un museo', 'Un café', 'Un barrio nuevo'] }
];

export const storyPrompts = [
  'Cuando llegué a nuestra cita, pensé…', 'Lo más inesperado fue…', 'Cuando comenzamos a conversar…',
  'El momento más gracioso ocurrió cuando…', 'Si pudiera repetir algo, sería…',
  'Nuestra próxima aventura debería ser…', 'Si nuestra cita fuera una película, se llamaría…'
];

export const triviaQuestions = [
  { q: '¿Qué rincón de la cita recuerdas con más cariño?', options: ['El lugar', 'La conversación', 'El paseo', 'La sorpresa'] },
  { q: '¿Qué pedirías otra vez?', options: ['Algo dulce', 'Algo salado', 'Un café o té', 'Lo que pidió la otra persona'] },
  { q: '¿Qué ritmo tuvo el encuentro?', options: ['Pausado', 'Lleno de historias', 'Espontáneo', 'Un poco de todo'] },
  { q: '¿Qué recuerdo guardarías primero?', options: ['Una frase', 'Una foto', 'Una canción', 'Una risa'] },
  { q: '¿Qué paisaje acompañaría esta cita?', options: ['Una plaza', 'Una calle bonita', 'Una mesa acogedora', 'Un cielo de tarde'] }
];

export const questionBank = {
  'Para conocernos': ['¿Qué pequeño gusto siempre te alegra el día?', '¿Qué lugar te hace sentir en calma?', '¿Qué habilidad te gustaría aprender?'],
  Recuerdos: ['¿Qué recuerdo de infancia te da mucha risa?', '¿Cuál fue una aventura que no esperabas vivir?', '¿Qué canción te lleva a otro momento?'],
  'Próximas ideas': ['¿Qué panorama te gustaría probar por primera vez?', '¿Qué barrio te gustaría recorrer sin apuro?', '¿Qué plan sencillo disfrutas mucho?'],
  Imaginación: ['Si esta cita tuviera una portada, ¿qué aparecería?', '¿Qué destino elegirías para una aventura de un día?', '¿Cómo se llamaría un café que inventaras?']
};

export const planCatalog = [
  { title: 'Búsqueda fotográfica', type: 'Creativo', budget: 'Gratis', mood: 'Divertido', setting: 'Exterior', duration: 'Corta', desc: 'Encuentren tres colores, una forma curiosa y un rincón que ninguno conocía. Elijan una foto que resuma el paseo.', kit: 'Teléfono con cámara', mission: 'Hagan una foto que parezca portada de su próxima aventura.' },
  { title: 'Picnic con preguntas sorpresa', type: 'Naturaleza', budget: 'Económico', mood: 'Tranquilo', setting: 'Exterior', duration: 'Media', desc: 'Elijan un espacio verde y lleven algo sencillo para compartir. Cada uno prepara una pregunta inesperada.', kit: 'Manta y algo para compartir', mission: 'Guarden una respuesta que quieran recordar.' },
  { title: 'Ruta cultural improvisada', type: 'Cultura', budget: 'Intermedio', mood: 'Aventurero', setting: 'Interior', duration: 'Media', desc: 'Escojan un espacio cultural de su zona y propongan una mini búsqueda de detalles favoritos.', kit: 'Curiosidad y una libreta', mission: 'Cada persona elige una obra o detalle para contar por qué lo recuerda.' },
  { title: 'Café y menú imaginario', type: 'Gastronomía', budget: 'Intermedio', mood: 'Tranquilo', setting: 'Interior', duration: 'Corta', desc: 'Prueben un lugar nuevo y creen el nombre de un postre para el menú de una cafetería ficticia.', kit: 'Una idea dulce y ganas de conversar', mission: 'Inventen juntos el nombre de su café.' },
  { title: 'Desafío de sabores', type: 'Gastronomía', budget: 'Económico', mood: 'Divertido', setting: 'Interior', duration: 'Media', desc: 'Elijan una preparación o ingrediente que ninguno haya probado y comparten sus primeras impresiones.', kit: 'Una lista de sabores por explorar', mission: 'Denle un nombre a su nuevo sabor favorito.' },
  { title: 'Paseo sin mapa', type: 'Naturaleza', budget: 'Gratis', mood: 'Espontáneo', setting: 'Exterior', duration: 'Larga', desc: 'Recorran un lugar conocido por un camino distinto y dejen que cada uno elija una parada.', kit: 'Zapatos cómodos', mission: 'Encuentren un detalle que normalmente habría pasado inadvertido.' },
  { title: 'Tarde de creación', type: 'Creativo', budget: 'Económico', mood: 'Romántico', setting: 'Interior', duration: 'Media', desc: 'Dibujen, armen una mini playlist o escriban una postal sobre un panorama que les gustaría vivir.', kit: 'Papel, lápices o una playlist', mission: 'Intercambien su creación al terminar.' },
  { title: 'Ventana de sorpresa', type: 'Entretenimiento', budget: 'Flexible', mood: 'Sorpresa', setting: 'Cualquiera', duration: 'Corta', desc: 'Cada persona propone una actividad corta sin revelar el detalle. Elijan una al azar y descubran qué pasa.', kit: 'Dos ideas pequeñas', mission: 'Guarden el momento más inesperado en la cápsula.' }
];

export const categories = ['CONVERSA', 'DESAFÍO', 'ELIGE', 'RECUERDA', 'SORPRESA', 'CONEXIÓN'];
export const avatarOptions = [
  { src: '/assets/chippa/memory-ticket-1.png', label: 'Avatar rosa con lentes' },
  { src: '/assets/chippa/memory-ticket-2.png', label: 'Avatar amarillo con gafas de sol' },
  { src: '/assets/chippa/memory-ticket-3.png', label: 'Avatar celeste con cabello rizado' },
  { src: '/assets/chippa/memory-ticket-4.png', label: 'Avatar rojo con cabello rubio' },
  { src: '/assets/chippa/memory-ticket-5.png', label: 'Avatar naranja con audífonos' },
  { src: '/assets/chippa/memory-ticket-6.png', label: 'Avatar fucsia con cabello violeta' },
  { src: '/assets/chippa/memory-ticket-7.png', label: 'Avatar azul con lentes' },
  { src: '/assets/chippa/memory-ticket-8.png', label: 'Avatar verde con gorro' }
];
export const avatars = avatarOptions.map((avatar) => avatar.src);
