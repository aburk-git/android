import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buscarPropietarios,
  crearClienteBarrio,
  crearInvitacion,
  crearVisitante,
  obtenerBarrio,
  obtenerPropietariosPropios,
  obtenerVisitantesDelLote,
} from '../api/barrio';
import { useCuentas } from '../context/CuentasContext';
import Boton from '../components/Boton';
import Campo from '../components/Campo';
import { useColors } from '../theme/colors';
import { fechaISOEnZona, nombreDiaCorto } from '../utils/horarios';

const DIAS_ADELANTE = 30;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const OPCIONES_TRABAJADOR_FIJO = [{ valor: true, etiqueta: 'Fijo' }, { valor: false, etiqueta: 'No fijo' }];

const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'Lun' },
  { valor: 2, etiqueta: 'Mar' },
  { valor: 3, etiqueta: 'Mié' },
  { valor: 4, etiqueta: 'Jue' },
  { valor: 5, etiqueta: 'Vie' },
  { valor: 6, etiqueta: 'Sáb' },
  { valor: 0, etiqueta: 'Dom' },
];

// Grupo de botones excluyentes, equivalente al .btn-group de la web.
function Segmentado({ opciones, valor, onChange, styles }) {
  return (
    <View style={styles.segmentado}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={String(o.valor)}
            onPress={() => onChange(o.valor)}
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
  );
}

