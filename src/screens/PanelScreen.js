import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCuentas } from '../context/CuentasContext';
import { useColors } from '../theme/colors';
import { TILES_ACCESOS } from '../utils/accesos';
import TarjetaAccion from '../components/TarjetaAccion';

// Pestaña "Inicio": accesos rapidos a las secciones que no tienen pestaña
// propia (Accesos e Invitaciones si tienen la suya; Notificaciones vive en la
// campanita del header). Tarjetas en vez de la grilla de tiles cuadrados que
// tenia antes, mismo espiritu que la pantalla de referencia (icono + titulo +
// descripcion, una debajo de la otra).
export default function PanelScreen({ navigation, route }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const tiles = TILES_ACCESOS.filter((t) => !t.permiso || cuenta?.usuario.permisos?.includes(t.permiso));

  if (!cuenta) {
    // Nido dentro de la barra de pestañas: para volver a "Mis barrios" hay
    // que resetear el Stack de arriba, no la pestaña actual.
    (navigation.getParent() ?? navigation).reset({ index: 0, routes: [{ name: 'Home' }] });
    return null;
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.scroll}>
      <Text style={styles.saludo}>Hola, {cuenta.usuario.nombre}</Text>

      {tiles.length === 0 ? (
        <Text style={styles.vacio}>No tenés otras secciones habilitadas por ahora.</Text>
      ) : (
        <View style={styles.lista}>
          {tiles.map((tile) => (
            <TarjetaAccion
              key={tile.key}
              icono={tile.icono}
              titulo={tile.titulo}
              descripcion={tile.descripcion}
              onPress={() => navigation.navigate(tile.key, tile.params ? tile.params(cuenta.id) : { cuentaId: cuenta.id })}
              style={styles.tarjeta}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    saludo: { fontSize: 21, fontWeight: '700', color: colors.text, marginBottom: 18 },
    vacio: { color: colors.textMuted, fontSize: 15 },
    lista: { gap: 12 },
    tarjeta: {},
  });
}
