import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { crearClienteBarrio, marcarNotificacionLeida, obtenerNotificaciones } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import { esSesionExpirada } from '../utils/erroresApi';
import { useSesionExpirada } from '../utils/useSesionExpirada';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

function formatoFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificacionesScreen({ navigation, route }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const manejarSesionExpirada = useSesionExpirada(navigation);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerNotificaciones(cliente);
      setNotificaciones(data.data ?? data);
    } catch (err) {
      if (esSesionExpirada(err)) { manejarSesionExpirada(cuenta); return; }
      setError('No se pudieron cargar las notificaciones.');
    }
  }, [cliente, cuenta, manejarSesionExpirada]);

  useEffect(() => {
    setCargando(true);
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  async function abrir(notif) {
    if (notif.leida) return;
    // Optimista: se marca leida en pantalla ya mismo, sin esperar la respuesta.
    setNotificaciones((actuales) => actuales.map((n) => (n.id_notificacion === notif.id_notificacion ? { ...n, leida: true } : n)));
    try {
      await marcarNotificacionLeida(cliente, notif.id_notificacion);
    } catch (err) {
      cargar();
    }
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
      data={notificaciones}
      keyExtractor={(n) => String(n.id_notificacion)}
      ListEmptyComponent={<Text style={styles.vacio}>No tenés notificaciones todavía.</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.card, !item.leida && styles.cardNoLeida]}
          onPress={() => abrir(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.leida ? '' : 'Sin leer. '}${item.mensaje}, ${formatoFecha(item.fecha)}`}
        >
          {!item.leida && <View style={styles.puntoNoLeida} />}
          <View style={styles.contenido}>
            <Text style={styles.mensaje}>{item.mensaje}</Text>
            <Text style={styles.detalle}>{formatoFecha(item.fecha)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
    error: { color: colors.danger, fontSize: 16 },
    lista: { padding: 16 },
    vacio: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      gap: 10,
      ...sombraCard,
    },
    cardNoLeida: { borderLeftWidth: 3, borderLeftColor: colors.primary },
    puntoNoLeida: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
    contenido: { flex: 1 },
    mensaje: { fontSize: 16, color: colors.text },
    detalle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  });
}
