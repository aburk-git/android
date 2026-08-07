import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { crearClienteBarrio, obtenerTelefonos } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import { esSesionExpirada } from '../utils/erroresApi';
import { useSesionExpirada } from '../utils/useSesionExpirada';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

// Agenda de telefonos utiles del barrio, de solo lectura: el alta/edicion y el
// reordenamiento viven en la web (permisos telefonos.crear / telefonos.editar).
// Aca lo que suma es el acceso rapido: tocar el numero llama y tocar el correo
// abre el mail, sin tener que copiar y pegar nada.
export default function TelefonosScreen({ navigation, route }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const manejarSesionExpirada = useSesionExpirada(navigation);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const [telefonos, setTelefonos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    obtenerTelefonos(cliente)
      .then((data) => {
        if (cancelado) return;
        // Los inactivos no se muestran: en una lista pensada para llamar de
        // una, ofrecer un numero dado de baja es peor que no mostrarlo.
        setTelefonos((data.data ?? data).filter((t) => t.estado !== 'inactivo'));
      })
      .catch((err) => {
        if (cancelado) return;
        if (esSesionExpirada(err)) { manejarSesionExpirada(cuenta); return; }
        setError('No se pudieron cargar los telefonos.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [cliente, cuenta, manejarSesionExpirada]);

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
      data={telefonos}
      keyExtractor={(t) => String(t.id_telefono)}
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no hay teléfonos cargados.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.circuloIcono}>
            {/* La web guarda el icono como clase de Bootstrap Icons (bi-*), que
                no existe en React Native: aca se usa el mismo icono para todos. */}
            <MaterialCommunityIcons name="phone" size={20} color={colors.onPrimary} />
          </View>

          <View style={styles.cuerpo}>
            <Text style={styles.nombre}>{item.nombre}</Text>

            {item.telefono ? (
              <Pressable
                style={styles.filaDato}
                onPress={() => Linking.openURL(`tel:${item.telefono}`)}
                accessibilityRole="link"
                accessibilityLabel={`Llamar a ${item.nombre} al ${item.telefono}`}
              >
                <Text style={styles.detalle}>
                  Teléfono: <Text style={styles.link}>{item.telefono}</Text>
                </Text>
              </Pressable>
            ) : null}

            {item.correo ? (
              <Pressable
                style={styles.filaDato}
                onPress={() => Linking.openURL(`mailto:${item.correo}`)}
                accessibilityRole="link"
                accessibilityLabel={`Enviar un correo a ${item.nombre}, ${item.correo}`}
              >
                <Text style={styles.detalle}>
                  Correo: <Text style={styles.link}>{item.correo}</Text>
                </Text>
              </Pressable>
            ) : null}

            <Text style={styles.nota}>Nota: {item.descripcion || 'Sin notas'}</Text>
          </View>
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
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      ...sombraCard,
    },
    circuloIcono: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cuerpo: { flex: 1 },
    nombre: { fontSize: 17, fontWeight: '600', color: colors.text },
    // Touch target minimo de 48dp (Material 3): el texto solo mide ~18dp.
    filaDato: { minHeight: 44, justifyContent: 'center' },
    detalle: { fontSize: 15, color: colors.textMuted },
    link: { color: colors.primary, fontWeight: '600' },
    nota: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  });
}
