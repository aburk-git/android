import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { buscarBarriosPorDni } from '../api/conector';
import Boton from '../components/Boton';
import Campo from '../components/Campo';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

export default function BuscarDniScreen({ navigation }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);

  const [dni, setDni] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState(null);

  async function buscar() {
    if (!dni.trim()) return;
    setError('');
    setCargando(true);
    setResultados(null);
    try {
      const barrios = await buscarBarriosPorDni(dni.trim());
      // Si hay un solo barrio, se salta la lista y va directo a
      // usuario/contraseña: no tiene sentido hacer tocar un unico resultado.
      if (barrios.length === 1) {
        navigation.navigate('LoginBarrio', { url: barrios[0].url, nombre: barrios[0].nombre });
        return;
      }
      setResultados(barrios);
    } catch (err) {
      setError('No se pudo conectar con el directorio. Probá de nuevo en un momento.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.titulo}>DeBarrios</Text>
        <Text style={styles.subtitulo}>Ingresá tu DNI para ver en qué barrios tenés usuario</Text>

        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

        <Campo
          label="DNI"
          value={dni}
          onChangeText={(t) => setDni(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={9}
          placeholder="Sin puntos"
        />
        <Boton titulo="Buscar" onPress={buscar} cargando={cargando} disabled={!dni.trim()} />

        {resultados && resultados.length === 0 && (
          <Text style={styles.sinResultados}>
            No encontramos barrios asociados a ese DNI.
          </Text>
        )}

        {resultados && resultados.length > 0 && (
          <FlatList
            style={styles.lista}
            data={resultados}
            keyExtractor={(item) => String(item.id_barrio)}
            renderItem={({ item }) => (
              <Boton
                titulo={item.nombre}
                variante="outline"
                onPress={() => navigation.navigate('LoginBarrio', { url: item.url, nombre: item.nombre })}
                style={styles.itemBarrio}
              />
            )}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 24,
      ...sombraCard,
    },
    titulo: { fontSize: 21, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 6 },
    subtitulo: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerContainer,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
      fontSize: 15,
    },
    sinResultados: { textAlign: 'center', color: colors.textMuted, marginTop: 16, fontSize: 15 },
    lista: { marginTop: 16, maxHeight: 260 },
    itemBarrio: { marginBottom: 8 },
  });
}
