import axios from 'axios';
import { CONECTOR_URL } from '../config';

const conector = axios.create({ baseURL: CONECTOR_URL });

// Dado un DNI, devuelve los barrios (con su url) donde esa persona tiene
// usuario. Es el unico llamado que se hace antes de tener sesion en ningun
// barrio.
export async function buscarBarriosPorDni(dni) {
  const { data } = await conector.post('/buscar', { dni });
  return data.barrios;
}
