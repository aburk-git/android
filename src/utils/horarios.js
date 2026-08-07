// Misma logica que frontend/src/components/ModalCrearReserva.jsx: se mantiene
// sincronizada a mano con la web para que el formato de reserva sea identico.

export function generarOpcionesHora(horaApertura, horaCierre, paso = 30) {
  const [hInicio] = horaApertura.split(':').map(Number);
  const [hFin, mFin] = horaCierre.split(':').map(Number);
  const opciones = [];
  for (let h = hInicio; h <= hFin; h++) {
    for (let m = 0; m < 60; m += paso) {
      if (h === hFin && m > mFin) break;
      opciones.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opciones;
}

// "Hoy" y "ahora" en la zona horaria del barrio, no la del celular.
export function fechaISOEnZona(zona, offsetDias = 0) {
  return new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000).toLocaleDateString('sv', { timeZone: zona });
}

export function minutosActualesEnZona(zona) {
  const horaStr = new Date().toLocaleTimeString('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hour12: false });
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + m;
}

// hora_inicio/hora_fin llegan del backend como hora UTC pura (1970-01-01THH:MM:00Z).
export function aMinutos(horaIso) {
  const d = new Date(horaIso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function horaAMinutos(horaStr) {
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutosAHora(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function nombreDiaCorto(fechaIso) {
  const d = new Date(`${fechaIso}T12:00:00`);
  return d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
}
