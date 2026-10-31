// Datos del evento y utilidades compartidas por todas las escenas.
'use strict';

const EVENTO = {
  nombre: 'Sueños Hechos Realidad',
  vehiculo: 'Mistel 2',
  inicio: Date.UTC(2026, 9, 28, 11, 0, 0), // 28 oct 2026 11:00 GMT (08:00 Chile)
  etapas: 7,
  meta: 35000,
  premios: ['Calcomanía', 'Trofeo', 'Calcomanía', 'Trofeo', 'Marco «Muérdago»', 'Mistel 2', 'Camuflaje']
};
const DIA = 86400000;
EVENTO.fin = EVENTO.inicio + 14 * DIA;
EVENTO.inicioEtapa = (e) => EVENTO.inicio + (e - 1) * 2 * DIA;


// Etapa actual, día del stream y tiempo hasta el próximo cambio, según la hora del PC.
function calcularEvento(ahora = Date.now()) {
  if (ahora < EVENTO.inicio) {
    return { fase: 'antes', etapa: 1, dia: 0, proximoCambio: EVENTO.inicio, restante: EVENTO.inicio - ahora };
  }
  if (ahora >= EVENTO.fin) {
    return { fase: 'despues', etapa: 7, dia: 14, proximoCambio: null, restante: 0 };
  }
  const pasado = ahora - EVENTO.inicio;
  const etapa = Math.min(7, Math.floor(pasado / (2 * DIA)) + 1);
  const dia = Math.min(14, Math.floor(pasado / DIA) + 1);
  const proximoCambio = etapa < 7 ? EVENTO.inicioEtapa(etapa + 1) : EVENTO.fin;
  return { fase: 'durante', etapa, dia, proximoCambio, restante: proximoCambio - ahora };
}

const puntosDe = (estado, e) => Math.max(0, Number(estado.puntos?.[e]) || 0);
const etapaHecha = (estado, e) => !!estado.hechas?.[e] || puntosDe(estado, e) >= EVENTO.meta;
const etapasHechas = (estado) => [1, 2, 3, 4, 5, 6, 7].filter((e) => etapaHecha(estado, e)).length;

function fmtPuntos(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
const dos = (n) => String(n).padStart(2, '0');
function fmtDuracion(ms, conDias = true) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
  if (conDias && d > 0) return `${d}d ${dos(h)}:${dos(m)}:${dos(seg)}`;
  if (h + d * 24 > 0) return `${h + d * 24}:${dos(m)}:${dos(seg)}`;
  return `${dos(m)}:${dos(seg)}`;
}
function fmtFechaCorta(ts) {
  return new Date(ts).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}
function fmtHora(ts) {
  return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtProximoStream(valor) {
  if (!valor) return null;
  const d = new Date(valor); // "2026-10-30T20:00" se interpreta como hora local del PC
  if (isNaN(d)) return null;
  const fecha = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return { ts: d.getTime(), texto: fecha.charAt(0).toUpperCase() + fecha.slice(1), hora: fmtHora(d) };
}

// Imagen opcional de la carpeta img/: si no existe, desaparece sin romper nada.
function imgOpcional(nombre, clase = '') {
  return `<img class="${clase}" src="../comun/img/${nombre}" alt="" onerror="this.remove()">`;
}

// ---------- Conexión con Supabase ----------
// El estado vive en Supabase. Solo responde con la clave privada del link (?clave=...),
// la misma del overlay /live.
const SUPABASE_URL = 'https://xkbsmpeqpezpzexiwfud.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JB3Fy272a8T03Pipj7sExA_ecHOXT44'; // clave pública (la misma que trae la app)
const PARAMS = new URLSearchParams(location.search);
const CLAVE = PARAMS.get('clave') || '';
// Solo para pruebas en el PC: ?api=http://localhost:8787 (ignorado fuera de localhost)
const API = (location.hostname === 'localhost' && PARAMS.get('api')) || SUPABASE_URL + '/rest/v1/rpc';
const CADA_MS = 1000;

async function llamar(funcion, cuerpo) {
  const res = await fetch(`${API}/${funcion}`, {
    method: 'POST',
    cache: 'no-store',
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

// Cambia algo del estado (lo usa el panel de control). Devuelve el estado nuevo.
function enviarAccion(accion) { return llamar('overlay_mistel_accion', { p_accion: accion }); }

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
      const estado = await llamar('overlay_mistel_estado', {});
      errores = 0;
      document.body.classList.remove('desconectado');
      const json = JSON.stringify(estado);
      if (json !== ultimoJson) { ultimoJson = json; alCambiar(estado); }
      setTimeout(tick, CADA_MS);
    } catch (e) {
      if (e.claveMala) { mostrarAvisoClave('Overlay privado: la clave del link no es válida.'); return; }
      errores++;
      document.body.classList.add('desconectado');
      setTimeout(tick, Math.min(10000, CADA_MS * 2 ** Math.min(errores, 4))); // reintenta cada vez más lento
    }
  };
  tick();
}

function cadaSegundo(fn) {
  fn();
  setTimeout(() => { fn(); setInterval(fn, 1000); }, 1000 - (Date.now() % 1000));
}

// Modo "?captura": sin animaciones, solo para sacar fotos de prueba.
if (location.search.includes('captura')) {
  document.documentElement.insertAdjacentHTML('beforeend',
    '<style>*,*:before,*:after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}</style>');
}

// Pone el aviso de "sin conexión" en la página.
document.addEventListener('DOMContentLoaded', () => {
  const d = document.createElement('div');
  d.id = 'sin-conexion';
  d.textContent = 'Sin conexión con Supabase: reintentando…';
  document.body.appendChild(d);
});

const $ = (s, r = document) => r.querySelector(s);

// Escribe en la página solo si el contenido cambió. Reescribir lo mismo cada segundo
// hace parpadear el texto en el navegador de OBS.
const _ultimo = new WeakMap();
function poner(sel, valor, como = 'innerHTML') {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) return;
  const firma = como + '|' + valor;
  if (_ultimo.get(el) === firma) return;
  _ultimo.set(el, firma);
  el[como] = valor;
}

