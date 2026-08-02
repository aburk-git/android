import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useCuentas } from '../context/CuentasContext';

export default function LoginBarrioScreen({ route, navigation }) {
  const { barrio } = route.params;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const { agregarCuenta } = useCuentas();

  async function handleLogin() {
    setError('');
    setCargando(true);
    try {
      await agregarCuenta(barrio, email, password);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch {
      setError('Email o contraseña incorrectos para este barrio');
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{barrio.nombre}</Text>
      <Text style={styles.ayuda}>Ingresá con tu usuario de este barrio</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Contraseña"
        secureTextEntry
      />
      {cargando ? <ActivityIndicator /> : <Button title="Ingresar" onPress={handleLogin} disabled={!email || !password} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 80, backgroundColor: '#fff' },
  titulo: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  ayuda: { color: '#666', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  error: { color: '#c00', marginBottom: 12 },
});
