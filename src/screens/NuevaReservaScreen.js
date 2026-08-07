import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { crearClienteBarrio, crearReserva, obtenerBarrio, obtenerOcupados } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import Boton from '../components/Boton';
import Campo from '../components/Campo';
import { useColors } from '../theme/colors';
import {
  aMinutos,
  fechaISOEnZona,
  generarOpcionesHora,
  horaAMinutos,
  minutosAHora,
  minutosActualesEnZona,
  nombreDiaCorto,
} from '../utils/horarios';

const DIAS_ADELANTE = 45;

// Misma UX que ModalCrearReserva.jsx en la web: tira de dias arriba, grilla de
// horarios cada 30 min abajo (verde libre / rojo ocupado / gris pasado /
// amarillo tu seleccion), tocar inicio y despues fin.
export default function NuevaReservaScreen({ navigation, route }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentaId, area } = route.params;
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const [config, setConfig] = useState(null);
  const [fecha, setFecha] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [cantidadPersonas, setCantidadPersonas] = useState('');
  const [ocupados, setOcupados] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const zona = cuenta.usuario.zona_horaria ?? 'America/Argentina/Buenos_Aires';
  const horaApertura = config?.reservas_hora_apertura ?? '06:00';
  const horaCierre = config?.reservas_hora_cierre ?? '22:00';
  const OPCIONES_HORA = useMemo(() => generarOpcionesHora(horaApertura, horaCierre), [horaApertura, horaCierre]);
  const HOY_ISO = useMemo(() => fechaISOEnZona(zona), [zona]);

  const dias = useMemo(
    () => Array.from({ length: DIAS_ADELANTE }, (_, i) => fechaISOEnZona(zona, i)),
    [zona]
  );

  useEffect(() => {
    obtenerBarrio(cliente, cuenta.usuario.id_barrio)
      .then((data) => setConfig(data.configuracion ?? {}))
      .catch(() => setConfig({}));
    setFecha(fechaISOEnZona(zona));
  }, [cliente, cuenta.usuario.id_barrio, zona]);

  const cargarOcupados = useCallback(() => {
    if (!fecha) {
      setOcupados([]);
      return;
    }
    return obtenerOcupados(cliente, area.id_area_comun, fecha)
      .then((data) => setOcupados(data.data ?? data))
      .catch(() => setOcupados([]));
  }, [cliente, area.id_area_comun, fecha]);

  useEffect(() => {
    cargarOcupados();
  }, [cargarOcupados]);

  function esHoy(f) {
    return f === HOY_ISO;
  }

  function minutosActuales() {
    return minutosActualesEnZona(zona);
  }

  function horaOcupada(horaStr) {
    const inicioBloque = horaAMinutos(horaStr);
    const finBloque = inicioBloque + 30;
    return ocupados.some((o) => aMinutos(o.hora_inicio) < finBloque && aMinutos(o.hora_fin) > inicioBloque);
  }

  function horaPasada(horaStr) {
    return esHoy(fecha) && horaAMinutos(horaStr) <= minutosActuales();
  }

  function bloqueada(horaStr) {
    return horaOcupada(horaStr) || horaPasada(horaStr);
  }

  function slotSeleccionado(horaStr) {
    if (!horaInicio) return false;
    const m = horaAMinutos(horaStr);
    const ini = horaAMinutos(horaInicio);
    if (!horaFin) return m === ini;
    return m >= ini && m < horaAMinutos(horaFin);
  }

  function estadoSlot(horaStr) {
    if (slotSeleccionado(horaStr)) return 'tu selección';
    if (horaPasada(horaStr)) return 'ya pasó';
    if (horaOcupada(horaStr)) return 'ocupado';
    return 'libre';
  }

  function elegirDia(f) {
    setFecha(f);
    setHoraInicio('');
    setHoraFin('');
    setError('');
  }

  // Si el area tiene una duracion fija (minima = maxima), no tiene sentido
  // pedir un segundo toque para el fin: se calcula solo apenas se elige el inicio.
  const duracionFija = area.duracion_minima_minutos && area.duracion_minima_minutos === area.duracion_maxima_minutos
    ? area.duracion_minima_minutos
    : null;

  // Intenta cerrar el rango [iniMin, finMin). Devuelve true si quedo seleccionado.
  function intentarCerrarRango(iniMin, finMin) {
    const hayBloqueoEnElMedio = OPCIONES_HORA.some((h) => {
      const m = horaAMinutos(h);
      return m >= iniMin && m < finMin && bloqueada(h);
    });
    if (hayBloqueoEnElMedio) {
      setError('Hay un horario ocupado dentro del rango elegido.');
      return false;
    }

    const duracion = finMin - iniMin;
    const min = area.duracion_minima_minutos ?? 30;
    const max = area.duracion_maxima_minutos ?? 16 * 60;
    if (duracion < min) {
      setError(`La duracion minima es de ${min} minutos.`);
      return false;
    }
    if (duracion > max) {
      setError(`La duracion maxima es de ${max} minutos.`);
      return false;
    }

    setHoraFin(minutosAHora(finMin));
    return true;
  }

  function clickSlot(horaStr) {
    if (bloqueada(horaStr)) return;
    setError('');

    if (!horaInicio || horaFin) {
      setHoraInicio(horaStr);
      setHoraFin('');
      if (duracionFija) {
        const iniMin = horaAMinutos(horaStr);
        intentarCerrarRango(iniMin, iniMin + duracionFija);
      }
      return;
    }

    const iniMin = horaAMinutos(horaInicio);
    const clickMin = horaAMinutos(horaStr);
    if (clickMin < iniMin) {
      setHoraInicio(horaStr);
      setHoraFin('');
      if (duracionFija) {
        intentarCerrarRango(clickMin, clickMin + duracionFija);
      }
      return;
    }

    intentarCerrarRango(iniMin, clickMin + 30);
  }

  async function confirmar() {
    if (!horaInicio || !horaFin) {
      setError('Elegi un horario de inicio y de fin en la grilla');
      return;
    }
    if (area.capacidad_maxima && Number(cantidadPersonas) > area.capacidad_maxima) {
      setError(`La capacidad maxima de ${area.nombre} es de ${area.capacidad_maxima} personas`);
      return;
    }

    setError('');
    setCargando(true);
    try {
      await crearReserva(cliente, {
        id_area_comun: area.id_area_comun,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        cantidad_personas: cantidadPersonas || undefined,
      });
      // Antes volvia directo (navigation.goBack() sin avisar nada): quedaba
      // la sensacion de que la reserva "desaparecia". Ahora se queda un
      // cartel de confirmacion y solo vuelve cuando el usuario lo cierra.
      Alert.alert(
        'Reserva confirmada',
        `${area.nombre} — ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} de ${horaInicio} a ${horaFin}`,
        [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      setError(err.response?.data?.error ?? 'No se pudo crear la reserva');
      // Alguien pudo haber reservado ese horario justo antes que nosotros:
      // se limpia la seleccion (ya no es valida) y se refresca la grilla
      // para que se vea ocupado en vez de quedar como libre.
      setHoraInicio('');
      setHoraFin('');
      cargarOcupados();
    } finally {
      setCargando(false);
    }
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={[styles.scroll, { paddingBottom: 20 + insets.bottom }]}>
      <Text style={styles.titulo}>Reservar {area.nombre}</Text>
      {(area.duracion_minima_minutos || area.duracion_maxima_minutos) && (
        <Text style={styles.ayuda}>
          Duracion permitida: {area.duracion_minima_minutos ?? 0} a {area.duracion_maxima_minutos ?? '∞'} minutos
        </Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.seccionTitulo}>Fecha</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiraDias}>
        {dias.map((d) => {
          const seleccionado = d === fecha;
          const etiqueta = esHoy(d) ? 'Hoy' : nombreDiaCorto(d);
          return (
            <Pressable
              key={d}
              onPress={() => elegirDia(d)}
              style={[styles.chipDia, seleccionado && styles.chipDiaSeleccionado]}
              accessibilityRole="button"
              accessibilityLabel={`${etiqueta} ${d.slice(8, 10)}/${d.slice(5, 7)}`}
              accessibilityState={{ selected: seleccionado }}
            >
              <Text style={[styles.chipDiaTexto, seleccionado && styles.chipDiaTextoSeleccionado]}>
                {etiqueta}
              </Text>
              <Text style={[styles.chipDiaNumero, seleccionado && styles.chipDiaTextoSeleccionado]}>
                {d.slice(8, 10)}/{d.slice(5, 7)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {fecha ? (
        <>
          <Text style={styles.seccionTitulo}>
            Disponibilidad cada 30 min — tocá el horario de inicio y luego el de fin
          </Text>
          <View style={styles.grillaHoras}>
            {OPCIONES_HORA.map((h) => {
              const seleccionado = slotSeleccionado(h);
              const pasado = horaPasada(h);
              const ocupado = horaOcupada(h);
              const deshabilitado = bloqueada(h);
              const colorFondo = seleccionado
                ? colors.warning
                : pasado
                ? colors.textMuted
                : ocupado
                ? colors.danger
                : colors.success;
              return (
                <Pressable
                  key={h}
                  onPress={() => clickSlot(h)}
                  disabled={deshabilitado}
                  style={[styles.slot, { backgroundColor: colorFondo, opacity: deshabilitado && !seleccionado ? 0.6 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${h}, ${estadoSlot(h)}`}
                  accessibilityState={{ disabled: deshabilitado, selected: seleccionado }}
                >
                  <Text style={styles.slotTexto}>{h}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.referencias}>
            <Text style={styles.referenciaItem}><Text style={{ color: colors.success }}>●</Text> libre</Text>
            <Text style={styles.referenciaItem}><Text style={{ color: colors.warning }}>●</Text> tu selección</Text>
            <Text style={styles.referenciaItem}><Text style={{ color: colors.danger }}>●</Text> ocupado</Text>
            <Text style={styles.referenciaItem}><Text style={{ color: colors.textMuted }}>●</Text> ya pasó</Text>
          </View>
        </>
      ) : null}

      {area.capacidad_maxima ? (
        <Campo
          label={`Cantidad de personas (máx. ${area.capacidad_maxima})`}
          value={cantidadPersonas}
          onChangeText={(t) => setCantidadPersonas(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
        />
      ) : null}

      <Boton
        titulo="Confirmar reserva"
        onPress={confirmar}
        cargando={cargando}
        disabled={!horaInicio || !horaFin}
        style={styles.botonConfirmar}
      />
    </ScrollView>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    titulo: { fontSize: 19, fontWeight: '700', color: colors.text, marginBottom: 4 },
    ayuda: { fontSize: 14, color: colors.textMuted, marginBottom: 12 },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerContainer,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
      fontSize: 15,
    },
    seccionTitulo: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 8 },
    tiraDias: { marginBottom: 4 },
    chipDia: {
      width: 60,
      height: 60,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    chipDiaSeleccionado: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipDiaTexto: { fontSize: 13, color: colors.textMuted, textTransform: 'capitalize' },
    chipDiaNumero: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
    chipDiaTextoSeleccionado: { color: colors.onPrimary },
    grillaHoras: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    // Touch target minimo de 48dp (Material 3): antes esto medía ~32dp de alto.
    slot: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, minWidth: 60, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    slotTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
    referencias: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, marginBottom: 4 },
    referenciaItem: { fontSize: 14, color: colors.textMuted },
    botonConfirmar: { marginTop: 16 },
  });
}
