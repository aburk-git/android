import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CuentasProvider, useCuentas } from './src/context/CuentasContext';
import BuscarDniScreen from './src/screens/BuscarDniScreen';
import AgregarManualScreen from './src/screens/AgregarManualScreen';
import LoginBarrioScreen from './src/screens/LoginBarrioScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator();

function Navegacion() {
  const { cuentaActiva, cargando } = useCuentas();

  if (cargando) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={cuentaActiva ? 'Home' : 'BuscarDni'}>
        <Stack.Screen name="BuscarDni" component={BuscarDniScreen} options={{ title: 'Ingresar' }} />
        <Stack.Screen name="AgregarManual" component={AgregarManualScreen} options={{ title: 'Agregar barrio' }} />
        <Stack.Screen name="LoginBarrio" component={LoginBarrioScreen} options={{ title: 'Iniciar sesion' }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Mis barrios' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <CuentasProvider>
      <Navegacion />
      <StatusBar style="auto" />
    </CuentasProvider>
  );
}
