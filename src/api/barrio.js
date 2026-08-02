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
  const { data } = await cliente.post('/auth/login', { email, password });
  return data;
}
