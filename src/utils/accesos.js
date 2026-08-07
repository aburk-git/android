// Accesos, Invitaciones y Notificaciones tienen su propio lugar fijo (las dos
// primeras son pestañas de la barra inferior, la tercera es la campanita del
// header): esta lista es solo lo que queda como tarjetas en la pestaña
// Inicio. Mismos iconos que usa la web en el sidebar (bi-door-open-fill, etc),
// traducidos a @expo/vector-icons (Bootstrap Icons no existe para React
// Native). "permiso" es la clave menu.* del backend: si el usuario no la
// tiene, el item ni se muestra.
export const TILES_ACCESOS = [
  { key: 'AreasComunes', titulo: 'Áreas Comunes', icono: 'calendar-check', descripcion: 'Reservá espacios comunes del barrio', permiso: 'menu.reservas' },
  { key: 'Paqueteria', titulo: 'Paquetería', icono: 'package-variant-closed', descripcion: 'Paquetes que llegaron a tu nombre', permiso: 'menu.paqueteria' },
  {
    key: 'Archivos',
    titulo: 'Archivos',
    icono: 'folder-outline',
    descripcion: 'Documentos y circulares del barrio',
    permiso: 'menu.archivos',
    params: (cuentaId) => ({ cuentaId, carpetaId: null, nombreCarpeta: 'Archivos' }),
  },
  { key: 'Telefonos', titulo: 'Teléfonos', icono: 'phone-outline', descripcion: 'Agenda de contactos útiles', permiso: 'menu.telefonos' },
];