// ---------- Adornos de Halloween (solo con ?tema=halloween y en escenas con fondo) ----------
function telarana() {
  // Telaraña de esquina: rayos desde (0,0) y hilos que cuelgan entre rayos
  const angulos = [0, 15, 30, 45, 60, 75, 90].map((g) => g * Math.PI / 180);
  const radios = [55, 110, 170, 235, 300];
  let d = '';
  for (const a of angulos) d += `M0 0L${(300 * Math.cos(a)).toFixed(1)} ${(300 * Math.sin(a)).toFixed(1)}`;
  for (const r of radios) {
    angulos.forEach((a, i) => {
      const x = r * Math.cos(a), y = r * Math.sin(a);
      if (i === 0) { d += `M${x.toFixed(1)} ${y.toFixed(1)}`; return; }
      const m = (a + angulos[i - 1]) / 2, rr = r * 0.86; // el hilo cuelga hacia la esquina
      d += `Q${(rr * Math.cos(m)).toFixed(1)} ${(rr * Math.sin(m)).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
  }
  return `<svg viewBox="0 0 300 300"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
}
const MURCIELAGO = '<svg viewBox="0 0 64 30"><path fill="currentColor" d="M32 9c-1-3-3-5-3-5l-1 4C24 4 15 2 6 5c4 2 6 6 6 11 3-2 7-2 10 1 1-3 4-5 7-4 1-2 2-3 3-3s2 1 3 3c3-1 6 1 7 4 3-3 7-3 10-1 0-5 2-9 6-11-9-3-18-1-22 3l-1-4s-2 2-3 5z"/></svg>';

document.addEventListener('DOMContentLoaded', () => {
  if (!document.documentElement.classList.contains('halloween')) return;
  const fondo = document.querySelector('.fondo-hud');
  if (!fondo) return; // gameplay (transparente) y panel: sin adornos
  const murcielagos = [
    { l: 1180, t: 90, w: 112, d: '8s', r: '0s', x: '160px', y: '-25px' },
    { l: 1330, t: 175, w: 74, d: '6.5s', r: '-2s', x: '-120px', y: '30px' },
    { l: 1520, t: 120, w: 54, d: '7.5s', r: '-4s', x: '90px', y: '35px' },
    { l: 420, t: 70, w: 64, d: '9s', r: '-1s', x: '140px', y: '20px' },
    { l: 1660, t: 250, w: 45, d: '6s', r: '-3s', x: '-90px', y: '-30px' }
  ].map((m) => `<div class="murcielago" style="left:${m.l}px;top:${m.t}px;width:${m.w}px;--d:${m.d};--r:${m.r};--x:${m.x};--y:${m.y}">${MURCIELAGO}</div>`).join('');
  fondo.insertAdjacentHTML('afterend', `<div class="deco-halloween">
    <div class="tela izq">${telarana()}</div><div class="tela der">${telarana()}</div>
    ${murcielagos}
    <div class="sello"><i class="calabaza"></i>Especial de Halloween</div>
  </div>`);
});