// Misma logica de alta que ModalCrearInvitacion.jsx en la web, adaptada a una
// pantalla: el propietario elige su lote, el visitante (uno que ya entro o uno
// nuevo), si es una visita puntual o un trabajador recurrente, y por que canal
// se envia. El backend vuelve a validar todo (permiso invitaciones.crear y que
// el lote sea propio), esto solo evita viajes de ida y vuelta.
export default function NuevaInvitacionScreen({ navigation, route }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(colors), [colors]);
  const { cuentas } = useCuentas();
  const cuenta = cuentas.find((c) => c.id === route.params.cuentaId);
  const cliente = useMemo(() => crearClienteBarrio(cuenta.url, cuenta.token), [cuenta.url, cuenta.token]);

  const esPropietario = cuenta.usuario.rol === 'Propietario';
  const zona = cuenta.usuario.zona_horaria ?? 'America/Argentina/Buenos_Aires';

  const [config, setConfig] = useState(null);
  const [propiasFilas, setPropiasFilas] = useState([]);
  const [idPropietario, setIdPropietario] = useState(null);
  const [loteBuscado, setLoteBuscado] = useState('');
  const [busquedaPropietario, setBusquedaPropietario] = useState('');
  const [resultadosPropietario, setResultadosPropietario] = useState([]);

  const [modoVisitante, setModoVisitante] = useState('buscar');
  const [visitantesLote, setVisitantesLote] = useState([]);
  const [filtroVisitante, setFiltroVisitante] = useState('');
  const [visitanteSeleccionado, setVisitanteSeleccionado] = useState(null);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');

  const [tipo, setTipo] = useState('puntual');
  const [trabajadorFijo, setTrabajadorFijo] = useState(true);
  const [fechaVisita, setFechaVisita] = useState(() => fechaISOEnZona(zona));
  const [diasSemana, setDiasSemana] = useState([]);
  const [horarioLimitado, setHorarioLimitado] = useState(false);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [canalEnvio, setCanalEnvio] = useState('email');

  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const dias = useMemo(
    () => Array.from({ length: DIAS_ADELANTE }, (_, i) => fechaISOEnZona(zona, i)),
    [zona]
  );

  useEffect(() => {
    obtenerBarrio(cliente, cuenta.usuario.id_barrio)
      .then((data) => setConfig(data.configuracion ?? {}))
      .catch(() => setConfig({}));
  }, [cliente, cuenta.usuario.id_barrio]);

  // Un titular puede tener varios lotes (una fila propia por lote). Se filtra
  // por el usuario logueado igual que la web: son las unicas filas para las que
  // el backend va a aceptar crear la invitacion.
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

  // Busqueda de propietario con debounce, solo para roles que invitan en
  // nombre de otro (Guardia/Administrador).
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

  const filaPropia = esPropietario
    ? propiasFilas.find((p) => p.id_propietario === idPropietario)
    : null;
  const loteFinal = esPropietario ? filaPropia?.numero_lote : loteBuscado;

  const cargarVisitantes = useCallback(() => {
    if (!loteFinal) {
      setVisitantesLote([]);
      return;
    }
    obtenerVisitantesDelLote(cliente, loteFinal)
      .then(setVisitantesLote)
      .catch(() => setVisitantesLote([]));
  }, [cliente, loteFinal]);

  useEffect(() => {
    setVisitanteSeleccionado(null);
    cargarVisitantes();
  }, [cargarVisitantes]);

  const visitantesFiltrados = useMemo(() => {
    const texto = filtroVisitante.trim().toLowerCase();
    if (!texto) return visitantesLote;
    return visitantesLote.filter((v) =>
      `${v.nombre} ${v.apellido ?? ''}`.toLowerCase().includes(texto) || (v.dni ?? '').includes(texto)
    );
  }, [visitantesLote, filtroVisitante]);

  const whatsappHabilitado = Boolean(config?.whatsapp_invitaciones_habilitado);

  function alternarDia(dia) {
    setDiasSemana((actuales) =>
      actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia]
    );
  }

  function validar() {
    if (!idPropietario) return 'Elegí el lote de la invitación';
    if (modoVisitante === 'buscar' && !visitanteSeleccionado) return 'Elegí un visitante de la lista';
    if (modoVisitante === 'nuevo') {
      if (!dni) return 'El DNI del visitante es requerido';
      if (canalEnvio === 'email' && (!nombre || !apellido)) return 'Nombre y apellido son requeridos';
      if (canalEnvio === 'email' && !email) return 'El email es requerido para enviar la invitación';
    }
    if (canalEnvio === 'whatsapp' && !telefono) return 'El teléfono es requerido para enviar por WhatsApp';
    if (tipo === 'puntual' && !fechaVisita) return 'Elegí el día de la visita';
    if (tipo === 'trabajador' && trabajadorFijo && diasSemana.length === 0) return 'Elegí al menos un día de la semana';
    if (tipo === 'trabajador' && !trabajadorFijo && !fechaVisita) return 'Elegí el día de la visita';
    if (horarioLimitado) {
      if (!HORA_REGEX.test(horaDesde) || !HORA_REGEX.test(horaHasta)) return 'Completá el horario con formato HH:MM (ej: 08:30)';
      if (horaDesde >= horaHasta) return 'El horario "desde" debe ser anterior al "hasta"';
    }
    return '';
  }

  // El backend puede responder de tres formas distintas segun como este
  // configurado el barrio: link de WhatsApp para mandar a mano, envio
  // automatico ya hecho por la API de Meta, o email en segundo plano.
  function avisarResultado(data) {
    if (data.link_whatsapp) {
      Linking.openURL(data.link_whatsapp).catch(() => {
        Alert.alert('Invitación creada', `No se pudo abrir WhatsApp. Mandá este link a mano: ${data.link_invitacion}`);
      });
      navigation.goBack();
      return;
    }
    if (data.whatsapp_enviado === false) {
      Alert.alert(
        'Invitación creada, pero no se envió',
        `${data.whatsapp_error ?? 'Falló el envío automático'}. Link para mandar a mano: ${data.link_invitacion}`,
        [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
      );
      return;
    }
    const comoSeEnvio = data.whatsapp_enviado === true ? 'por WhatsApp' : 'por email';
    Alert.alert('Invitación creada', `Se envió ${comoSeEnvio}.`, [
      { text: 'Aceptar', onPress: () => navigation.goBack() },
    ]);
  }

  async function confirmar() {
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }

    setError('');
    setCargando(true);
    try {
      let idVisitanteFinal = visitanteSeleccionado?.id_visitante;
      if (modoVisitante === 'nuevo') {
        const visitante = await crearVisitante(cliente, {
          id_barrio: cuenta.usuario.id_barrio,
          nombre: nombre || undefined,
          apellido: apellido || undefined,
          dni: dni || undefined,
          email: email || undefined,
          telefono: telefono || undefined,
          tipo: 'visita',
          creado_por_propietario_id: idPropietario,
        });
        idVisitanteFinal = visitante.id_visitante;
      }

      const esFechaPuntual = tipo === 'puntual' || (tipo === 'trabajador' && !trabajadorFijo);
      const data = await crearInvitacion(cliente, {
        id_propietario: idPropietario,
        id_visitante: idVisitanteFinal,
        tipo,
        canal_envio: canalEnvio,
        ...(esFechaPuntual
          ? { fecha_visita: fechaVisita, ...(tipo === 'puntual' ? { horas_validez: config?.tiempo_validez_invitacion_horas || undefined } : {}) }
          : { dias_semana: diasSemana }),
        ...(horarioLimitado ? { hora_ingreso_desde: horaDesde, hora_ingreso_hasta: horaHasta } : {}),
        ...(canalEnvio === 'whatsapp' ? { telefono } : {}),
      });

      avisarResultado(data);
    } catch (err) {
      setError(err.response?.data?.error ?? 'No se pudo crear la invitación');
    } finally {
      setCargando(false);
    }
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
            Consultá con la administración del barrio.
          </Text>
        ) : propiasFilas.length > 1 ? (
          <>
            <Text style={styles.seccionTitulo}>Lote</Text>
            <Segmentado
              styles={styles}
              opciones={propiasFilas.map((p) => ({ valor: p.id_propietario, etiqueta: `Lote ${p.numero_lote}` }))}
              valor={idPropietario}
              onChange={setIdPropietario}
            />
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
                    setLoteBuscado(p.numero_lote);
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

      <Text style={styles.seccionTitulo}>Tipo de invitación</Text>
      <Segmentado
        styles={styles}
        opciones={[{ valor: 'puntual', etiqueta: 'Visita' }, { valor: 'trabajador', etiqueta: 'Trabajador' }]}
        valor={tipo}
        onChange={setTipo}
      />

      <Text style={styles.seccionTitulo}>Visitante</Text>
      <Segmentado
        styles={styles}
        opciones={[{ valor: 'buscar', etiqueta: 'Ya vino antes' }, { valor: 'nuevo', etiqueta: 'Nuevo' }]}
        valor={modoVisitante}
        onChange={(v) => { setModoVisitante(v); setError(''); }}
      />

      {modoVisitante === 'buscar' ? (
        !idPropietario ? (
          <Text style={styles.ayuda}>Elegí primero el lote.</Text>
        ) : (
          <>
            <Campo
              label="Buscar por nombre o DNI"
              value={filtroVisitante}
              onChangeText={(t) => { setFiltroVisitante(t); setVisitanteSeleccionado(null); }}
              placeholder="Escribí para filtrar..."
            />
            {visitanteSeleccionado ? (
              <Text style={styles.seleccionado}>
                Seleccionado: {visitanteSeleccionado.nombre} {visitanteSeleccionado.apellido ?? ''}
              </Text>
            ) : visitantesFiltrados.length === 0 ? (
              <Text style={styles.ayuda}>No hay visitantes que ya hayan ingresado a este lote.</Text>
            ) : (
              <View style={styles.listaResultados}>
                {visitantesFiltrados.slice(0, 20).map((v) => (
                  <Pressable
                    key={v.id_visitante}
                    style={styles.itemResultado}
                    onPress={() => {
                      setVisitanteSeleccionado(v);
                      setFiltroVisitante(`${v.nombre} ${v.apellido ?? ''}`.trim());
                      if (v.telefono) setTelefono(v.telefono);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${v.nombre} ${v.apellido ?? ''}${v.dni ? `, DNI ${v.dni}` : ''}`}
                  >
                    <Text style={styles.itemResultadoTexto}>
                      {v.nombre} {v.apellido ?? ''} {v.dni ? `(${v.dni})` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )
      ) : (
        <>
          <Campo label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
          <Campo label="Apellido" value={apellido} onChangeText={setApellido} autoCapitalize="words" />
          <Campo label="DNI" value={dni} onChangeText={(t) => setDni(t.replace(/\D/g, ''))} keyboardType="number-pad" />
          {canalEnvio === 'email' ? (
            <Campo label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="Para enviarle la invitación" />
          ) : null}
          {canalEnvio === 'whatsapp' ? (
            <Text style={styles.ayuda}>
              Si no completás nombre y apellido, se los vamos a pedir al visitante cuando abra el link.
            </Text>
          ) : null}
        </>
      )}

      {whatsappHabilitado && (
        <>
          <Text style={styles.seccionTitulo}>Canal de envío</Text>
          <Segmentado
            styles={styles}
            opciones={[{ valor: 'email', etiqueta: 'Email' }, { valor: 'whatsapp', etiqueta: 'WhatsApp' }]}
            valor={canalEnvio}
            onChange={setCanalEnvio}
          />
        </>
      )}

      {canalEnvio === 'whatsapp' && (
        <Campo
          label="Teléfono del visitante"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
          placeholder="Ej: 5491122334455"
        />
      )}

      {tipo === 'trabajador' && (
        <>
          <Text style={styles.seccionTitulo}>Trabajador</Text>
          <Segmentado styles={styles} opciones={OPCIONES_TRABAJADOR_FIJO} valor={trabajadorFijo} onChange={setTrabajadorFijo} />
        </>
      )}

      {tipo === 'puntual' || (tipo === 'trabajador' && !trabajadorFijo) ? (
        <>
          <Text style={styles.seccionTitulo}>Día de la visita</Text>
          {renderTiraDias()}
          {tipo === 'puntual' && (
            <Text style={styles.ayuda}>
              Vale por {config?.tiempo_validez_invitacion_horas ?? 24} horas desde el inicio de ese día.
            </Text>
          )}
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
          <Text style={styles.ayuda}>Queda vigente todas las semanas, esos días, hasta que la canceles.</Text>
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

      <Boton titulo="Crear invitación" onPress={confirmar} cargando={cargando} style={styles.botonConfirmar} />
    </ScrollView>
  );
}

function crearEstilos(colors) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerContainer,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
      fontSize: 15,
    },
    seccionTitulo: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 8 },
    ayuda: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
    seleccionado: { fontSize: 15, color: colors.success, fontWeight: '600', marginBottom: 10 },
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
    botonConfirmar: { marginTop: 16 },
  });
}
