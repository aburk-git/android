import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { buscarBarriosPorDni } from '../api/conector';

export default function BuscarDniScreen({ navigation }) {
  const [dni, setDni] = useState('');
  const [barrios, setBarrios] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function buscar() {
    setError('');
    setCargando(true);
    try {
      const resultado = await buscarBarriosPorDni(dni.trim());
      setBarrios(resultado);
    } catch {
      setError('No se pudo consultar el directorio. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Ingresá tu DNI</Text>
      <TextInput
        style={styles.input}
        value={dni}
        onChangeText={setDni}
        keyboardType="numeric"
        placeholder="Ej: 30123456"
      />
      <Button title="Buscar mis barrios" onPress={buscar} disabled={!dni || cargando} />
      {cargando && <ActivityIndicator style={{ marginTop: 16 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {barrios && barrios.length === 0 && (
        <Text style={styles.info}>No encontramos barrios asociados a ese DNI.</Text>
      )}

      {barrios && barrios.length > 0 && (
        <FlatList
          style={{ marginTop: 24 }}
          data={barrios}
          keyExtractor={(b) => String(b.id_barrio)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => navigation.navigate('LoginBarrio', { barrio: item })}
            >
              <Text style={styles.itemTexto}>{item.nombre}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={{ marginTop: 24 }} onPress={() => navigation.navigate('AgregarManual')}>
        <Text style={styles.link}>No aparece mi barrio / agregar manualmente</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 80, backgroundColor: '#fff' },
  titulo: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  error: { color: '#c00', marginTop: 12 },
  info: { color: '#666', marginTop: 16 },
  item: { padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8 },
  itemTexto: { fontSize: 16 },
  link: { color: '#0a58ca', textAlign: 'center' },
});
