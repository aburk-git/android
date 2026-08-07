// El backend devuelve 401 cuando el token vencio (o quedo invalidado por
// sesion unica). Se centraliza aca porque son ~10 pantallas las que necesitan
// distinguir este caso del resto de los errores de red.
export function esSesionExpirada(err) {
  return err?.response?.status === 401;
}
