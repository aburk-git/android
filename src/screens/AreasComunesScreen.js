import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelarReserva, crearClienteBarrio, obtenerAreasComunes, obtenerReservas } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import { esSesionExpirada } from '../utils/erroresApi';
import { useSesionExpirada } from '../utils/useSesionExpirada';
import Boton from '../components/Boton';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

function formatoHora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

function formatoFecha(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

export default function AreasComunesScreen({ navigation, route }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const manejarSesionExpirada = useSesionExpirada(navigation);
  // Ver comentario en AccesosScreen: sin memorizar, "cliente" cambia en cada
  // render y el useEffect de mas abajo entra en loop infinito.
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const [areas, setAreas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [areasData, reservasData] = await Promise.all([obtenerAreasComunes(cliente), obtenerReservas(cliente)]);
      setAreas(areasData);
      setReservas(reservasData);
    } catch (err) {
      if (esSesionExpirada(err)) { manejarSesionExpirada(cuenta); return; }
      setError('No se pudo cargar la informacion de areas comunes.');
    }
  }, [cliente, cuenta, manejarSesionExpirada]);

  useEffect(() => {
    setCargando(true);
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  // La pantalla se re-carga sola al volver de "Nueva reserva" (foco de navegacion).
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', cargar);
    return unsubscribe;
  }, [navigation, cargar]);

  function confirmarCancelar(reserva) {
    Alert.alert('Cancelar reserva', `¿Cancelar la reserva de ${reserva.area_comun.nombre} del ${formatoFecha(reserva.fecha)}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelarReserva(cliente, reserva.id_reserva);
            cargar();
          } catch (err) {
            Alert.alert('No se pudo cancelar', err.response?.data?.error ?? 'Intentá de nuevo');
          }
        },
      },
    ]);
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centro}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={[styles.lista, { paddingBottom: 16 + insets.bottom }]}
      data={areas}
      keyExtractor={(a) => String(a.id_area_comun)}
      ListHeaderComponent={
        <>
          <Text style={styles.seccionTitulo}>Áreas comunes</Text>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.card} accessibilityLabel={`${item.nombre}${item.estado !== 'activa' ? `, no disponible (${item.estado})` : ''}`}>
          <Text style={styles.nombreArea}>{item.nombre}</Text>
          {item.descripcion ? <Text style={styles.detalle}>{item.descripcion}</Text> : null}
          {item.capacidad_maxima ? <Text style={styles.detalle}>Capacidad: {item.capacidad_maxima} personas</Text> : null}
          {item.estado !== 'activa' ? (
            <Text style={[styles.detalle, styles.textoInactivo]}>No disponible ({item.estado})</Text>
          ) : (
            <Boton
              titulo="Reservar"
              variante="outline"
              style={styles.botonReservar}
              onPress={() => navigation.navigate('NuevaReserva', { cuentaId: cuenta.id, area: item })}
            />
          )}
        </View>
      )}
      ListFooterComponent={
        <View style={styles.seccionReservas}>
          <Text style={styles.seccionTitulo}>Mis reservas</Text>
          {reservas.length === 0 && <Text style={styles.vacio}>No tenés reservas activas.</Text>}
          {reservas.map((r) => (
            <View
              key={r.id_reserva}
              style={styles.card}
              accessibilityLabel={`${r.area_comun.nombre}, ${formatoFecha(r.fecha)}, de ${formatoHora(r.hora_inicio)} a ${formatoHora(r.hora_fin)}`}
            >
              <Text style={styles.nombreArea}>{r.area_comun.nombre}</Text>
              <Text style={styles.detalle}>
                {formatoFecha(r.fecha)} · {formatoHora(r.hora_inicio)} a {formatoHora(r.hora_fin)}
              </Text>
              <Boton titulo="Cancelar" variante="danger" style={styles.botonReservar} onPress={() => confirmarCancelar(r)} />
            </View>
          ))}
        </View>
      }
    />
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
    error: { color: colors.danger, fontSize: 16 },
    lista: { padding: 16 },
    seccionTitulo: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 10 },
    seccionReservas: { marginTop: 12 },
    vacio: { color: colors.textMuted, fontSize: 15, marginBottom: 8 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      ...sombraCard,
    },
    nombreArea: { fontSize: 17, fontWeight: '600', color: colors.text },
    detalle: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
    textoInactivo: { color: colors.danger },
    // Compacto y alineado a la derecha, como una accion secundaria de la
    // tarjeta (no estirado a todo el ancho, que se veia muy "inflado").
    botonReservar: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 8 },
  });
}
