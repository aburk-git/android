import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buscarPropietarios,
  crearClienteBarrio,
  crearInvitacion,
  crearVisitante,
  obtenerBarrio,
  obtenerPropietariosPropios,
} from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import Boton from '../components/Boton';
import Campo from '../components/Campo';
import { useColors } from '../theme/colors';
import { sombraCard } from '../theme/elevation';
import { fechaISOEnZona, nombreDiaCorto } from '../utils/horarios';

const DIAS_ADELANTE = 30;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_VISIBLES = 50;

// Saca tildes para que buscar "jose" encuentre "José".
function sinAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'Lun' },
  { valor: 2, etiqueta: 'Mar' },
  { valor: 3, etiqueta: 'Mié' },
  { valor: 4, etiqueta: 'Jue' },
  { valor: 5, etiqueta: 'Vie' },
  { valor: 6, etiqueta: 'Sáb' },
  { valor: 0, etiqueta: 'Dom' },
];

// Version movil de "Invitar varios por WhatsApp" de la web, pero tomando los
// destinatarios de la agenda del celular en vez de escribirlos a mano: se
// marcan los contactos, se crea una invitacion por cada uno y se les manda el
// link del formulario publico, donde el visitante carga sus propios datos.
// Los contactos NO se guardan en el servidor: del elegido solo viaja el nombre
// y el telefono, igual que si se hubieran tipeado.
export default function InvitarContactosScreen({ navigation, route }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const esPropietario = cuenta.usuario.rol === 'Propietario';
  const zona = cuenta.usuario.zona_horaria ?? 'America/Argentina/Buenos_Aires';

  const [permiso, setPermiso] = useState('pendiente');
  const [contactos, setContactos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  // id de contacto -> telefono (editable: la agenda suele tener el numero sin
  // codigo de pais y WhatsApp lo necesita completo).
  const [seleccionados, setSeleccionados] = useState({});

  const [config, setConfig] = useState(null);
  const [propiasFilas, setPropiasFilas] = useState([]);
  const [idPropietario, setIdPropietario] = useState(null);
  const [busquedaPropietario, setBusquedaPropietario] = useState('');
  const [resultadosPropietario, setResultadosPropietario] = useState([]);

  const [tipo, setTipo] = useState('puntual');
  const [trabajadorFijo, setTrabajadorFijo] = useState(true);
  const [fechaVisita, setFechaVisita] = useState(() => fechaISOEnZona(zona));
  const [diasSemana, setDiasSemana] = useState([]);
  const [horarioLimitado, setHorarioLimitado] = useState(false);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');

  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const dias = useMemo(
    () => Array.from({ length: DIAS_ADELANTE }, (_, i) => fechaISOEnZona(zona, i)),
    [zona]
  );

  // Se pide el permiso al entrar y se traen nombre + telefonos de toda la
  // agenda en una sola llamada (getAllDetails), en vez de una por contacto.
  const cargarContactos = useCallback(async () => {
    const { status } = await requestPermissionsAsync();
    if (status !== 'granted') {
      setPermiso('denegado');
      return;
    }
    const agenda = await Contact.getAllDetails(
      [ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.PHONES],
      { sortOrder: ContactsSortOrder.GivenName }
    );
    const conTelefono = agenda
      .map((c) => ({
        id: c.id,
        nombre: `${c.givenName ?? ''} ${c.familyName ?? ''}`.trim(),
        telefono: c.phones?.find((t) => t.number)?.number ?? '',
      }))
      .filter((c) => c.telefono);
    setContactos(conTelefono);
    setPermiso('ok');
  }, []);

  useEffect(() => {
    cargarContactos().catch(() => setPermiso('error'));
  }, [cargarContactos]);

  useEffect(() => {
    obtenerBarrio(cliente, cuenta.usuario.id_barrio)
      .then((data) => setConfig(data.configuracion ?? {}))
      .catch(() => setConfig({}));
  }, [cliente, cuenta.usuario.id_barrio]);

  useEffect(() => {
    if (!esPropietario) return;
    obtenerPropietariosPropios(cliente)
      .then((lista) => {
        const propias = lista.filter((p) => p.usuario?.id_usuario === cuenta.usuario.id_usuario);
        setPropiasFilas(propias);
        if (propias.length === 1) setIdPropietario(propias[0].id_propietario);
      })
      .catch(() => setPropiasFilas([]));
  }, [cliente, esPropietario, cuenta.usuario.id_usuario]);

  useEffect(() => {
    if (esPropietario || !busquedaPropietario) {
      setResultadosPropietario([]);
      return;
    }
    const id = setTimeout(() => {
      buscarPropietarios(cliente, busquedaPropietario)
        .then(setResultadosPropietario)
        .catch(() => setResultadosPropietario([]));
    }, 400);
    return () => clearTimeout(id);
  }, [cliente, esPropietario, busquedaPropietario]);

  const contactosFiltrados = useMemo(() => {
    const texto = sinAcentos(busqueda.trim().toLowerCase());
    if (!texto) return contactos;
    // El telefono solo entra en el match si el texto buscado tiene digitos:
    // de lo contrario "".includes("") siempre da true y matchea cualquier
    // contacto, rompiendo la busqueda por nombre.
    const soloDigitos = texto.replace(/\D/g, '');
    return contactos.filter((c) =>
      sinAcentos(c.nombre.toLowerCase()).includes(texto) ||
      (soloDigitos && c.telefono.replace(/\D/g, '').includes(soloDigitos))
    );
  }, [contactos, busqueda]);

  const totalSeleccionados = Object.keys(seleccionados).length;

  function alternarContacto(c) {
    setSeleccionados((s) => {
      const copia = { ...s };
      if (c.id in copia) delete copia[c.id];
      else copia[c.id] = c.telefono;
      return copia;
    });
  }

  function alternarDia(dia) {
    setDiasSemana((actuales) =>
      actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia]
    );
  }

  function validar() {
    if (!idPropietario) return 'Elegí el lote de la invitación';
    if (totalSeleccionados === 0) return 'Marcá al menos un contacto';
    if (Object.values(seleccionados).some((t) => !t.trim())) return 'Falta el teléfono de alguno de los contactos marcados';
    if (tipo === 'puntual' && !fechaVisita) return 'Elegí el día de la visita';
    if (tipo === 'trabajador' && trabajadorFijo && diasSemana.length === 0) return 'Elegí al menos un día de la semana';
    if (tipo === 'trabajador' && !trabajadorFijo && !fechaVisita) return 'Elegí el día de la visita';
    if (horarioLimitado) {
      if (!HORA_REGEX.test(horaDesde) || !HORA_REGEX.test(horaHasta)) return 'Completá el horario con formato HH:MM (ej: 08:30)';
      if (horaDesde >= horaHasta) return 'El horario "desde" debe ser anterior al "hasta"';
    }
    return '';
  }

  // Se crea una invitacion por contacto, en serie: cada una es independiente,
  // asi que si una falla las demas siguen y el error se muestra en su fila.
  async function crearTodas() {
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }

    setError('');
    setEnviando(true);
    const filas = [];

    for (const [idContacto, telefono] of Object.entries(seleccionados)) {
      const contacto = contactos.find((c) => c.id === idContacto);
      const nombreCompleto = contacto?.nombre ?? '';
      const [nombre, ...resto] = nombreCompleto.split(' ');
      try {
        const visitante = await crearVisitante(cliente, {
          id_barrio: cuenta.usuario.id_barrio,
          nombre: nombre || undefined,
          apellido: resto.join(' ') || undefined,
          telefono,
          tipo: 'visita',
          creado_por_propietario_id: idPropietario,
        });

        const esFechaPuntual = tipo === 'puntual' || (tipo === 'trabajador' && !trabajadorFijo);
        const data = await crearInvitacion(cliente, {
          id_propietario: idPropietario,
          id_visitante: visitante.id_visitante,
          tipo,
          canal_envio: 'whatsapp',
          telefono,
          ...(esFechaPuntual
            ? { fecha_visita: fechaVisita, ...(tipo === 'puntual' ? { horas_validez: config?.tiempo_validez_invitacion_horas || undefined } : {}) }
            : { dias_semana: diasSemana }),
          ...(horarioLimitado ? { hora_ingreso_desde: horaDesde, hora_ingreso_hasta: horaHasta } : {}),
        });

        filas.push({
          id: idContacto,
          nombre: nombreCompleto || telefono,
          telefono,
          ok: true,
          linkWhatsapp: data.link_whatsapp,
          enviadoAutomatico: data.whatsapp_enviado,
          errorAutomatico: data.whatsapp_error,
          linkInvitacion: data.link_invitacion,
        });
      } catch (err) {
        filas.push({
          id: idContacto,
          nombre: nombreCompleto || telefono,
          telefono,
          ok: false,
          error: err.response?.data?.error ?? 'No se pudo crear la invitación',
        });
      }
    }

    setResultados(filas);
    setEnviando(false);
  }

  // Tira horizontal de los proximos DIAS_ADELANTE dias: la usan tanto "Visita"
  // como "Trabajador no fijo" (una unica fecha puntual en ambos casos).
  function renderTiraDias() {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiraDias}>
        {dias.map((d) => {
          const seleccionado = d === fechaVisita;
          const etiqueta = d === dias[0] ? 'Hoy' : nombreDiaCorto(d);
          return (
            <Pressable
              key={d}
              onPress={() => setFechaVisita(d)}
              style={[styles.chipDia, seleccionado && styles.chipDiaSeleccionado]}
              accessibilityRole="button"
              accessibilityLabel={`${etiqueta} ${d.slice(8, 10)}/${d.slice(5, 7)}`}
              accessibilityState={{ selected: seleccionado }}
            >
              <Text style={[styles.chipDiaTexto, seleccionado && styles.chipDiaTextoSeleccionado]}>{etiqueta}</Text>
              <Text style={[styles.chipDiaNumero, seleccionado && styles.chipDiaTextoSeleccionado]}>
                {d.slice(8, 10)}/{d.slice(5, 7)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  if (permiso === 'pendiente') {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (permiso === 'denegado' || permiso === 'error') {
    return (
      <View style={styles.centro}>
        <Text style={styles.mensajeCentro}>
          {permiso === 'denegado'
            ? 'Para invitar desde tu agenda necesitamos permiso para leer tus contactos. Los usamos solo para armar la invitación, no se guardan en el servidor.'
            : 'No se pudo leer la agenda del teléfono.'}
        </Text>
        <Boton titulo="Abrir configuración" variante="outline" onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  // Pantalla de resultados: WhatsApp abre un chat por vez, asi que cada fila
  // tiene su propio boton de envio (mismo criterio que la web).
  if (resultados) {
    return (
      <ScrollView style={styles.pantalla} contentContainerStyle={[styles.scroll, { paddingBottom: 20 + insets.bottom }]}>
        <Text style={styles.ayuda}>
          Se crearon las invitaciones. Tocá "Enviar" en cada una para abrir el chat de WhatsApp con el mensaje y el link ya armados.
        </Text>
        {resultados.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.nombreContacto}>{r.nombre}</Text>
            <Text style={styles.telefonoContacto}>{r.telefono}</Text>
            {!r.ok && <Text style={styles.errorFila}>{r.error}</Text>}
            {r.ok && r.enviadoAutomatico === false && <Text style={styles.errorFila}>{r.errorAutomatico}</Text>}
            {r.ok && r.enviadoAutomatico === true && <Text style={styles.enviadoOk}>Enviado automáticamente</Text>}
            {r.ok && r.linkWhatsapp ? (
              <Boton
                titulo="Enviar por WhatsApp"
                variante="outline"
                style={styles.botonFila}
                onPress={() => Linking.openURL(r.linkWhatsapp).catch(() => {
                  Alert.alert('No se pudo abrir WhatsApp', `Compartí este link a mano: ${r.linkInvitacion}`);
                })}
              />
            ) : null}
            {r.ok && !r.linkWhatsapp && r.linkInvitacion ? (
              <Boton
                titulo="Compartir link"
                variante="outline"
                style={styles.botonFila}
                onPress={() => Share.share({ message: r.linkInvitacion })}
              />
            ) : null}
          </View>
        ))}
        <Boton titulo="Listo" style={styles.botonConfirmar} onPress={() => navigation.goBack()} />
      </ScrollView>
    );
  }

  const ocultos = contactosFiltrados.length - MAX_VISIBLES;

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={[styles.scroll, { paddingBottom: 20 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {esPropietario ? (
        propiasFilas.length === 0 ? (
          <Text style={styles.ayuda}>
            No encontramos un lote asociado a tu usuario, así que no podés generar invitaciones.
          </Text>
        ) : propiasFilas.length > 1 ? (
          <>
            <Text style={styles.seccionTitulo}>Lote</Text>
            <View style={styles.segmentado}>
              {propiasFilas.map((p) => {
                const activo = p.id_propietario === idPropietario;
                return (
                  <Pressable
                    key={p.id_propietario}
                    onPress={() => setIdPropietario(p.id_propietario)}
                    style={[styles.segmento, activo && styles.segmentoActivo]}
                    accessibilityRole="button"
                    accessibilityLabel={`Lote ${p.numero_lote}`}
                    accessibilityState={{ selected: activo }}
                  >
                    <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]}>Lote {p.numero_lote}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null
      ) : (
        <>
          <Campo
            label="Propietario que invita"
            value={busquedaPropietario}
            onChangeText={(t) => { setBusquedaPropietario(t); setIdPropietario(null); }}
            placeholder="Buscar por nombre..."
          />
          {resultadosPropietario.length > 0 && !idPropietario && (
            <View style={styles.listaResultados}>
              {resultadosPropietario.map((p) => (
                <Pressable
                  key={p.id_propietario}
                  style={styles.itemResultado}
                  onPress={() => {
                    setIdPropietario(p.id_propietario);
                    setBusquedaPropietario(`${p.usuario?.nombre} ${p.usuario?.apellido} (Lote ${p.numero_lote})`);
                    setResultadosPropietario([]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.usuario?.nombre} ${p.usuario?.apellido}, lote ${p.numero_lote}`}
                >
                  <Text style={styles.itemResultadoTexto}>
                    {p.usuario?.nombre} {p.usuario?.apellido} (Lote {p.numero_lote})
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      <Text style={styles.seccionTitulo}>Tipo de invitación (para todos)</Text>
      <View style={styles.segmentado}>
        {[{ valor: 'puntual', etiqueta: 'Visita' }, { valor: 'trabajador', etiqueta: 'Trabajador' }].map((o) => {
          const activo = o.valor === tipo;
          return (
            <Pressable
              key={o.valor}
              onPress={() => setTipo(o.valor)}
              style={[styles.segmento, activo && styles.segmentoActivo]}
              accessibilityRole="button"
              accessibilityLabel={o.etiqueta}
              accessibilityState={{ selected: activo }}
            >
              <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]}>{o.etiqueta}</Text>
            </Pressable>
          );
        })}
      </View>

      {tipo === 'trabajador' && (
        <>
          <Text style={styles.seccionTitulo}>Trabajador</Text>
          <View style={styles.segmentado}>
            {[{ valor: true, etiqueta: 'Fijo' }, { valor: false, etiqueta: 'No fijo' }].map((o) => {
              const activo = o.valor === trabajadorFijo;
              return (
                <Pressable
                  key={String(o.valor)}
                  onPress={() => setTrabajadorFijo(o.valor)}
                  style={[styles.segmento, activo && styles.segmentoActivo]}
                  accessibilityRole="button"
                  accessibilityLabel={o.etiqueta}
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]}>{o.etiqueta}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {tipo === 'puntual' || (tipo === 'trabajador' && !trabajadorFijo) ? (
        <>
          <Text style={styles.seccionTitulo}>Día de la visita</Text>
          {renderTiraDias()}
        </>
      ) : (
        <>
          <Text style={styles.seccionTitulo}>Días habilitados</Text>
          <View style={styles.grillaDias}>
            {DIAS_SEMANA.map((d) => {
              const activo = diasSemana.includes(d.valor);
              return (
                <Pressable
                  key={d.valor}
                  onPress={() => alternarDia(d.valor)}
                  style={[styles.chipSemana, activo && styles.chipSemanaActivo]}
                  accessibilityRole="button"
                  accessibilityLabel={d.etiqueta}
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[styles.chipSemanaTexto, activo && styles.chipSemanaTextoActivo]}>{d.etiqueta}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Pressable
        style={styles.filaCheck}
        onPress={() => setHorarioLimitado((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityLabel="Limitar horario de ingreso"
        accessibilityState={{ checked: horarioLimitado }}
      >
        <View style={[styles.check, horarioLimitado && styles.checkActivo]}>
          {horarioLimitado ? <Text style={styles.checkTilde}>✓</Text> : null}
        </View>
        <Text style={styles.checkTexto}>Limitar horario de ingreso (opcional)</Text>
      </Pressable>

      {horarioLimitado && (
        <View style={styles.filaHoras}>
          <View style={styles.mitad}>
            <Campo label="Desde (HH:MM)" value={horaDesde} onChangeText={setHoraDesde} placeholder="08:00" />
          </View>
          <View style={styles.mitad}>
            <Campo label="Hasta (HH:MM)" value={horaHasta} onChangeText={setHoraHasta} placeholder="18:00" />
          </View>
        </View>
      )}

      <Text style={styles.seccionTitulo}>Contactos ({totalSeleccionados} marcados)</Text>
      <Campo
        label="Buscar en mi agenda"
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Nombre o número..."
      />
      <Text style={styles.ayuda}>
        Revisá que el número tenga el código de país (ej: 5491122334455); si no, WhatsApp no lo va a encontrar.
      </Text>

      {contactosFiltrados.length === 0 ? (
        <Text style={styles.ayuda}>No hay contactos con teléfono que coincidan.</Text>
      ) : (
        <View style={styles.listaContactos}>
          {contactosFiltrados.slice(0, MAX_VISIBLES).map((c) => {
            const marcado = c.id in seleccionados;
            return (
              <View key={c.id} style={styles.filaContacto}>
                <Pressable
                  style={styles.filaContactoToque}
                  onPress={() => alternarContacto(c)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${c.nombre || 'Sin nombre'}, ${c.telefono}`}
                  accessibilityState={{ checked: marcado }}
                >
                  <View style={[styles.check, marcado && styles.checkActivo]}>
                    {marcado ? <Text style={styles.checkTilde}>✓</Text> : null}
                  </View>
                  <View style={styles.datosContacto}>
                    <Text style={styles.nombreContacto}>{c.nombre || 'Sin nombre'}</Text>
                    {!marcado && <Text style={styles.telefonoContacto}>{c.telefono}</Text>}
                  </View>
                </Pressable>
                {marcado && (
                  <TextInput
                    style={styles.inputTelefono}
                    value={seleccionados[c.id]}
                    onChangeText={(t) => setSeleccionados((s) => ({ ...s, [c.id]: t }))}
                    keyboardType="phone-pad"
                    placeholder="Teléfono"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={`Teléfono de ${c.nombre || 'el contacto'}`}
                  />
                )}
              </View>
            );
          })}
          {ocultos > 0 && (
            <Text style={styles.ayudaLista}>
              Se muestran {MAX_VISIBLES} de {contactosFiltrados.length}. Afiná la búsqueda para ver el resto.
            </Text>
          )}
        </View>
      )}

      <Boton
        titulo={totalSeleccionados ? `Invitar a ${totalSeleccionados}` : 'Invitar'}
        onPress={crearTodas}
        cargando={enviando}
        disabled={totalSeleccionados === 0}
        style={styles.botonConfirmar}
      />
    </ScrollView>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 16 },
    mensajeCentro: { fontSize: 16, color: colors.textMuted, textAlign: 'center' },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerContainer,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
      fontSize: 15,
    },
    errorFila: { color: colors.danger, fontSize: 14, marginTop: 4 },
    enviadoOk: { color: colors.success, fontSize: 14, fontWeight: '600', marginTop: 4 },
    seccionTitulo: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 8 },
    ayuda: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
    ayudaLista: { fontSize: 14, color: colors.textMuted, padding: 12 },
    segmentado: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    segmento: {
      flexGrow: 1,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentoActivo: { backgroundColor: colors.primary },
    segmentoTexto: { fontSize: 16, fontWeight: '600', color: colors.primary },
    segmentoTextoActivo: { color: colors.onPrimary },
    listaResultados: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      marginBottom: 12,
      overflow: 'hidden',
    },
    itemResultado: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemResultadoTexto: { fontSize: 16, color: colors.text },
    tiraDias: { marginBottom: 6 },
    chipDia: {
      width: 60,
      height: 60,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    chipDiaSeleccionado: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipDiaTexto: { fontSize: 13, color: colors.textMuted, textTransform: 'capitalize' },
    chipDiaNumero: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
    chipDiaTextoSeleccionado: { color: colors.onPrimary },
    grillaDias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chipSemana: {
      minWidth: 56,
      minHeight: 48,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSemanaActivo: { backgroundColor: colors.primary },
    chipSemanaTexto: { fontSize: 16, fontWeight: '600', color: colors.primary },
    chipSemanaTextoActivo: { color: colors.onPrimary },
    filaCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, marginTop: 6 },
    check: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkActivo: { backgroundColor: colors.primary },
    checkTilde: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
    checkTexto: { fontSize: 16, color: colors.text, flexShrink: 1 },
    filaHoras: { flexDirection: 'row', gap: 12 },
    mitad: { flex: 1 },
    listaContactos: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    filaContacto: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12, paddingVertical: 6 },
    filaContactoToque: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
    datosContacto: { flex: 1 },
    nombreContacto: { fontSize: 16, fontWeight: '600', color: colors.text },
    telefonoContacto: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
    inputTelefono: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.bg,
      marginBottom: 6,
      minHeight: 46,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      ...sombraCard,
    },
    botonFila: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 8 },
    botonConfirmar: { marginTop: 16 },
  });
}
