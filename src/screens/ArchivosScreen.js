import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { crearClienteBarrio, obtenerArchivos } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import { esSesionExpirada } from '../utils/erroresApi';
import { useSesionExpirada } from '../utils/useSesionExpirada';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

function formatoTamano(bytes) {
  if (!bytes) return null;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Cada subcarpeta empuja una nueva instancia de esta misma pantalla (con
// otro carpetaId): la flecha nativa de "volver" ya resuelve subir un nivel,
// no hace falta manejar breadcrumbs a mano.
export default function ArchivosScreen({ navigation, route }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentaId, carpetaId, nombreCarpeta } = route.params;
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const manejarSesionExpirada = useSesionExpirada(navigation);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const [carpetas, setCarpetas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: nombreCarpeta ?? 'Archivos' });
  }, [navigation, nombreCarpeta]);

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerArchivos(cliente, carpetaId);
      setCarpetas(data.carpetas);
      setArchivos(data.archivos);
    } catch (err) {
      if (esSesionExpirada(err)) { manejarSesionExpirada(cuenta); return; }
      setError('No se pudo cargar el contenido de la carpeta.');
    }
  }, [cliente, carpetaId, cuenta, manejarSesionExpirada]);

  useEffect(() => {
    setCargando(true);
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  function abrirCarpeta(carpeta) {
    navigation.push('Archivos', { cuentaId, carpetaId: carpeta.id_carpeta, nombreCarpeta: carpeta.nombre });
  }

  function abrirArchivo(archivo) {
    Linking.openURL(archivo.url).catch(() => {});
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

  const items = [
    ...carpetas.map((c) => ({ tipo: 'carpeta', ...c })),
    ...archivos.map((a) => ({ tipo: 'archivo', ...a })),
  ];

  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={[styles.lista, { paddingBottom: 16 + insets.bottom }]}
      data={items}
      keyExtractor={(item) => `${item.tipo}-${item.id_carpeta ?? item.id_archivo}`}
      ListEmptyComponent={<Text style={styles.vacio}>Esta carpeta está vacía.</Text>}
      renderItem={({ item }) =>
        item.tipo === 'carpeta' ? (
          <Pressable
            style={styles.fila}
            onPress={() => abrirCarpeta(item)}
            accessibilityRole="button"
            accessibilityLabel={`Carpeta ${item.nombre}`}
          >
            <MaterialCommunityIcons name="folder" size={28} color={colors.primary} />
            <Text style={styles.nombre}>{item.nombre}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.fila}
            onPress={() => abrirArchivo(item)}
            accessibilityRole="button"
            accessibilityLabel={`Archivo ${item.nombre}`}
          >
            <MaterialCommunityIcons name="file-document-outline" size={26} color={colors.textMuted} />
            <View style={styles.infoArchivo}>
              <Text style={styles.nombre} numberOfLines={1}>{item.nombre}</Text>
              {formatoTamano(item.tamano_bytes) ? <Text style={styles.detalle}>{formatoTamano(item.tamano_bytes)}</Text> : null}
            </View>
          </Pressable>
        )
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
    vacio: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      minHeight: 48,
      ...sombraCard,
    },
    nombre: { fontSize: 16, color: colors.text, flex: 1 },
    infoArchivo: { flex: 1 },
    detalle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  });
}
