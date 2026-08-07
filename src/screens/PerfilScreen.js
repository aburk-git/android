import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCuentas } from '../context/CuentasContext';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';
import TarjetaAccion from '../components/TarjetaAccion';

// Pestaña "Mi perfil": antes esto era un menu desplegable escondido detras de
// un icono en el header (BotonMenuPerfil en App.js); como pestaña propia
// queda mas visible y deja lugar para mostrar los datos de la cuenta arriba.
export default function PerfilScreen({ navigation, route }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas, quitarCuenta } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);

  const esPropietario = cuenta.usuario.rol === 'Propietario' && cuenta.lotes?.length;
  const subtitulo = esPropietario
    ? (cuenta.lotes.length > 1 ? `Lotes ${cuenta.lotes.join(', ')}` : `Lote ${cuenta.lotes[0]}`)
    : cuenta.usuario.rol;
  const inicial = cuenta.usuario.nombre?.[0]?.toUpperCase() ?? '?';

  function confirmarSalir() {
    Alert.alert('Salir', '¿Cerrar esta sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          // Salir de verdad: saca la cuenta de la lista (no solo desactiva
          // el token) y manda a la pantalla de DNI, como si nunca hubiera
          // habido una cuenta guardada en este dispositivo para este barrio.
          // Para cambiar de cuenta sin perderla esta "Cambiar de barrio".
          await quitarCuenta(cuenta.id);
          // reset(), a diferencia de navigate(), no burbujea al Stack padre:
          // hay que resetear el navigator de arriba, no la pestaña actual.
          (navigation.getParent() ?? navigation).reset({ index: 0, routes: [{ name: 'BuscarDni' }] });
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.scroll}>
      <View style={styles.tarjetaUsuario}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{inicial}</Text>
        </View>
        <Text style={styles.nombre}>{cuenta.usuario.nombre} {cuenta.usuario.apellido}</Text>
        <Text style={styles.detalle}>{cuenta.email}</Text>
        <Text style={styles.detalle}>{subtitulo} · {cuenta.branding?.nombre ?? cuenta.url}</Text>
      </View>

      <TarjetaAccion
        icono="lock-reset"
        titulo="Cambiar contraseña"
        descripcion="Actualizá tu contraseña de acceso"
        onPress={() => navigation.navigate('CambiarPassword', { cuentaId: cuenta.id })}
        style={styles.tarjeta}
      />

      {cuentas.length > 1 && (
        <TarjetaAccion
          icono="swap-horizontal"
          titulo="Cambiar de barrio"
          descripcion="Elegí otra de tus cuentas guardadas"
          onPress={() => navigation.navigate('Home')}
          style={styles.tarjeta}
        />
      )}

      <TarjetaAccion
        icono="logout"
        titulo="Salir"
        descripcion="Cerrar sesión en este barrio"
        onPress={confirmarSalir}
        style={[styles.tarjeta, styles.tarjetaSalir]}
      />
    </ScrollView>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20, gap: 12 },
    tarjetaUsuario: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 24,
      marginBottom: 8,
      ...sombraCard,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    avatarTexto: { color: colors.onPrimary, fontSize: 26, fontWeight: '700' },
    nombre: { fontSize: 19, fontWeight: '700', color: colors.text },
    detalle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
    tarjeta: { marginBottom: 12 },
    tarjetaSalir: { marginTop: 8 },
  });
}
