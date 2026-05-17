import React, { useState, useContext, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  SafeAreaView,
  Modal,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { AppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { doc, updateDoc, collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';

export default function MeseroScreen() {
  // --- CONTEXTO Y ESTADOS GLOBALES ---
  const { productos, crearOrden, ordenes, usuario, setUsuario } = useContext(AppContext);
  const [seccion, setSeccion] = useState('nueva'); 
  const [carrito, setCarrito] = useState([]);
  const [cliente, setCliente] = useState('');
  const [tipoOrden, setTipoOrden] = useState('Comer Aquí'); 
  const [mesas, setMesas] = useState([]); 
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);

  // --- ESTADOS DE NOTIFICACIONES ---
  const [notificaciones, setNotificaciones] = useState([]);
  const [notisVisibles, setNotisVisibles] = useState(false);
  const [notiFlotante, setNotiFlotante] = useState(null);

  // --- ESTADOS DE PAGO Y FACTURACIÓN ---
  const [modalPagoVisible, setModalPagoVisible] = useState(false);
  const [ordenParaPagar, setOrdenParaPagar] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [pagoCompletado, setPagoCompletado] = useState(false); 
  const [metodoSeleccionado, setMetodoSeleccionado] = useState('Efectivo');

  const categorias = ["entradas", "plato fuerte", "bebidas", "postres"];

  // --- 1. CARGA DE MESAS Y NOTIFICACIONES REAL-TIME ---
  useEffect(() => {
    if (!usuario) return;

    // Listener de Mesas
    const qMesas = query(collection(db, "mesas"), orderBy("numero", "asc"));
    const unsubMesas = onSnapshot(qMesas, (snapshot) => {
      setMesas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listener de Notificaciones (Órdenes Despachadas del mesero actual)
    const qNotis = query(
      collection(db, "ordenes"), 
      where("nombreMesero", "==", usuario.nombre),
      where("estado", "==", "Despachada")
    );

    const unsubNotis = onSnapshot(qNotis, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const data = change.doc.data();
          const id = change.doc.id;
          
          setNotificaciones(prev => {
            if (!prev.find(n => n.id === id)) {
              const nuevaNoti = { id, cliente: data.cliente, mesa: data.mesa };
              setNotiFlotante(nuevaNoti); 
              setTimeout(() => setNotiFlotante(null), 6000); 
              return [nuevaNoti, ...prev];
            }
            return prev;
          });
        }
      });
    });

    return () => { unsubMesas(); unsubNotis(); };
  }, [usuario]);

  const leerNotificacion = (id) => {
    setNotificaciones(prev => prev.filter(n => n.id !== id));
    if (notiFlotante?.id === id) setNotiFlotante(null);
  };

  // --- 2. LÓGICA DE CARRITO ---
  const agregarAlCarrito = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const eliminarDelCarrito = (id) => {
    setCarrito(prev => prev.filter(item => item.id !== id));
  };

  const totalOrden = useMemo(() => carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0).toFixed(2), [carrito]);

  const formularioValido = useMemo(() => {
    const base = cliente.trim().length >= 3 && carrito.length > 0;
    return tipoOrden === 'Comer Aquí' ? base && mesaSeleccionada !== null : base;
  }, [cliente, carrito, mesaSeleccionada, tipoOrden]);

  // --- 3. ACCIONES FIREBASE ---
  const handleEnviarCocina = async () => {
    try {
      const esComerAqui = tipoOrden === 'Comer Aquí';
      const hoy = new Date();
      await crearOrden({ 
        cliente: cliente.trim(), 
        mesa: esComerAqui ? `Mesa ${mesaSeleccionada}` : "Para Llevar", 
        idMesa: esComerAqui ? mesaSeleccionada.toString() : null,
        tipoOrden, productos: carrito, total: totalOrden, estado: 'Ordenada',
        fechaCreacion: hoy.toISOString(),
        fechaFiltro: hoy.toLocaleDateString('en-CA'),
        nombreMesero: usuario?.nombre || 'Mesero'
      });
      if (esComerAqui) await updateDoc(doc(db, "mesas", mesaSeleccionada.toString()), { estado: 'ocupada' });
      setCarrito([]); setCliente(''); setMesaSeleccionada(null);
      Alert.alert("Éxito", "Pedido enviado a cocina");
    } catch (e) { Alert.alert("Error", "Fallo al conectar"); }
  };

  const enviarACaja = async (id) => {
    try {
      await updateDoc(doc(db, "ordenes", id), { estado: 'En Caja' });
      leerNotificacion(id); 
      Alert.alert("Enviado", "La orden ya está en el panel de Caja.");
    } catch (error) { Alert.alert("Error", "No se pudo enviar."); }
  };

  const ejecutarCobroFinal = async () => {
    setProcesandoPago(true);
    setTimeout(async () => {
      try {
        const ahora = new Date();
        await updateDoc(doc(db, "ordenes", ordenParaPagar.id), { 
          estado: 'Pagada', 
          metodoPago: `${metodoSeleccionado} (Mesero)`,
          fechaPago: ahora.toISOString(),
          fechaFiltro: ahora.toLocaleDateString('en-CA'),
          responsableFinal: usuario?.nombre || 'Mesero'
        });
        if (ordenParaPagar.idMesa) await updateDoc(doc(db, "mesas", ordenParaPagar.idMesa), { estado: 'libre' });
        leerNotificacion(ordenParaPagar.id);
        setProcesandoPago(false);
        setPagoCompletado(true); 
      } catch (e) {
        setProcesandoPago(false);
        Alert.alert("Error", "Fallo al procesar pago.");
      }
    }, 2000); 
  };

  const cerrarTodoElPago = () => {
    setModalPagoVisible(false);
    setPagoCompletado(false);
    setOrdenParaPagar(null);
  };

  const misOrdenesActivas = useMemo(() => 
    ordenes.filter(o => 
      ['Ordenada', 'Recibida', 'Preparando', 'Despachada'].includes(o.estado) && 
      o.nombreMesero === usuario?.nombre
    ), [ordenes, usuario]);

  return (
    <SafeAreaView style={styles.container}>
      {/* NOTIFICACIÓN FLOTANTE */}
      {notiFlotante && (
        <TouchableOpacity 
          style={styles.floatingNoti} 
          onPress={() => { leerNotificacion(notiFlotante.id); setSeccion('activas'); }}
        >
          <Ionicons name="notifications" size={24} color="white" />
          <View style={{marginLeft: 10, flex: 1}}>
            <Text style={styles.notiTitle}>¡Pedido Listo!</Text>
            <Text style={styles.notiText}>{notiFlotante.mesa} - {notiFlotante.cliente}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="white" />
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSubtitle}>Bienvenido mesero,</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{usuario?.nombre || 'Mesero'}</Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity style={styles.notiBtn} onPress={() => setNotisVisibles(true)}>
              <Ionicons name="notifications-outline" size={26} color="#1C1C1E" />
              {notificaciones.length > 0 && <View style={styles.notiBadge}><Text style={styles.notiBadgeText}>{notificaciones.length}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUsuario(null)} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tab, seccion === 'nueva' && styles.tabActive]} onPress={() => setSeccion('nueva')}>
            <Ionicons name="add-circle" size={22} color={seccion === 'nueva' ? '#FF6F00' : '#8E8E93'} />
            <Text style={[styles.tabText, seccion === 'nueva' && styles.tabTextActive]}>Nueva Orden</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, seccion === 'activas' && styles.tabActive]} onPress={() => setSeccion('activas')}>
            <Ionicons name="list" size={22} color={seccion === 'activas' ? '#FF6F00' : '#8E8E93'} />
            <Text style={[styles.tabText, seccion === 'activas' && styles.tabTextActive]}>Mis Órdenes</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: carrito.length > 0 ? 320 : 50 }}>
          {seccion === 'nueva' ? (
            <View>
              <View style={styles.configCard}>
                 <View style={styles.tipoRow}>
                    <TouchableOpacity style={[styles.tipoBtn, tipoOrden === 'Comer Aquí' && styles.tipoBtnActive]} onPress={() => setTipoOrden('Comer Aquí')}>
                      <Text style={[styles.tipoBtnText, tipoOrden === 'Comer Aquí' && {color: 'white'}]}>Mesa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tipoBtn, tipoOrden === 'Para Llevar' && styles.tipoBtnActive]} onPress={() => { setTipoOrden('Para Llevar'); setMesaSeleccionada(null); }}>
                      <Text style={[styles.tipoBtnText, tipoOrden === 'Para Llevar' && {color: 'white'}]}>Llevar</Text>
                    </TouchableOpacity>
                 </View>
                 {tipoOrden === 'Comer Aquí' && (
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 15}}>
                      {mesas.map((m) => (
                        <TouchableOpacity key={m.id} disabled={m.estado === 'ocupada'} onPress={() => setMesaSeleccionada(m.numero)}
                          style={[styles.mesaBox, m.estado === 'ocupada' ? styles.mesaOcupada : mesaSeleccionada === m.numero ? styles.mesaSelected : styles.mesaLibre]}
                        >
                          <Text style={[styles.mesaText, mesaSeleccionada === m.numero && {color: 'white'}]}>{m.numero}</Text>
                        </TouchableOpacity>
                      ))}
                   </ScrollView>
                 )}
              </View>

              {categorias.map((cat) => {
                const filtrados = productos.filter(p => p.categoria.toLowerCase() === cat);
                if (filtrados.length === 0) return null;
                return (
                  <View key={cat} style={{marginBottom: 20}}>
                    <Text style={[styles.sectionTitle, {color: '#FF6F00'}]}>{cat.toUpperCase()}</Text>
                    {filtrados.map((prod) => (
                      <View key={prod.id} style={styles.cardItem}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.itemName}>{prod.nombre}</Text>
                          <Text style={styles.itemPrice}>${parseFloat(prod.precio).toFixed(2)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => agregarAlCarrito(prod)} style={styles.actionBtn}>
                          <Ionicons name="add" size={22} color="#4CAF50" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>MIS PEDIDOS ACTIVOS</Text>
              {misOrdenesActivas.map(ord => (
                <View key={ord.id} style={styles.cardItemActiva}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.itemName}>{ord.cliente}</Text>
                    <Text style={{fontSize: 12, color: '#FF6F00', fontWeight: 'bold'}}>{ord.mesa.toUpperCase()}</Text>
                    <View style={[styles.statusBadgeActiva, {backgroundColor: ord.estado === 'Despachada' ? '#4CAF50' : '#FFB300'}]}>
                      <Text style={styles.statusBadgeTextActiva}>{ord.estado.toUpperCase()}</Text>
                    </View>
                  </View>
                  {ord.estado === 'Despachada' ? (
                    <View style={styles.actionGroup}>
                      <TouchableOpacity style={[styles.btnMini, {backgroundColor: '#2196F3'}]} onPress={() => enviarACaja(ord.id)}>
                        <Ionicons name="wallet-outline" size={16} color="white" />
                        <Text style={styles.btnMiniText}>Caja</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btnMini, {backgroundColor: '#4CAF50'}]} onPress={() => { setOrdenParaPagar(ord); setPagoCompletado(false); setModalPagoVisible(true); }}>
                        <Ionicons name="cash-outline" size={16} color="white" />
                        <Text style={styles.btnMiniText}>Cobrar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{alignItems: 'center'}}>
                        <ActivityIndicator size="small" color="#FF6F00" />
                        <Text style={{fontSize: 10, color: '#8E8E93', marginTop: 4}}>En Cocina</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {carrito.length > 0 && seccion === 'nueva' && (
          <View style={styles.footerCart}>
            <View style={styles.cartHeaderRow}>
               <Text style={styles.resumenTitle}>ORDEN : {tipoOrden === 'Comer Aquí' ? `MESA #${mesaSeleccionada || '?'}` : 'PARA LLEVAR'}</Text>
               <Ionicons name="cart-outline" size={20} color="#FF6F00" />
            </View>
            <ScrollView style={styles.miniCarrito} nestedScrollEnabled={true}>
              {carrito.map(item => (
                <View key={item.id} style={styles.carritoItem}>
                  <Text style={styles.carritoText}>{item.cantidad}x {item.nombre}</Text>
                  <TouchableOpacity onPress={() => eliminarDelCarrito(item.id)}>
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TextInput placeholder="Nombre del Cliente..." style={styles.cInput} value={cliente} onChangeText={setCliente} placeholderTextColor="#999" />
            <TouchableOpacity onPress={handleEnviarCocina} disabled={!formularioValido} style={[styles.sendBtn, !formularioValido && {backgroundColor: '#CCC'}]}>
              <Text style={styles.sendBtnText}>Enviar a Cocina • ${totalOrden}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* MODAL COBRO (CON ANIMACIÓN ESTILO CAJA) */}
      <Modal visible={modalPagoVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.facturaContent}>
            {!pagoCompletado ? (
              <>
                <View style={styles.facturaHeader}><Ionicons name="receipt-outline" size={30} color="#FF6F00" /><Text style={styles.facturaTitle}>Detalle de Cobro</Text></View>
                <ScrollView style={{maxHeight: 180}} showsVerticalScrollIndicator={false}>
                  {ordenParaPagar?.productos.map((p, i) => (
                    <View key={i} style={styles.facturaRow}><Text style={styles.facturaItem}>{p.cantidad}x {p.nombre}</Text><Text style={{fontWeight:'bold'}}>${(p.cantidad * p.precio).toFixed(2)}</Text></View>
                  ))}
                </ScrollView>
                <View style={styles.facturaDivider} /><View style={styles.facturaRow}><Text style={{fontSize: 18, fontWeight: 'bold'}}>TOTAL</Text><Text style={{fontSize: 18, fontWeight: 'bold', color: '#FF6F00'}}>${ordenParaPagar?.total}</Text></View>
                {procesandoPago ? <View style={{padding: 20, alignItems: 'center'}}><ActivityIndicator size="large" color="#FF6F00" /><Text style={{marginTop: 10, color: '#666'}}>Procesando pago...</Text></View> : (
                  <>
                    <View style={styles.metodoRow}>
                      <TouchableOpacity style={[styles.metodoBtn, metodoSeleccionado === 'Tarjeta' && styles.metodoBtnActive]} onPress={() => setMetodoSeleccionado('Tarjeta')}><Text style={{color: metodoSeleccionado === 'Tarjeta' ? 'white' : '#333'}}>Tarjeta</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.metodoBtn, metodoSeleccionado === 'Efectivo' && styles.metodoBtnActive]} onPress={() => setMetodoSeleccionado('Efectivo')}><Text style={{color: metodoSeleccionado === 'Efectivo' ? 'white' : '#333'}}>Efectivo</Text></TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.confirmBtnPago} onPress={ejecutarCobroFinal}><Text style={{color:'white', fontWeight:'bold'}}>REGISTRAR PAGO</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setModalPagoVisible(false)} style={{marginTop: 15, alignItems: 'center'}}><Text style={{color: '#8E8E93'}}>Cancelar</Text></TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <View style={{alignItems: 'center', padding: 20}}>
                <Ionicons name="checkmark-done-circle" size={80} color="#4CAF50" />
                <Text style={styles.facturaTitle}>¡Cobro Exitoso!</Text>
                <TouchableOpacity style={[styles.confirmBtnPago, {backgroundColor: '#4CAF50', marginTop: 20, width: '100%'}]} onPress={cerrarTodoElPago}>
                  <Text style={{color:'white'}}>FINALIZAR</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL NOTIFICACIONES (CAMPANITA) */}
      <Modal visible={notisVisibles} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.facturaContent}>
            <Text style={styles.facturaTitle}>Órdenes Listas</Text>
            {notificaciones.length === 0 ? <Text style={{textAlign: 'center', color: '#888', marginVertical: 20}}>Sin platos por servir</Text> : (
              <FlatList data={notificaciones} keyExtractor={item => item.id} renderItem={({item}) => (
                <TouchableOpacity style={styles.notiItem} onPress={() => { leerNotificacion(item.id); setNotisVisibles(false); setSeccion('activas'); }}>
                  <Ionicons name="restaurant" size={20} color="#FF6F00" />
                  <View style={{marginLeft: 10, flex: 1}}><Text style={{fontWeight: 'bold'}}>{item.mesa}</Text><Text style={{fontSize: 12, color: '#666'}}>Cliente: {item.cliente}</Text></View>
                </TouchableOpacity>
              )} />
            )}
            <TouchableOpacity style={styles.closeFacturaBtn} onPress={() => setNotisVisibles(false)}><Text style={{color: 'white', fontWeight: 'bold'}}>CERRAR</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: 25, paddingHorizontal: 25, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' }, 
  headerSubtitle: { fontSize: 12, color: '#8E8E93', marginBottom: 2 },
  logoutBtn: { padding: 10, backgroundColor: '#FFF1F0', borderRadius: 12, marginLeft: 10 },
  notiBtn: { padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12, position: 'relative' },
  notiBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: '#FF3B30', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  notiBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  floatingNoti: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, left: 20, right: 20, backgroundColor: '#1C1C1E', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', zIndex: 1000, elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  notiTitle: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  notiText: { color: '#CCC', fontSize: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: 'white', marginTop: 15, marginHorizontal: 25, borderRadius: 15, padding: 5, elevation: 2 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: '#FFF5EE' },
  tabText: { fontSize: 11, color: '#8E8E93', fontWeight: '500' },
  tabTextActive: { color: '#FF6F00', fontWeight: 'bold' },
  content: { flex: 1, paddingHorizontal: 25, paddingTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 15, color: '#3A3A3C', letterSpacing: 1 },
  configCard: { backgroundColor: 'white', padding: 15, borderRadius: 18, marginBottom: 25, elevation: 2 },
  tipoRow: { flexDirection: 'row', gap: 10 },
  tipoBtn: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F2F2F7', alignItems: 'center' },
  tipoBtnActive: { backgroundColor: '#FF6F00', borderColor: '#FF6F00' },
  tipoBtnText: { fontWeight: 'bold', color: '#8E8E93', fontSize: 12 },
  mesaBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1 },
  mesaLibre: { backgroundColor: 'white', borderColor: '#FF6F00' },
  mesaOcupada: { backgroundColor: '#F2F2F7', borderColor: '#EEE' },
  mesaSelected: { backgroundColor: '#FF6F00', borderColor: '#FF6F00' },
  mesaText: { fontWeight: 'bold', color: '#FF6F00' },
  cardItem: { backgroundColor: 'white', padding: 18, borderRadius: 18, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  cardItemActiva: { backgroundColor: 'white', padding: 15, borderRadius: 18, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2, borderLeftWidth: 4, borderLeftColor: '#FF6F00' },
  cardLeft: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  itemPrice: { fontSize: 14, color: '#FF6F00', fontWeight: 'bold' },
  statusBadgeActiva: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 5 },
  statusBadgeTextActiva: { fontSize: 9, color: 'white', fontWeight: 'bold' },
  actionBtn: { padding: 8, backgroundColor: '#F2F2F7', borderRadius: 10 },
  actionGroup: { flexDirection: 'row', gap: 8 },
  btnMini: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, elevation: 1 },
  btnMiniText: { color: 'white', fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  footerCart: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 25 },
  cartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resumenTitle: { fontSize: 11, fontWeight: 'bold', color: '#333' },
  miniCarrito: { maxHeight: 80, marginBottom: 15 },
  carritoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  carritoText: { fontSize: 13, color: '#555' },
  cInput: { backgroundColor: '#F2F2F7', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 14, color: '#333' },
  sendBtn: { backgroundColor: '#FF6F00', padding: 16, borderRadius: 15, alignItems: 'center' },
  sendBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  facturaContent: { backgroundColor: 'white', borderRadius: 25, padding: 25, shadowColor: '#000', elevation: 20, maxHeight: '80%' },
  facturaHeader: { alignItems: 'center', marginBottom: 20 },
  facturaTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  facturaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  facturaItem: { fontSize: 14, flex: 1 },
  facturaDivider: { height: 1, backgroundColor: '#F2F2F7', marginVertical: 15 },
  metodoRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 15 },
  metodoBtn: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EEE', width: '45%', alignItems: 'center' },
  metodoBtnActive: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  confirmBtnPago: { backgroundColor: '#FF6F00', padding: 16, borderRadius: 15, alignItems: 'center' },
  notiItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#F8F9FA', borderRadius: 12, marginBottom: 10 },
  closeFacturaBtn: { backgroundColor: '#333', width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 }
});