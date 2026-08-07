import axios from 'axios';

// Crea un cliente axios apuntando al backend de un barrio especifico
// (ej: https://sanpablo.debarrios.com.ar) con el token de esa cuenta ya
// puesto, para no repetirlo en cada llamado.
export function crearClienteBarrio(url, token) {
  const cliente = axios.create({ baseURL: `${url}/api` });
  if (token) {
    cliente.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
  return cliente;
}

// Login contra el backend propio del barrio (mismo /api/auth/login que ya
// usa el frontend web). NOTA: si ese barrio tiene 2FA activado, esta llamada
// no lo resuelve todavia - queda pendiente para cuando se implemente el
// segundo factor en la app.
export async function loginBarrio(url, email, password) {
  const cliente = axios.create({ baseURL: `${url}/api` });
  // origen: 'app' le permite al barrio configurar una duracion de sesion mas
  // larga para el celular que para la web (ver sesion_duracion_minutos_movil).
  const { data } = await cliente.post('/auth/login', { email, password, origen: 'app' });
  return data;
}

// Canjea el comprobante SSO (que vino en la respuesta de loginBarrio de OTRO
// barrio) contra este barrio, para entrar sin pedir contraseña de nuevo. Si
// el DNI no tiene usuario activo aca, o este barrio pide 2FA, o el
// comprobante ya vencio/se uso, tira error: quien llama decide que hacer
// (en general, saltear esa cuenta en silencio).
export async function loginSsoBarrio(url, comprobante) {
  const cliente = axios.create({ baseURL: `${url}/api` });
  const { data } = await cliente.post('/auth/sso', { comprobante });
  return data;
}

// Nombre y logo del barrio para pintar la pantalla de login antes de tener
// sesion (mismo endpoint publico que usa Login.jsx en la web).
export async function obtenerBranding(url) {
  const cliente = axios.create({ baseURL: `${url}/api` });
  const { data } = await cliente.get('/publico/branding');
  return data;
}

// A partir de aca, todas reciben un cliente ya armado con crearClienteBarrio
// (baseURL + token puestos), igual que hace la web con su instancia de axios.

export async function obtenerAccesos(cliente, page = 1) {
  const { data } = await cliente.get('/accesos', { params: { page, limit: 20 } });
  return data;
}

export async function obtenerAreasComunes(cliente) {
  const { data } = await cliente.get('/areas-comunes');
  return data;
}

export async function obtenerReservas(cliente) {
  const { data } = await cliente.get('/reservas', { params: { estado: 'confirmada' } });
  return data;
}

// Para un Propietario, GET /propietarios ya viene acotado por el backend a
// sus propias filas (una por lote). Se usa solo para mostrar "Lote X" en vez
// del nombre del rol en la lista de cuentas.
export async function obtenerPropietariosPropios(cliente) {
  const { data } = await cliente.get('/propietarios');
  return data.data ?? data;
}

// Trae la config del barrio (horario de apertura/cierre de reservas, etc).
// GET /barrios/:id no pide permiso especial, solo que sea tu propio barrio.
export async function obtenerBarrio(cliente, id_barrio) {
  const { data } = await cliente.get(`/barrios/${id_barrio}`);
  return data;
}

// Horarios ya reservados de un area en una fecha puntual, para pintar la
// grilla de disponibilidad (mismo endpoint que usa ModalCrearReserva.jsx).
export async function obtenerOcupados(cliente, id_area_comun, fecha) {
  const { data } = await cliente.get('/reservas/ocupados', { params: { id_area_comun, fecha } });
  return data;
}

export async function crearReserva(cliente, { id_area_comun, fecha, hora_inicio, hora_fin, cantidad_personas }) {
  const { data } = await cliente.post('/reservas', {
    id_area_comun: Number(id_area_comun),
    fecha,
    hora_inicio,
    hora_fin,
    ...(cantidad_personas ? { cantidad_personas: Number(cantidad_personas) } : {}),
  });
  return data;
}

export async function cancelarReserva(cliente, id_reserva) {
  const { data } = await cliente.delete(`/reservas/${id_reserva}`);
  return data;
}

// Para Propietario/Guardia, GET /notificaciones ya viene acotado a las
// propias (ver notificaciones.js del backend).
export async function obtenerNotificaciones(cliente) {
  const { data } = await cliente.get('/notificaciones');
  return data;
}

// Liviano a proposito (COUNT en vez de traer la lista entera): se usa para
// el puntito de la campanita del header, que se consulta seguido.
export async function obtenerNotificacionesNoLeidas(cliente) {
  const { data } = await cliente.get('/notificaciones/no-leidas/count');
  return data.total;
}

export async function marcarNotificacionLeida(cliente, id_notificacion) {
  const { data } = await cliente.patch(`/notificaciones/${id_notificacion}/leer`);
  return data;
}

// Le avisa al backend de este barrio el Expo push token del celular, para
// que le pueda mandar notificaciones nativas (banner del sistema, incluso
// con la app cerrada).
export async function registrarPushToken(cliente, token) {
  const { data } = await cliente.put('/notificaciones/push-token', { token });
  return data;
}

export async function obtenerPaquetes(cliente, page = 1) {
  const { data } = await cliente.get('/paquetes', { params: { page, limit: 20 } });
  return data;
}

export async function marcarPaqueteRetirado(cliente, id_paquete) {
  const { data } = await cliente.patch(`/paquetes/${id_paquete}/retirado`);
  return data;
}

// Contenido de una carpeta (o de la raiz si se omite carpeta_id). El backend
// ya filtra que carpetas ve el rol del usuario (ver archivos.js).
export async function obtenerArchivos(cliente, carpeta_id) {
  const { data } = await cliente.get('/archivos', { params: carpeta_id ? { carpeta_id } : {} });
  return data;
}

// Agenda de telefonos utiles del barrio, ya ordenada por el backend segun el
// orden que le dio el administrador arrastrando las tarjetas en la web.
export async function obtenerTelefonos(cliente) {
  const { data } = await cliente.get('/telefonos');
  return data;
}

// Para un Propietario, GET /invitaciones ya viene acotado por el backend a las
// de sus propios lotes (ver invitaciones.js).
export async function obtenerInvitaciones(cliente) {
  const { data } = await cliente.get('/invitaciones');
  return data;
}

export async function cancelarInvitacion(cliente, id_invitacion) {
  const { data } = await cliente.patch(`/invitaciones/${id_invitacion}/cancelar`);
  return data;
}

// Devuelve la invitacion creada mas link_whatsapp / whatsapp_enviado /
// link_invitacion, segun como este configurado el envio en el barrio.
export async function crearInvitacion(cliente, invitacion) {
  const { data } = await cliente.post('/invitaciones', invitacion);
  return data;
}

// Visitantes que YA ingresaron alguna vez al lote: son los unicos que tiene
// sentido volver a invitar sin recargar sus datos (mismo filtro que hace
// ModalCrearInvitacion.jsx en la web).
export async function obtenerVisitantesDelLote(cliente, lote) {
  const { data } = await cliente.get('/visitantes', { params: { lote } });
  return (data.data ?? data).filter((v) => v.ultimo_ingreso);
}

export async function crearVisitante(cliente, visitante) {
  const { data } = await cliente.post('/visitantes', visitante);
  return data;
}

// Solo para roles que NO son Propietario (un Guardia invitando en nombre de
// alguien): el Propietario usa obtenerPropietariosPropios, que el backend ya
// acota a sus propias filas.
export async function buscarPropietarios(cliente, buscar) {
  const { data } = await cliente.get('/propietarios', { params: { buscar } });
  return data.data ?? data;
}

// Devuelve { mensaje } o, si el barrio tiene configurado que cambiar la
// contraseña cierra las demas sesiones, tambien { token } (el nuevo token de
// ESTA sesion, que hay que guardar para no quedar con uno invalidado).
export async function cambiarPassword(cliente, { password_actual, password_nueva }) {
  const { data } = await cliente.post('/auth/cambiar-password', { password_actual, password_nueva });
  return data;
}
