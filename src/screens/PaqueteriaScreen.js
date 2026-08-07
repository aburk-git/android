import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { crearClienteBarrio, marcarPaqueteRetirado, obtenerPaquetes } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import { esSesionExpirada } from '../utils/erroresApi';
import { useSesionExpirada } from '../utils/useSesionExpirada';
import Boton from '../components/Boton';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

function formatoFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PaqueteriaScreen({ navigation, route }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const manejarSesionExpirada = useSesionExpirada(navigation);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);
  // paqueteria.crear tambien habilita marcar como retirado (mismo permiso que
  // usa el backend para el PATCH /:id/retirado). Un Propietario normalmente
  // no lo tiene: solo mira su lista.
  const puedeRetirar = cuenta.usuario.permisos?.includes('paqueteria.crear');

  const [paquetes, setPaquetes] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async (paginaAPedir) => {
    try {
      const data = await obtenerPaquetes(cliente, paginaAPedir);
      setPaquetes((actuales) => (paginaAPedir === 1 ? data.data : [...actuales, ...data.data]));
      setTotalPaginas(data.paginacion.total_paginas);
      setPage(paginaAPedir);
    } catch (err) {
      if (esSesionExpirada(err)) { manejarSesionExpirada(cuenta); return; }
      setError('No se pudieron cargar los paquetes.');
    }
  }, [cliente, cuenta, manejarSesionExpirada]);

  useEffect(() => {
    setCargando(true);
    cargar(1).finally(() => setCargando(false));
  }, [cargar]);

  async function pedirMas() {
    if (cargandoMas || page >= totalPaginas) return;
    setCargandoMas(true);
    await cargar(page + 1);
    setCargandoMas(false);
  }

  function confirmarRetiro(paquete) {
    Alert.alert('Marcar como retirado', `¿Confirmar el retiro del paquete${paquete.descripcion ? ` (${paquete.descripcion})` : ''}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            await marcarPaqueteRetirado(cliente, paquete.id_paquete);
            cargar(1);
          } catch (err) {
            Alert.alert('No se pudo actualizar', err.response?.data?.error ?? 'Intentá de nuevo');
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
      data={paquetes}
      keyExtractor={(p) => String(p.id_paquete)}
      onEndReachedThreshold={0.3}
      onEndReached={pedirMas}
      ListEmptyComponent={<Text style={styles.vacio}>No hay paquetes registrados.</Text>}
      ListFooterComponent={cargandoMas ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.filaSuperior}>
            <Text style={styles.titulo}>{item.empresa || item.descripcion || 'Paquete'}</Text>
            <View style={[styles.badge, item.estado === 'retirado' ? styles.badgeRetirado : styles.badgePendiente]}>
              <Text style={styles.badgeTexto}>{item.estado === 'retirado' ? 'Retirado' : 'Pendiente'}</Text>
            </View>
          </View>
          {item.empresa && item.descripcion ? <Text style={styles.detalle}>{item.descripcion}</Text> : null}
          <Text style={styles.detalle}>Llegó el {formatoFecha(item.fecha_creacion)}</Text>
          {item.estado === 'retirado' && item.fecha_retiro ? (
            <Text style={styles.detalle}>Retirado el {formatoFecha(item.fecha_retiro)}</Text>
          ) : null}
          {puedeRetirar && item.estado !== 'retirado' && (
            <Boton titulo="Marcar retirado" variante="outline" style={styles.boton} onPress={() => confirmarRetiro(item)} />
          )}
        </View>
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
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      ...sombraCard,
    },
    filaSuperior: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    titulo: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1, marginRight: 8 },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
    badgePendiente: { backgroundColor: colors.warning },
    badgeRetirado: { backgroundColor: colors.success },
    badgeTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
    detalle: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
    boton: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 8 },
  });
}
