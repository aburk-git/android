import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button } from 'react-native';
import { useCuentas } from '../context/CuentasContext';

// Pantalla principal: muestra el barrio activo y, debajo, el resto de las
// cuentas guardadas para cambiar de barrio sin volver a loguearse. Las
// pantallas de Reservas / Datos del barrio activo se agregan a continuacion
// de esta, usando cuentaActiva.url + cuentaActiva.token para llamar a su API.
export default function HomeScreen({ navigation }) {
  const { cuentas, cuentaActiva, setIdBarrioActivo, quitarCuenta } = useCuentas();

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{cuentaActiva?.nombre}</Text>
      <Text style={styles.ayuda}>Sesion iniciada como {cuentaActiva?.usuario?.email}</Text>

      <Text style={styles.seccion}>Tus barrios</Text>
      <FlatList
        data={cuentas}
        keyExtractor={(c) => String(c.id_barrio)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, item.id_barrio === cuentaActiva?.id_barrio && styles.itemActivo]}
            onPress={() => setIdBarrioActivo(item.id_barrio)}
            onLongPress={() => quitarCuenta(item.id_barrio)}
          >
            <Text style={styles.itemTexto}>{item.nombre}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={{ marginTop: 24 }}>
        <Button title="Agregar otro barrio" onPress={() => navigation.navigate('BuscarDni')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 80, backgroundColor: '#fff' },
  titulo: { fontSize: 24, fontWeight: '600' },
  ayuda: { color: '#666', marginBottom: 24 },
  seccion: { fontSize: 14, color: '#999', marginBottom: 8, textTransform: 'uppercase' },
  item: { padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8 },
  itemActivo: { borderColor: '#0a58ca', backgroundColor: '#eef4ff' },
  itemTexto: { fontSize: 16 },
});
