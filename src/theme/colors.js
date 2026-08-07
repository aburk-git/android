import { useColorScheme } from 'react-native';

// Misma paleta clara que frontend/src/index.css (verde-azulado de seguridad).
const light = {
  primary: '#0f3d3e',
  primaryHover: '#1b6b6f',
  primaryActive: '#082626',
  onPrimary: '#ffffff',
  success: '#16a34a',
  danger: '#b91c1c',
  warning: '#d97706',
  bg: '#f6f4ef',
  card: '#ffffff',
  border: '#e2ddd0',
  text: '#212529',
  textMuted: '#6c757d',
  focusRing: 'rgba(15, 61, 62, 0.25)',
  // Rol "errorContainer" de Material 3: fondo suave para carteles de error.
  dangerContainer: '#fdecea',
};

// Version oscura de la misma paleta: primary mas claro/saturado que en modo
// claro para mantener contraste sobre fondo oscuro (regla de Material 3 para
// dark themes: los tonos "primary" se aclaran, no se usan igual que de dia).
const dark = {
  primary: '#4fb3af',
  primaryHover: '#6cc4c0',
  primaryActive: '#3a908c',
  onPrimary: '#04201f',
  // success/danger/warning quedan IGUAL que en claro a proposito: se usan
  // como relleno solido con texto blanco encima (badges, grilla de horarios),
  // no como texto sobre fondo. Aclararlos en modo oscuro rompe ese contraste.
  success: '#16a34a',
  danger: '#b91c1c',
  warning: '#d97706',
  bg: '#14181a',
  card: '#1f2528',
  border: '#333b3f',
  text: '#eef1f2',
  textMuted: '#9aa5a9',
  focusRing: 'rgba(79, 179, 175, 0.35)',
  dangerContainer: '#3a1a1a',
};

export function useColors() {
  const esquema = useColorScheme();
  return esquema === 'dark' ? dark : light;
}

// Paleta clara por defecto: solo para el par de lugares que arman estilos
// fuera de un componente (fuera del arbol de React no hay useColorScheme).
export const colors = light;
