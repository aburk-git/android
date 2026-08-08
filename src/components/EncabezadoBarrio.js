import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/colors';

// Titulo de header comun a las 4 pestañas principales: nombre del barrio +
// lote (Propietario) o rol (Guardia/Administrador), igual en todas para que
// el usuario siempre sepa en que cuenta esta parado sin importar la pestaña.
// El logo va aparte, en headerLeft (ver LogoBarrio), para que este texto
// quede centrado de verdad y no arrastrado por el ancho del logo.
export default function EncabezadoBarrio({ cuenta }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const esPropietario = cuenta.usuario.rol === 'Propietario' && cuenta.lotes?.length;
  const subtitulo = esPropietario
    ? (cuenta.lotes.length > 1 ? `Lotes ${cuenta.lotes.join(', ')}` : `Lote ${cuenta.lotes[0]}`)
    : cuenta.usuario.rol;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.nombre} numberOfLines={1}>{cuenta.branding?.nombre ?? cuenta.url}</Text>
      <Text style={styles.subtitulo} numberOfLines={1}>{subtitulo}</Text>
    </View>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    contenedor: { alignItems: 'center' },
    nombre: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
    subtitulo: { fontSize: 13, color: colors.onPrimary, opacity: 0.85, marginTop: 1 },
  });
}
