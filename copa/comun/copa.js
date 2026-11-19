// Datos de la Copa Dupla de Acero T3 y utilidades compartidas por todas las escenas.
'use strict';

const TORNEO = {
  nombre: 'Copa Dupla de Acero',
  temporada: 'Temporada 3',
  corto: 'Copa Dupla de Acero · T3',
  fechasCorta: '28–29 NOV',
  fechasLarga: 'Sábado 28 y domingo 29 de noviembre',
  modalidad: '2 vs 2 · tanques + aviones',
  br: 'Máximo 1.0',
  regla: 'Misma nación por dupla, y si ganas una partida no puedes repetir esa nación en la siguiente',
  premio: '1.000 Águilas Doradas',
  premioLargo: '1.000 Águilas Doradas para cada campeón',
  defensor: 'GRCHL',
  discord: 'discord.gg/eChkZZNhk',
  app: 'War League Planner',
  legal: 'Evento comunitario no oficial, no afiliado a Gaijin Entertainment.'
};
const POR_ANUNCIAR = 'Por anunciar';
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Hora de Chile en noviembre 2026 = UTC−3 (horario de verano).
function horaChile(dia, hhmm) {
  const [h, m] = String(hhmm || '18:00').split(':').map(Number);
  return Date.UTC(2026, 10, dia, h + 3, m);
}

// Solo para pruebas en el PC: ?ahora=2026-11-28T19:00:00-03:00 simula otra hora (se ignora fuera de localhost).
const DESFASE = (location.hostname === 'localhost' && new URLSearchParams(location.search).get('ahora'))
  ? Date.parse(new URLSearchParams(location.search).get('ahora')) - Date.now() : 0;

// En qué momento del torneo estamos, según la hora del PC.
function calcularTorneo(estado, ahora = Date.now() + DESFASE) {
  const c = estado.config;
  const inicio1 = horaChile(28, c.horaSab), inicio2 = horaChile(29, c.horaDom);
  const finDia1 = horaChile(29, '00:00'), fin = horaChile(30, '00:00');
  const diaCierre = c.diaCierre || 28;
  const cierre = horaChile(diaCierre, c.horaCierre);
  const cupo = c.cupo || 32, inscritos = Math.min(estado.inscritos || 0, cupo);
  const libres = Math.max(0, cupo - inscritos);
  const cerradas = ahora >= cierre;
  // La cuenta apunta primero al cierre de inscripciones y después al inicio.
  let fase, objetivo = null, cuentaA = '';
  if (ahora < inicio1) { fase = 'antes'; objetivo = cerradas ? inicio1 : cierre; cuentaA = cerradas ? 'inicio' : 'cierre'; }
  else if (ahora < finDia1) fase = 'vivo1';
  else if (ahora < inicio2) { fase = 'entre'; objetivo = inicio2; cuentaA = 'dia2'; }
  else if (ahora < fin) fase = 'vivo2';
  else fase = 'terminado';
  return {
    fase, objetivo, cuentaA, restante: objetivo ? objetivo - ahora : 0,
    cierreTxt: `${DIAS_SEMANA[new Date(Date.UTC(2026, 10, diaCierre)).getUTCDay()]} ${diaCierre}`,
    enVivo: fase === 'vivo1' || fase === 'vivo2',
    cupo, inscritos, libres,
    insc: cerradas ? 'cerradas' : libres === 0 ? 'llenas' : 'abiertas',
    ultimos: !cerradas && libres > 0 && libres <= 4,
    horaSab: c.horaSab, horaDom: c.horaDom, horaCierre: c.horaCierre
  };
}

