import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '../theme/colors';

// Input con label arriba, como .form-label + .form-control en la web.
export default function Campo({ label, style, ...propsInput }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);

  return (
    <View style={styles.contenedor}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        // El label visible sirve tambien de accessibilityLabel: sin esto un
        // lector de pantalla solo anuncia "campo de texto, vacio".
        accessibilityLabel={label}
        {...propsInput}
      />
    </View>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    contenedor: { marginBottom: 14 },
    label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 17,
      color: colors.text,
      backgroundColor: colors.card,
      minHeight: 46,
    },
  });
}
