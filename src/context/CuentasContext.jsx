import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginBarrio } from '../api/barrio';

const CLAVE_STORAGE = 'cuentas_barrios';
const CuentasContext = createContext(null);

// Una "cuenta" = un barrio en el que el usuario ya inicio sesion, con su
// propio token. El usuario puede tener varias a la vez (una por barrio) y
// cambiar cual esta activa sin volver a loguearse.
export function CuentasProvider({ children }) {
  const [cuentas, setCuentas] = useState([]);
  const [idBarrioActivo, setIdBarrioActivo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_STORAGE).then((guardado) => {
      if (guardado) {
        const parseado = JSON.parse(guardado);
        setCuentas(parseado);
        if (parseado.length > 0) setIdBarrioActivo(parseado[0].id_barrio);
      }
      setCargando(false);
    });
  }, []);

  async function guardar(nuevasCuentas) {
    setCuentas(nuevasCuentas);
    await AsyncStorage.setItem(CLAVE_STORAGE, JSON.stringify(nuevasCuentas));
  }

  async function agregarCuenta(barrio, email, password) {
    const { token, usuario } = await loginBarrio(barrio.url, email, password);
    const cuenta = {
      id_barrio: barrio.id_barrio,
      nombre: barrio.nombre,
      url: barrio.url,
      token,
      usuario,
    };
    const restantes = cuentas.filter((c) => c.id_barrio !== barrio.id_barrio);
    const nuevas = [...restantes, cuenta];
    await guardar(nuevas);
    setIdBarrioActivo(barrio.id_barrio);
    return cuenta;
  }

  async function quitarCuenta(idBarrio) {
    const nuevas = cuentas.filter((c) => c.id_barrio !== idBarrio);
    await guardar(nuevas);
    if (idBarrioActivo === idBarrio) {
      setIdBarrioActivo(nuevas[0]?.id_barrio ?? null);
    }
  }

  const cuentaActiva = cuentas.find((c) => c.id_barrio === idBarrioActivo) ?? null;

  return (
    <CuentasContext.Provider
      value={{ cuentas, cuentaActiva, idBarrioActivo, setIdBarrioActivo, agregarCuenta, quitarCuenta, cargando }}
    >
      {children}
    </CuentasContext.Provider>
  );
}

export function useCuentas() {
  return useContext(CuentasContext);
}
