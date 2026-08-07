import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/colors';

// Titulo de header comun a las 4 pestañas principales: logo (si el barrio
// cargo uno en Configuracion) + nombre + lote (Propietario) o rol
// (Guardia/Administrador), igual en todas para que el usuario siempre sepa
// en que cuenta esta parado sin importar la pestaña.
export default function EncabezadoBarrio({ cuenta }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const esPropietario = cuenta.usuario.rol === 'Propietario' && cuenta.lotes?.length;
  const subtitulo = esPropietario
    ? (cuenta.lotes.length > 1 ? `Lotes ${cuenta.lotes.join(', ')}` : `Lote ${cuenta.lotes[0]}`)
    : cuenta.usuario.rol;

  return (
    <View style={styles.contenedor}>
      {cuenta.branding?.logo_url ? (
        <Image source={{ uri: cuenta.branding.logo_url }} style={styles.logo} accessibilityLabel="" />
      ) : null}
      <View>
        <Text style={styles.nombre} numberOfLines={1}>{cuenta.branding?.nombre ?? cuenta.url}</Text>
        <Text style={styles.subtitulo} numberOfLines={1}>{subtitulo}</Text>
      </View>
    </View>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    contenedor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logo: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.onPrimary },
    nombre: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
    subtitulo: { fontSize: 13, color: colors.onPrimary, opacity: 0.85, marginTop: 1 },
  });
}
