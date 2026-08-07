import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CuentasContext = createContext(null);

const CLAVE_CUENTAS = '@cuentas';
const CLAVE_ACTIVA = '@cuenta_activa_id';

// Una cuenta = un login exitoso contra el backend de UN barrio. El mismo DNI
// puede tener cuentas en varios barrios a la vez (ej: es propietario en uno y
// guardia en otro); se guardan todas y el usuario elige cual usar.
function idDeCuenta(url, email) {
  return `${url}::${email}`.toLowerCase();
}

export function CuentasProvider({ children }) {
  const [cuentas, setCuentas] = useState([]);
  const [cuentaActivaId, setCuentaActivaId] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [guardadas, activaId] = await Promise.all([
          AsyncStorage.getItem(CLAVE_CUENTAS),
          AsyncStorage.getItem(CLAVE_ACTIVA),
        ]);
        if (guardadas) setCuentas(JSON.parse(guardadas));
        if (activaId) setCuentaActivaId(activaId);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function guardarCuentas(nuevas) {
    setCuentas(nuevas);
    await AsyncStorage.setItem(CLAVE_CUENTAS, JSON.stringify(nuevas));
  }

  // id === null: cierra la sesion de la cuenta activa sin borrarla de la
  // lista guardada (a diferencia de quitarCuenta, que si la elimina), para
  // no perder el login guardado. Ej: "Salir" del menu de perfil.
  async function elegirCuenta(id) {
    setCuentaActivaId(id);
    if (id === null) {
      await AsyncStorage.removeItem(CLAVE_ACTIVA);
    } else {
      await AsyncStorage.setItem(CLAVE_ACTIVA, id);
    }
  }

  // { url, email, token, usuario, branding, lotes } -> agrega o actualiza
  // (re-login) y la deja como cuenta activa. "lotes" solo aplica a
  // Propietario: numeros de lote, para mostrar en vez del nombre del rol.
  // Devuelve tambien "todas" (la lista ya actualizada) porque el estado de
  // React (cuentas) todavia no se refleja en este mismo render: el que
  // llama necesita saber YA si esta era la unica cuenta, para saltear la
  // lista de "Mis barrios" cuando hay una sola.
  async function agregarCuenta({ url, email, token, usuario, branding, lotes }) {
    const id = idDeCuenta(url, email);
    const cuenta = { id, url, email, token, usuario, branding: branding ?? null, lotes: lotes ?? [] };
    const sinDuplicado = cuentas.filter((c) => c.id !== id);
    const todas = [...sinDuplicado, cuenta];
    await guardarCuentas(todas);
    await elegirCuenta(id);
    return { cuenta, todas };
  }

  // Se llama cuando el backend devuelve 401 (token vencido o invalidado por
  // sesion unica): a diferencia de quitarCuenta, no borra la cuenta de la
  // lista (para no perder branding/email), solo el token, asi LoginBarrioScreen
  // puede ofrecer un re-login rapido con el email ya cargado.
  async function invalidarSesion(id) {
    await guardarCuentas(cuentas.map((c) => (c.id === id ? { ...c, token: null } : c)));
  }

  async function quitarCuenta(id) {
    await guardarCuentas(cuentas.filter((c) => c.id !== id));
    if (cuentaActivaId === id) {
      setCuentaActivaId(null);
      await AsyncStorage.removeItem(CLAVE_ACTIVA);
    }
  }

  const cuentaActiva = useMemo(
    () => cuentas.find((c) => c.id === cuentaActivaId) ?? null,
    [cuentas, cuentaActivaId]
  );

  const value = { cuentas, cuentaActiva, cargando, agregarCuenta, quitarCuenta, elegirCuenta, invalidarSesion };

  return <CuentasContext.Provider value={value}>{children}</CuentasContext.Provider>;
}

export function useCuentas() {
  const ctx = useContext(CuentasContext);
  if (!ctx) throw new Error('useCuentas debe usarse dentro de CuentasProvider');
  return ctx;
}
