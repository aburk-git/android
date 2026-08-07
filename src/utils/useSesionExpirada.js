import { useCallback } from 'react';
import { useCuentas } from '../context/CuentasContext';

// Uso: const manejarSesionExpirada = useSesionExpirada(navigation);
// ... catch (err) { if (esSesionExpirada(err)) return manejarSesionExpirada(cuenta); ... }
//
// Borra el token vencido de esa cuenta (sin sacarla de la lista, para no
// perder branding/email) y manda directo a LoginBarrio con el email precargado,
// en vez de dejar a la pantalla mostrando "no se pudo cargar" para siempre.
export function useSesionExpirada(navigation) {
  const { invalidarSesion } = useCuentas();

  // Envuelto en useCallback: las pantallas que lo llaman lo meten en el
  // array de dependencias de su propio useCallback/useEffect de carga. Sin
  // memoizar, esta funcion cambiaba de identidad en cada render y eso
  // encadenaba un loop infinito (cargar -> setCargando -> re-render ->
  // nueva funcion -> cargar de nuevo...).
  return useCallback(async function manejarSesionExpirada(cuenta) {
    await invalidarSesion(cuenta.id);
    // reset(), a diferencia de navigate(), no burbujea al Stack padre: en las
    // pantallas que ahora viven dentro de las pestañas (Invitaciones, Accesos)
    // hay que resetear el Stack de arriba, no la pestaña actual. En las que
    // siguen siendo pantallas sueltas del Stack, getParent() no existe y se
    // usa la navigation propia (mismo resultado).
    (navigation.getParent() ?? navigation).reset({
      index: 0,
      routes: [{
        name: 'LoginBarrio',
        params: { url: cuenta.url, nombre: cuenta.branding?.nombre, email: cuenta.email, motivo: 'expirada' },
      }],
    });
  }, [navigation, invalidarSesion]);
}
