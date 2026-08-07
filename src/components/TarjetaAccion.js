import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

// Tarjeta de accion generica (icono en circulo + titulo + descripcion),
// pensada para las pantallas de Inicio e Invitaciones: reemplaza los tiles
// cuadrados y los botones sueltos que tenia la app antes por algo mas legible
// de escanear en una lista vertical.
export default function TarjetaAccion({ icono, titulo, descripcion, onPress, style }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tarjeta, pressed && styles.tarjetaPresionada, style]}
      accessibilityRole="button"
      accessibilityLabel={descripcion ? `${titulo}. ${descripcion}` : titulo}
    >
      <View style={styles.circulo}>
        <MaterialCommunityIcons name={icono} size={26} color={colors.onPrimary} />
      </View>
      <View style={styles.textos}>
        <Text style={styles.titulo}>{titulo}</Text>
        {descripcion ? <Text style={styles.descripcion}>{descripcion}</Text> : null}
      </View>
    </Pressable>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    tarjeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      minHeight: 48,
      ...sombraCard,
    },
    tarjetaPresionada: { opacity: 0.85 },
    circulo: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textos: { flex: 1 },
    titulo: { fontSize: 16, fontWeight: '700', color: colors.primary },
    descripcion: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  });
}
