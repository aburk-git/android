import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '../theme/colors';

// Espeja los .btn-primary / .btn-outline-primary / .btn-outline-danger de la web:
// mismo color de marca, mismo feedback al presionar (equivalente al :hover/:active).
export default function Boton({ titulo, onPress, variante = 'primary', cargando = false, disabled = false, style }) {
  const colors = useColors();
  const inactivo = disabled || cargando;

  const variantes = useMemo(() => ({
    primary: { bg: colors.primary, bgActive: colors.primaryActive, texto: colors.onPrimary, textoActivo: colors.onPrimary, borde: colors.primary },
    outline: { bg: 'transparent', bgActive: colors.primary, texto: colors.primary, textoActivo: colors.onPrimary, borde: colors.primary },
    danger: { bg: 'transparent', bgActive: colors.danger, texto: colors.danger, textoActivo: '#fff', borde: colors.danger },
    link: { bg: 'transparent', bgActive: 'transparent', texto: colors.primary, textoActivo: colors.primary, borde: 'transparent' },
  }), [colors]);
  const v = variantes[variante] ?? variantes.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      // "Content Descriptions" (Material 3): todo elemento interactivo necesita
      // una etiqueta accesible, no solo el texto visible.
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && !inactivo ? v.bgActive : v.bg,
          borderColor: v.borde,
          opacity: inactivo ? 0.6 : 1,
        },
        variante === 'link' && styles.link,
        style,
      ]}
    >
      {({ pressed }) =>
        cargando ? (
          <ActivityIndicator color={v.texto} />
        ) : (
          <Text style={[styles.texto, { color: pressed && !inactivo ? v.textoActivo : v.texto }]}>
            {titulo}
          </Text>
        )
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 12,
    // Horizontal para que, cuando el boton no ocupa todo el ancho del
    // contenedor (alignSelf: 'flex-end' en vez de dejarlo estirar), el texto
    // no quede pegado al borde.
    paddingHorizontal: 20,
    // Touch target minimo de 48dp (Material 3), incluso en la variante "link"
    // que tiene menos padding vertical.
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    borderWidth: 0,
    paddingVertical: 8,
  },
  texto: {
    fontSize: 17,
    fontWeight: '600',
  },
});
