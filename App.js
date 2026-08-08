import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { CuentasProvider, useCuentas } from './src/context/CuentasContext';
import { useColors } from './src/theme/colors';
import { registrarNotificaciones } from './src/utils/pushNotifications';
import { crearClienteBarrio, obtenerNotificacionesNoLeidas, registrarPushToken } from './src/api/barrio';
import EncabezadoBarrio from './src/components/EncabezadoBarrio';
import LogoBarrio from './src/components/LogoBarrio';
import BotonNotificaciones from './src/components/BotonNotificaciones';
import BuscarDniScreen from './src/screens/BuscarDniScreen';
import LoginBarrioScreen from './src/screens/LoginBarrioScreen';
import HomeScreen from './src/screens/HomeScreen';
import PanelScreen from './src/screens/PanelScreen';
import AccesosScreen from './src/screens/AccesosScreen';
import AreasComunesScreen from './src/screens/AreasComunesScreen';
import NuevaReservaScreen from './src/screens/NuevaReservaScreen';
import NotificacionesScreen from './src/screens/NotificacionesScreen';
import PaqueteriaScreen from './src/screens/PaqueteriaScreen';
import ArchivosScreen from './src/screens/ArchivosScreen';
import InvitacionesScreen from './src/screens/InvitacionesScreen';
import NuevaInvitacionScreen from './src/screens/NuevaInvitacionScreen';
import InvitarContactosScreen from './src/screens/InvitarContactosScreen';
import TelefonosScreen from './src/screens/TelefonosScreen';
import CambiarPasswordScreen from './src/screens/CambiarPasswordScreen';
import PerfilScreen from './src/screens/PerfilScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Para poder navegar desde afuera de un componente de pantalla (el listener
// de "tocaron la notificacion", que vive a nivel App).
const navigationRef = createNavigationContainerRef();

const ICONOS_TAB = {
  Inicio: 'view-dashboard-outline',
  Invitaciones: 'email-outline',
  Accesos: 'door-open',
  Perfil: 'account-circle-outline',
};

// Las 4 pestañas de navegacion principal, una vez que hay una cuenta activa
// elegida: Inicio (accesos rapidos a lo que no tiene pestaña propia),
// Invitaciones y Accesos (las dos secciones mas usadas, antes escondidas
// detras del menu hamburguesa), y Mi perfil (antes un menu desplegable).
// Notificaciones no es pestaña: es una alerta puntual, vive en la campanita
// del header, igual en las 4.
function MainTabs({ route }) {
  const { cuentaId } = route.params;
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const colors = useColors();
  const permisos = cuenta?.usuario.permisos ?? [];
  const [noLeidas, setNoLeidas] = useState(0);

  // Se vuelve a pedir cada vez que cualquier pestaña toma foco (screenListeners
  // "focus" mas abajo): asi, al volver de Notificaciones (donde tocar una la
  // marca leida), el puntito de la campanita se actualiza solo, sin logica
  // separada para "recien vengo de ahi".
  const actualizarNoLeidas = useCallback(() => {
    if (!cuenta) return;
    const cliente = crearClienteBarrio(cuenta.url, cuenta.token);
    obtenerNotificacionesNoLeidas(cliente).then(setNoLeidas).catch(() => {});
  }, [cuenta]);

  useEffect(() => {
    actualizarNoLeidas();
  }, [actualizarNoLeidas]);

  const opcionesComunes = useMemo(() => ({ navigation, route: rutaTab }) => ({
    headerStyle: { backgroundColor: colors.primary },
    headerTitleAlign: 'center',
    headerTitle: () => (cuenta ? <EncabezadoBarrio cuenta={cuenta} /> : null),
    headerLeft: () => (cuenta ? <LogoBarrio cuenta={cuenta} /> : null),
    headerRight: () => (cuenta ? <BotonNotificaciones cuentaId={cuenta.id} navigation={navigation} colors={colors} noLeidas={noLeidas} /> : null),
    headerRightContainerStyle: { paddingRight: 16 },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
    tabBarIcon: ({ color, size }) => (
      <MaterialCommunityIcons name={ICONOS_TAB[rutaTab.name] ?? 'circle'} size={size} color={color} />
    ),
  }), [colors, cuenta, noLeidas]);

  // Si la cuenta desaparecio (quitada, o sesion invalidada por un 401 en otra
  // pestaña) no hay nada que mostrar; PanelScreen es quien resuelve el
  // redirect a "Mis barrios" para no duplicar esa logica aca.
  if (!cuenta) return null;

  return (
    <Tab.Navigator screenOptions={opcionesComunes} screenListeners={{ focus: actualizarNoLeidas }}>
      <Tab.Screen name="Inicio" component={PanelScreen} initialParams={{ cuentaId }} />
      {permisos.includes('menu.invitaciones') && (
        <Tab.Screen name="Invitaciones" component={InvitacionesScreen} initialParams={{ cuentaId }} />
      )}
      {permisos.includes('menu.accesos') && (
        <Tab.Screen name="Accesos" component={AccesosScreen} initialParams={{ cuentaId }} />
      )}
      <Tab.Screen name="Perfil" component={PerfilScreen} initialParams={{ cuentaId }} options={{ title: 'Mi perfil' }} />
    </Tab.Navigator>
  );
}

