import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Que el banner del sistema se muestre igual aunque la app este abierta en
// primer plano (por defecto Android/iOS lo ocultan si la app esta activa).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Pide permiso, arma el canal de notificaciones de Android y devuelve el
// Expo push token para mandarselo al backend. Devuelve null si no se pudo
// (emulador sin Google Play Services, permiso denegado, etc): no es un error
// fatal, la app sigue funcionando igual, simplemente sin push.
export async function registrarNotificaciones() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DeBarrios',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0f3d3e',
    });
  }

  if (!Device.isDevice) return null;

  const { status: existente } = await Notifications.getPermissionsAsync();
  let status = existente;
  if (status !== 'granted') {
    const pedido = await Notifications.requestPermissionsAsync();
    status = pedido.status;
  }
  if (status !== 'granted') return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (err) {
    return null;
  }
}
