import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { cambiarPassword, crearClienteBarrio } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import Boton from '../components/Boton';
import Campo from '../components/Campo';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

// Minimo 6 caracteres: mismo limite que exige el backend (cambiarPasswordSchema).
const LARGO_MINIMO = 6;

export default function CambiarPasswordScreen({ navigation, route }) {
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas, agregarCuenta } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function validar() {
    if (!passwordActual) return 'Ingresá tu contraseña actual';
    if (passwordNueva.length < LARGO_MINIMO) return `La contraseña nueva debe tener al menos ${LARGO_MINIMO} caracteres`;
    if (confirmacion !== passwordNueva) return 'La confirmación no coincide con la contraseña nueva';
    return '';
  }

  async function confirmar() {
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }

    setError('');
    setEnviando(true);
    try {
      const data = await cambiarPassword(cliente, { password_actual: passwordActual, password_nueva: passwordNueva });
      // Si el barrio cierra otras sesiones al cambiar la contraseña, el token
      // de esta cuenta cambia: hay que guardar el nuevo o el backend termina
      // rechazando el viejo. agregarCuenta sobreescribe por id (url+email).
      if (data.token) {
        await agregarCuenta({ url: cuenta.url, email: cuenta.email, token: data.token, usuario: cuenta.usuario, branding: cuenta.branding, lotes: cuenta.lotes });
      }
      Alert.alert('Listo', data.mensaje ?? 'Contraseña actualizada correctamente', [
        { text: 'Aceptar', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(err.response?.data?.error ?? 'No se pudo cambiar la contraseña');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Campo label="Contraseña actual" value={passwordActual} onChangeText={setPasswordActual} secureTextEntry />
        <Campo label="Contraseña nueva" value={passwordNueva} onChangeText={setPasswordNueva} secureTextEntry />
        <Campo label="Confirmar contraseña nueva" value={confirmacion} onChangeText={setConfirmacion} secureTextEntry />

        <Boton
          titulo="Cambiar contraseña"
          onPress={confirmar}
          cargando={enviando}
          disabled={!passwordActual || !passwordNueva || !confirmacion}
          style={styles.boton}
        />
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
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerContainer,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
      fontSize: 15,
    },
    boton: { marginTop: 8 },
  });
}
