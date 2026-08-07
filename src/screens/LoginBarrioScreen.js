import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { crearClienteBarrio, obtenerBranding, loginBarrio, loginSsoBarrio, obtenerPropietariosPropios } from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import Boton from '../components/Boton';
import Campo from '../components/Campo';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';

export default function LoginBarrioScreen({ navigation, route }) {
  const { url, nombre, email: emailPrecargado, motivo } = route.params;
  const { agregarCuenta } = useCuentas();
  const colors = useColors();
  const styles = useMemo(() => crearEstilos(colors), [colors]);

  const [branding, setBranding] = useState(nombre ? { nombre, logo_url: null } : null);
  const [email, setEmail] = useState(emailPrecargado ?? '');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerBranding(url)
      .then((data) => setBranding({ nombre: data.nombre ?? nombre ?? url, logo_url: data.logo_url }))
      .catch(() => setBranding((actual) => actual ?? { nombre: nombre ?? url, logo_url: null }));
  }, [url]);

  async function handleSubmit() {
    setError('');
    setCargando(true);
    try {
      const data = await loginBarrio(url, email.trim(), password);

      if (data.requiere_2fa) {
        setError('Este barrio pide verificacion en dos pasos (2FA), todavia no soportada en la app. Iniciá sesión desde la web.');
        return;
      }

      // Si es Propietario, de una vez se trae el/los numero/s de lote para
      // mostrarlo en la lista de cuentas en vez del nombre del rol.
      let lotes = [];
      if (data.usuario.rol === 'Propietario') {
        try {
          const cliente = crearClienteBarrio(url, data.token);
          const propias = await obtenerPropietariosPropios(cliente);
          lotes = [...new Set(propias.map((p) => p.numero_lote).filter(Boolean))];
        } catch {
          lotes = [];
        }
      }

      let { cuenta, todas } = await agregarCuenta({ url, email: email.trim(), token: data.token, usuario: data.usuario, branding, lotes });

      // Si CONECTOR sabe de otros barrios con el mismo DNI, el backend ya
      // valido la contraseña una vez y nos dio un comprobante corto: se
      // canjea en cada uno para entrar sin volver a pedirla. Si alguno falla
      // (pide 2FA, no tiene usuario activo ahi, comprobante vencido) se
      // saltea calladito, no es un error del login que si funciono.
      const nombresAgregados = [];
      if (data.ssoComprobante && data.otrosBarrios?.length) {
        for (const otro of data.otrosBarrios) {
          try {
            const dataOtro = await loginSsoBarrio(otro.url, data.ssoComprobante);

            let lotesOtro = [];
            if (dataOtro.usuario.rol === 'Propietario') {
              try {
                const clienteOtro = crearClienteBarrio(otro.url, dataOtro.token);
                const propiasOtro = await obtenerPropietariosPropios(clienteOtro);
                lotesOtro = [...new Set(propiasOtro.map((p) => p.numero_lote).filter(Boolean))];
              } catch {
                lotesOtro = [];
              }
            }

            let brandingOtro = { nombre: otro.nombre, logo_url: null };
            try {
              const b = await obtenerBranding(otro.url);
              brandingOtro = { nombre: b.nombre ?? otro.nombre, logo_url: b.logo_url };
            } catch {
              // Sin branding no pasa nada, se usa el nombre que ya dio CONECTOR.
            }

            const resultadoOtro = await agregarCuenta({
              url: otro.url,
              email: dataOtro.usuario.email,
              token: dataOtro.token,
              usuario: dataOtro.usuario,
              branding: brandingOtro,
              lotes: lotesOtro,
            });
            todas = resultadoOtro.todas;
            nombresAgregados.push(brandingOtro.nombre);
          } catch {
            // Se saltea este barrio; el login principal ya funciono igual.
          }
        }
      }

      // Con una sola cuenta guardada en total no tiene sentido pasar por "Mis
      // barrios": va directo a la botonera de esa cuenta.
      if (todas.length === 1) {
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { cuentaId: cuenta.id } }] });
        return;
      }

      if (nombresAgregados.length) {
        Alert.alert('Listo', `También entraste automáticamente a: ${nombresAgregados.join(', ')}`, [
          { text: 'Aceptar', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] }) },
        ]);
        return;
      }

      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err) {
      const conMotivo = err.response?.status === 403 || err.response?.status === 503;
      setError(conMotivo ? err.response.data.error : 'Email o contraseña incorrectos');
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        {branding?.logo_url ? (
          <Image source={{ uri: branding.logo_url }} style={styles.logo} accessibilityLabel="Logo del barrio" />
        ) : null}
        <Text style={styles.titulo}>{branding?.nombre ?? 'Iniciar sesión'}</Text>

        {!error && motivo === 'expirada' ? <Text style={styles.aviso}>Tu sesión expiró. Iniciá sesión de nuevo.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Campo
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Campo
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Boton titulo="Ingresar" onPress={handleSubmit} cargando={cargando} disabled={!email.trim() || !password} />
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
    logo: { width: 88, height: 88, borderRadius: 8, alignSelf: 'center', marginBottom: 12 },
    titulo: { fontSize: 21, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 20 },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerContainer,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
      fontSize: 15,
    },
    aviso: {
      color: colors.warning,
      backgroundColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
      fontSize: 15,
    },
  });
}
