import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Campanita del header (igual en las 4 pestañas): Notificaciones queda fuera
// de la barra inferior porque no es una seccion "de fondo" como las demas,
// es una alerta puntual, igual que el bell-icon de apps de referencia.
// "noLeidas" pinta un puntito rojo arriba a la derecha del icono cuando hay
// alguna sin leer, para que se note sin tener que entrar a mirar.
export default function BotonNotificaciones({ cuentaId, navigation, colors, noLeidas = 0 }) {
  return (
    <Pressable
      onPress={() => navigation.navigate('Notificaciones', { cuentaId })}
      accessibilityRole="button"
      accessibilityLabel={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'}
      hitSlop={8}
      style={styles.contenedor}
    >
      <MaterialCommunityIcons name="bell-outline" size={24} color={colors.onPrimary} />
      {noLeidas > 0 ? <View style={[styles.punto, { borderColor: colors.primary }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { padding: 2 },
  punto: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#e53935',
    borderWidth: 1.5,
  },
});