const dos = (n) => String(n).padStart(2, '0');
// "8d 04h 12m" (días, horas, minutos)
function fmtDHM(ms) {
  const t = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(t / 1440), h = Math.floor((t % 1440) / 60), m = t % 60;
  return d > 0 ? `${d}d ${dos(h)}h ${dos(m)}m` : `${dos(h)}h ${dos(m)}m`;
}
// "8d 04:12:09" o "04:12:09" o "12:09"
function fmtReloj(ms, conDias = true) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
  if (conDias && d > 0) return `${d}d ${dos(h)}:${dos(m)}:${dos(seg)}`;
  if (h + d * 24 > 0) return `${h + d * 24}:${dos(m)}:${dos(seg)}`;
  return `${dos(m)}:${dos(seg)}`;
}
function fmtProximoStream(valor) {
  if (!valor) return null;
  const d = new Date(valor); // "2026-11-21T20:00" = hora local del PC
  if (isNaN(d)) return null;
  const f = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return { texto: f.charAt(0).toUpperCase() + f.slice(1), hora: d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dato = (v) => (v && String(v).trim()) ? esc(v) : `<span class="por-anunciar">${POR_ANUNCIAR}</span>`;

// Imagen opcional de comun/img/: si no existe, desaparece sin dejar hueco.
function imgOpcional(nombre, clase = '') {
  return `<img class="${clase}" src="../comun/img/${nombre}" alt="" onerror="this.remove()">`;
}
// Fondo opcional (fondo.jpg o banner.jpg): se muestra solo si carga.
function fondoOpcional(nombre) {
  const capa = document.querySelector('.fondo-img');
  if (!capa) return;
  const im = new Image();
  im.onload = () => { capa.style.backgroundImage = `url(../comun/img/${nombre})`; capa.classList.add('ok'); };
  im.src = `../comun/img/${nombre}`;
}

const QR_DISCORD = `<figure><div class="qr"><img src="../comun/qr-discord.svg" alt=""></div><figcaption>Discord<span>${TORNEO.discord}</span></figcaption></figure>`;
const QR_APP = `<figure><div class="qr"><img src="../comun/qr-play.svg" alt=""></div><figcaption>${TORNEO.app}<span>Gratis en Google Play</span></figcaption></figure>`;

// ---------- Conexión con Supabase ----------
// Solo responde con la clave privada del link (?clave=...), la misma de /live y /mistel.
const SUPABASE_URL = 'https://xkbsmpeqpezpzexiwfud.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JB3Fy272a8T03Pipj7sExA_ecHOXT44'; // clave pública (la misma de la app)
const PARAMS = new URLSearchParams(location.search);
const CLAVE = PARAMS.get('clave') || '';
// Solo para pruebas en el PC: ?api=http://localhost:8787 (se ignora fuera de localhost)
const API = (location.hostname === 'localhost' && PARAMS.get('api')) || SUPABASE_URL + '/rest/v1/rpc';
if (PARAMS.has('captura')) document.documentElement.classList.add('captura');

async function llamar(funcion, cuerpo) {
  const res = await fetch(`${API}/${funcion}`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: CLAVE, ...cuerpo })
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(datos.message || 'Error ' + res.status);
    e.claveMala = res.status === 401 || res.status === 403 || /clave/i.test(datos.message || '');
    throw e;
  }
  return datos;
}
function enviarAccion(accion) { return llamar('overlay_copa_accion', { p_accion: accion }); }

function mostrarAvisoClave(texto) {
  let d = document.getElementById('aviso-clave');
  if (!d) {
    d = document.createElement('div');
    d.id = 'aviso-clave';
    d.style.cssText = 'position:fixed;left:50%;top:40px;transform:translateX(-50%);z-index:99;background:#D62828;color:#fff;font:700 22px Rajdhani,"Segoe UI",sans-serif;padding:10px 18px;text-align:center;max-width:90%';
    document.body.appendChild(d);
  }
  d.textContent = texto;
}

// Consulta el estado cada segundo y avisa solo cuando cambia.
function conectar(alCambiar) {
  if (!CLAVE) { mostrarAvisoClave('Overlay privado: falta ?clave=... en el link.'); return; }
  let ultimoJson = '', errores = 0;
  const tick = async () => {
    try {
      const estado = await llamar('overlay_copa_estado', {});
      errores = 0;
      document.body.classList.remove('desconectado');
      const json = JSON.stringify(estado);
      if (json !== ultimoJson) { ultimoJson = json; alCambiar(estado); }
      setTimeout(tick, 1000);
    } catch (e) {
      if (e.claveMala) { mostrarAvisoClave('Overlay privado: la clave del link no es válida.'); return; }
      errores++;
      document.body.classList.add('desconectado');
      setTimeout(tick, Math.min(10000, 1000 * 2 ** Math.min(errores, 4)));
    }
  };
  tick();
}

function cadaSegundo(fn) {
  fn();
  setTimeout(() => { fn(); setInterval(fn, 1000); }, 1000 - (Date.now() % 1000));
}

document.addEventListener('DOMContentLoaded', () => {
  const d = document.createElement('div');
  d.id = 'sin-conexion';
  d.textContent = 'Sin conexión con Supabase: reintentando…';
  document.body.appendChild(d);
});

const $ = (s, r = document) => r.querySelector(s);
// Escribe solo si cambió (reescribir lo mismo cada segundo hace parpadear OBS).
const _ultimo = new WeakMap();
function poner(sel, valor, como = 'innerHTML') {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) return;
  const firma = como + '|' + valor;
  if (_ultimo.get(el) === firma) return;
  _ultimo.set(el, firma);
  el[como] = valor;
}