function Navegacion() {
  const { cuentaActiva, cuentas, cargando } = useCuentas();
  // Con una sola cuenta guardada Y con sesion activa, arrancar directo en las
  // pestañas de esa cuenta en vez de "Mis barrios" (que ahi solo tendria un
  // item para tocar). Si le falta el token (recien hizo "Salir", o expiro),
  // arranca en "Mis barrios" igual, para que pida contraseña ahi.
  const idCuentaUnica = cuentas.length === 1 && cuentas[0].token ? cuentas[0].id : null;
  const colors = useColors();
  const esquemaOscuro = useColorScheme() === 'dark';

  // Pide permiso de notificaciones y le manda el Expo push token al backend
  // de ese barrio. Se repite en cada apertura de la app (no solo en el
  // login): si el usuario nunca dio el permiso la primera vez, o si el
  // token de Expo cambio, se termina registrando igual.
  useEffect(() => {
    if (!cuentaActiva) return;
    let cancelado = false;
    (async () => {
      const token = await registrarNotificaciones();
      if (!token || cancelado) return;
      try {
        const cliente = crearClienteBarrio(cuentaActiva.url, cuentaActiva.token);
        await registrarPushToken(cliente, token);
      } catch (err) {
        // No hay nada que el usuario pueda hacer con este error puntual;
        // la app sigue funcionando igual sin push.
      }
    })();
    return () => { cancelado = true; };
  }, [cuentaActiva]);

  // Si tocan el banner de una notificacion (con la app cerrada o en 2do
  // plano), abre directo la pantalla de Notificaciones de la cuenta activa.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      if (navigationRef.isReady() && cuentaActiva) {
        navigationRef.navigate('Notificaciones', { cuentaId: cuentaActiva.id });
      }
    });
    return () => sub.remove();
  }, [cuentaActiva]);

  // Header con la misma paleta que la barra superior de la web (verde-azulado
  // de marca, texto blanco), y el fondo de las transiciones/status bar
  // acorde al modo claro/oscuro del sistema (soporte de tema automatico,
  // el principio #1 de Material 3 para personalizacion/accesibilidad).
  const opcionesHeader = useMemo(() => ({
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: colors.onPrimary,
    headerTitleStyle: { fontWeight: '600' },
  }), [colors]);

  const temaNavegacion = useMemo(() => ({
    ...(esquemaOscuro ? DarkTheme : DefaultTheme),
    colors: {
      ...(esquemaOscuro ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  }), [esquemaOscuro, colors]);

  if (cargando) return null;

  return (
    <NavigationContainer ref={navigationRef} theme={temaNavegacion}>
      <Stack.Navigator
        initialRouteName={idCuentaUnica ? 'MainTabs' : cuentaActiva ? 'Home' : 'BuscarDni'}
        screenOptions={opcionesHeader}
      >
        <Stack.Screen name="BuscarDni" component={BuscarDniScreen} options={{ title: 'Ingresar' }} />
        <Stack.Screen name="LoginBarrio" component={LoginBarrioScreen} options={{ title: 'Iniciar sesión' }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Mis barrios' }} />
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
          initialParams={idCuentaUnica ? { cuentaId: idCuentaUnica } : undefined}
        />
        <Stack.Screen name="AreasComunes" component={AreasComunesScreen} options={{ title: 'Áreas comunes' }} />
        <Stack.Screen name="NuevaReserva" component={NuevaReservaScreen} options={{ title: 'Nueva reserva' }} />
        <Stack.Screen name="Notificaciones" component={NotificacionesScreen} options={{ title: 'Notificaciones' }} />
        <Stack.Screen name="Paqueteria" component={PaqueteriaScreen} options={{ title: 'Paquetería' }} />
        <Stack.Screen name="Archivos" component={ArchivosScreen} options={{ title: 'Archivos' }} />
        <Stack.Screen name="NuevaInvitacion" component={NuevaInvitacionScreen} options={{ title: 'Nueva invitación' }} />
        <Stack.Screen name="InvitarContactos" component={InvitarContactosScreen} options={{ title: 'Invitar desde contactos' }} />
        <Stack.Screen name="Telefonos" component={TelefonosScreen} options={{ title: 'Teléfonos' }} />
        <Stack.Screen name="CambiarPassword" component={CambiarPasswordScreen} options={{ title: 'Cambiar contraseña' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <CuentasProvider>
        <Navegacion />
        <StatusBar style="auto" />
      </CuentasProvider>
    </SafeAreaProvider>
  );
}
