import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

// Alta manual de un barrio cuando todavia no esta cargado en el directorio
// central (o el usuario prefiere escribir el subdominio directamente).
export default function AgregarManualScreen({ navigation }) {
  const [subdominio, setSubdominio] = useState('');

  function continuar() {
    const limpio = subdominio.trim().toLowerCase();
    if (!limpio) return;
    navigation.navigate('LoginBarrio', {
      barrio: {
        id_barrio: limpio,
        nombre: limpio,
        url: `https://${limpio}.debarrios.com.ar`,
      },
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Agregar barrio manualmente</Text>
      <Text style={styles.ayuda}>Ingresá el subdominio que te dio la administración del barrio.</Text>
      <TextInput
        style={styles.input}
        value={subdominio}
        onChangeText={setSubdominio}
        placeholder="ej: sanpablo"
        autoCapitalize="none"
      />
      <Button title="Continuar" onPress={continuar} disabled={!subdominio} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 80, backgroundColor: '#fff' },
  titulo: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  ayuda: { color: '#666', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
});
