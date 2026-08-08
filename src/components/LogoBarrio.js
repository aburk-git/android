import { Image, StyleSheet, View } from 'react-native';
import { useColors } from '../theme/colors';

// Logo del barrio (headerLeft): separado de EncabezadoBarrio a proposito
// para que el titulo (nombre + lote/rol) quede centrado de verdad en el
// header, en vez de arrastrado por el ancho variable del logo.
export default function LogoBarrio({ cuenta }) {
  const colors = useColors();
  if (!cuenta.branding?.logo_url) return null;

  return (
    <View style={styles.contenedor}>
      <Image
        source={{ uri: cuenta.branding.logo_url }}
        style={[styles.logo, { backgroundColor: colors.onPrimary }]}
        accessibilityLabel=""
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginLeft: 8 },
  logo: { width: 42, height: 42, borderRadius: 21 },
});
