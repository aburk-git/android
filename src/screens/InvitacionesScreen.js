import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { cancelarInvitacion, crearClienteBarrio, obtenerBarrio, obtenerInvitaciones } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import { esSesionExpirada } from '../utils/erroresApi';
import { useSesionExpirada } from '../utils/useSesionExpirada';
import Boton from '../components/Boton';
import TarjetaAccion from '../components/TarjetaAccion';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

const NOMBRES_DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatearDias(diasCsv) {
  if (!diasCsv) return '-';
  return diasCsv.split(',').filter(Boolean).map((d) => NOMBRES_DIA_CORTO[Number(d)]).join(', ');
}

function formatoFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// El estado persistido lo marca una tarea que corre cada 1 hora, asi que una
// invitacion recien vencida puede seguir figurando como "vigente": se recalcula
// aca igual que en los reportes de la web para no mostrar un dato viejo.
function estadoReal(inv) {
  if (inv.estado === 'vigente' && inv.tipo !== 'trabajador' && inv.fecha_valido_hasta
      && new Date(inv.fecha_valido_hasta) < new Date()) {
    return 'vencida';
  }
  return inv.estado ?? '-';
}

export default function InvitacionesScreen({ navigation, route }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const manejarSesionExpirada = useSesionExpirada(navigation);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  // Mismos permisos que oculta/muestra la web en Invitaciones.jsx. El backend
  // los vuelve a exigir en cada endpoint; esto es solo para no ofrecer botones
  // que van a terminar en un 403.
  const permisos = cuenta.usuario.permisos ?? [];
  const puedeCrear = permisos.includes('invitaciones.crear');
  const puedeCancelar = permisos.includes('invitaciones.cancelar');

  const [invitaciones, setInvitaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // Invitar desde la agenda manda el link por WhatsApp: solo tiene sentido
  // ofrecerlo si el barrio tiene ese canal habilitado (igual que la web).
  const [whatsappHabilitado, setWhatsappHabilitado] = useState(false);

  useEffect(() => {
    obtenerBarrio(cliente, cuenta.usuario.id_barrio)
      .then((data) => setWhatsappHabilitado(Boolean(data.configuracion?.whatsapp_invitaciones_habilitado)))
      .catch(() => setWhatsappHabilitado(false));
  }, [cliente, cuenta.usuario.id_barrio]);

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerInvitaciones(cliente);
      setInvitaciones(data.data ?? data);
      setError('');
    } catch (err) {
      if (esSesionExpirada(err)) { manejarSesionExpirada(cuenta); return; }
      setError('No se pudieron cargar las invitaciones.');
    }
  }, [cliente, cuenta, manejarSesionExpirada]);

  useEffect(() => {
    setCargando(true);
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  // Se recarga sola al volver de "Nueva invitacion".
  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  // Una invitacion de trabajador no vence (queda hasta que la cancelen); una
  // puntual solo se puede cancelar mientras siga dentro de su ventana.
  function sePuedeCancelar(inv) {
    if (!puedeCancelar || inv.estado !== 'vigente') return false;
    if (inv.tipo === 'trabajador') return true;
    return new Date(inv.fecha_valido_hasta) > new Date();
  }

  function confirmarCancelar(inv) {
    const quien = `${inv.visitante?.nombre ?? ''} ${inv.visitante?.apellido ?? ''}`.trim() || 'este visitante';
    Alert.alert('Cancelar invitación', `¿Cancelar la invitación de ${quien}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelarInvitacion(cliente, inv.id_invitacion);
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

  const colorEstado = {
    vigente: colors.success,
    vencida: colors.danger,
    cancelada: colors.textMuted,
    usada: colors.textMuted,
  };

  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.lista}
      data={invitaciones}
      keyExtractor={(i) => String(i.id_invitacion)}
      ListHeaderComponent={
        puedeCrear ? (
          <View style={styles.tarjetasAccion}>
            <TarjetaAccion
              icono="account-plus-outline"
              titulo="Nueva invitación"
              descripcion="Autorizá el ingreso de un visitante o trabajador"
              onPress={() => navigation.navigate('NuevaInvitacion', { cuentaId: cuenta.id })}
            />
            {whatsappHabilitado && (
              <TarjetaAccion
                icono="whatsapp"
                titulo="Invitar desde mis contactos"
                descripcion="Mandá el link de invitación por WhatsApp"
                onPress={() => navigation.navigate('InvitarContactos', { cuentaId: cuenta.id })}
              />
            )}
            <Text style={styles.seccionTitulo}>Mis invitaciones</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no generaste invitaciones.</Text>}
      renderItem={({ item }) => {
        const estado = estadoReal(item);
        const visitante = `${item.visitante?.nombre ?? ''} ${item.visitante?.apellido ?? ''}`.trim();
        return (
          <View style={styles.card}>
            <View style={styles.filaSuperior}>
              <Text style={styles.titulo}>{visitante || 'Pendiente de datos'}</Text>
              <View style={[styles.badge, { backgroundColor: colorEstado[estado] ?? colors.textMuted }]}>
                <Text style={styles.badgeTexto}>{estado}</Text>
              </View>
            </View>

            <Text style={styles.detalle}>
              {item.tipo === 'trabajador' ? 'Trabajador' : 'Visita'}
              {item.numero_lote ?? item.propietario?.numero_lote
                ? ` · Lote ${item.numero_lote ?? item.propietario?.numero_lote}`
                : ''}
              {item.canal_envio === 'whatsapp' ? ' · WhatsApp' : ' · Email'}
            </Text>

            {item.tipo === 'trabajador' ? (
              <Text style={styles.detalle}>Días: {formatearDias(item.dias_semana)} (recurrente)</Text>
            ) : (
              <Text style={styles.detalle}>
                Vale del {formatoFecha(item.fecha_valido_desde)} al {formatoFecha(item.fecha_valido_hasta)}
              </Text>
            )}

            {item.hora_ingreso_desde && item.hora_ingreso_hasta ? (
              <Text style={styles.detalle}>Horario: {item.hora_ingreso_desde} a {item.hora_ingreso_hasta}</Text>
            ) : null}

            {sePuedeCancelar(item) && (
              <Boton titulo="Cancelar" variante="danger" style={styles.botonCancelar} onPress={() => confirmarCancelar(item)} />
            )}
          </View>
        );
      }}
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
    tarjetasAccion: { gap: 12, marginBottom: 8 },
    seccionTitulo: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      ...sombraCard,
    },
    filaSuperior: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    titulo: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1, marginRight: 8 },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
    badgeTexto: { color: '#fff', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
    detalle: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
    botonCancelar: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 8 },
  });
}
