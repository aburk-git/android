import { useMemo } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCuentas } from '../context/CuentasContext';
import Boton from '../components/Boton';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

// Para un Propietario se muestra "Lote X" (o "Lotes X, Y") en vez del nombre
// del rol; para Administrador/Guardia no hay lote, se mantiene el rol.
function subtituloCuenta(item) {
  if (item.usuario.rol === 'Propietario' && item.lotes?.length) {
    return item.lotes.length > 1 ? `Lotes ${item.lotes.join(', ')}` : `Lote ${item.lotes[0]}`;
  }
  return item.usuario.rol;
}

export default function HomeScreen({ navigation }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas, elegirCuenta, quitarCuenta } = useCuentas();

  async function abrir(cuenta) {
    // Sin token (por un 401 en alguna pantalla, o porque el usuario toco
    // "Salir" en Mi perfil) no tiene sentido ir al Panel: se manda directo a
    // re-loguear con el email ya cargado. Sin "motivo" porque aca fue una
    // accion deliberada (tocar la cuenta), no hace falta explicar nada.
    if (!cuenta.token) {
      navigation.navigate('LoginBarrio', { url: cuenta.url, nombre: cuenta.branding?.nombre, email: cuenta.email });
      return;
    }
    await elegirCuenta(cuenta.id);
    navigation.navigate('MainTabs', { cuentaId: cuenta.id });
  }

  function confirmarQuitar(cuenta) {
    Alert.alert(
      'Quitar cuenta',
      `¿Cerrar sesión en "${cuenta.branding?.nombre ?? cuenta.url}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: () => quitarCuenta(cuenta.id) },
      ]
    );
  }

  return (
    <View style={styles.pantalla}>
      {cuentas.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.vacioTexto}>Todavía no agregaste ningún barrio.</Text>
          <Boton titulo="Buscar por DNI" onPress={() => navigation.navigate('BuscarDni')} />
        </View>
      ) : (
        <FlatList
          data={cuentas}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => abrir(item)}
              onLongPress={() => confirmarQuitar(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.branding?.nombre ?? item.url}, ${item.usuario.nombre} ${item.usuario.apellido}, ${item.token ? subtituloCuenta(item) : 'sin sesión activa'}`}
              accessibilityHint="Mantené presionado para quitar esta cuenta"
            >
              {item.branding?.logo_url ? (
                <Image source={{ uri: item.branding.logo_url }} style={styles.logo} accessibilityLabel="" />
              ) : (
                <View style={[styles.logo, styles.logoVacio]} />
              )}
              <View style={styles.info}>
                <Text style={styles.nombreBarrio}>{item.branding?.nombre ?? item.url}</Text>
                <Text style={[styles.nombreUsuario, !item.token && styles.sinSesion]}>
                  {item.usuario.nombre} {item.usuario.apellido} · {item.token ? subtituloCuenta(item) : 'Sin sesión activa, tocá para reingresar'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg },
    lista: { padding: 16, paddingBottom: 24 },
    vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
    vacioTexto: { color: colors.textMuted, fontSize: 16, textAlign: 'center' },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      minHeight: 48,
      ...sombraCard,
    },
    logo: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
    logoVacio: { backgroundColor: colors.border },
    info: { flex: 1 },
    nombreBarrio: { fontSize: 17, fontWeight: '600', color: colors.text },
    nombreUsuario: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
    sinSesion: { color: colors.warning, fontWeight: '600' },
  });
}
