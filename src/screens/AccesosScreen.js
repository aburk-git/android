import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { crearClienteBarrio, obtenerAccesos } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import { esSesionExpirada } from '../utils/erroresApi';
import { useSesionExpirada } from '../utils/useSesionExpirada';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

function nombrePersona(acceso) {
  if (acceso.visitante) return `${acceso.visitante.nombre} ${acceso.visitante.apellido ?? ''}`.trim();
  if (acceso.propietario) return `${acceso.propietario.usuario.nombre} ${acceso.propietario.usuario.apellido}`;
  if (acceso.empleado) return `${acceso.empleado.usuario.nombre} ${acceso.empleado.usuario.apellido}`;
  if (acceso.vehiculo) return acceso.vehiculo.patente;
  return 'Sin identificar';
}

function formatoFecha(iso) {
  const fecha = new Date(iso);
  return fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AccesosScreen({ navigation, route }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const manejarSesionExpirada = useSesionExpirada(navigation);
  // Memorizado por url+token (no por la cuenta entera): si no, se crea un
  // cliente axios nuevo en cada render y el useEffect de mas abajo (que
  // depende de "cargar", que depende de "cliente") entra en loop infinito.
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const [accesos, setAccesos] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async (paginaAPedir) => {
    try {
      const data = await obtenerAccesos(cliente, paginaAPedir);
      setAccesos((actuales) => (paginaAPedir === 1 ? data.data : [...actuales, ...data.data]));
      setTotalPaginas(data.paginacion.total_paginas);
      setPage(paginaAPedir);
    } catch (err) {
      if (esSesionExpirada(err)) { manejarSesionExpirada(cuenta); return; }
      setError('No se pudieron cargar los accesos.');
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
    <View style={styles.pantalla}>
      <FlatList
        data={accesos}
        keyExtractor={(a) => String(a.id_acceso)}
        contentContainerStyle={styles.lista}
        onEndReachedThreshold={0.3}
        onEndReached={pedirMas}
        ListEmptyComponent={<Text style={styles.vacio}>No hay accesos registrados todavía.</Text>}
        ListFooterComponent={cargandoMas ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
        renderItem={({ item }) => (
          <View
            style={styles.card}
            accessibilityLabel={`${nombrePersona(item)}, ${item.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}, ${formatoFecha(item.fecha_hora)}${item.puesto?.nombre ? `, ${item.puesto.nombre}` : ''}`}
          >
            <View style={styles.filaSuperior}>
              <Text style={styles.persona}>{nombrePersona(item)}</Text>
              <View style={[styles.badge, item.tipo === 'ingreso' ? styles.badgeIngreso : styles.badgeEgreso]}>
                <Text style={styles.badgeTexto}>{item.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</Text>
              </View>
            </View>
            <Text style={styles.detalle}>{formatoFecha(item.fecha_hora)}</Text>
            {item.puesto?.nombre && <Text style={styles.detalle}>{item.puesto.nombre}</Text>}
          </View>
        )}
      />
    </View>
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
    persona: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1, marginRight: 8 },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
    badgeIngreso: { backgroundColor: colors.success },
    badgeEgreso: { backgroundColor: colors.textMuted },
    badgeTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
    detalle: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  });
}
