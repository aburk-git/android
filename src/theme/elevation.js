// Un unico nivel de elevacion para tarjetas/items de lista en toda la app
// (Material 3 "Level 1-2": tarjetas, no navegacion). Antes cada pantalla
// tenia su propio shadowOpacity/shadowRadius sin ningun motivo real.
export const sombraCard = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
