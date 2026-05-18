import React, { useState, useContext, useMemo, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, StyleSheet, 
  Modal, Alert, SafeAreaView, ScrollView, Platform, ActivityIndicator, TextInput 
} from 'react-native';
import { AppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { doc, updateDoc, collection, onSnapshot, query, where } from 'firebase/firestore';

export default function CajaScreen() {
  const { ordenes, usuario, setUsuario } = useContext(AppContext);
  
  // --- ESTADOS DE CONTROL ---
  const [modalVisible, setModalVisible] = useState(false);
  const [modalFacturaVisible, setModalFacturaVisible] = useState(false);
  const [modalCalendarioVisible, setModalCalendarioVisible] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [metodoPago, setMetodoPago] = useState('Tarjeta');
  const [tipoFiltro, setTipoFiltro] = useState('Comer Aquí');

  const [notificaciones, setNotificaciones] = useState([]);
  const [notisVisibles, setNotisVisibles] = useState(false);
  const [notiFlotante, setNotiFlotante] = useState(null);

  const [procesandoPago, setProcesandoPago] = useState(false);
  const [pagoCompletado, setPagoCompletado] = useState(false);

  // --- FILTROS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [mesActual, setMesActual] = useState(new Date());

  // 1. LISTENER DE NOTIFICACIONES (TIEMPO REAL)
  useEffect(() => {
    const qNotis = query(collection(db, "ordenes"), where("estado", "==", "En Caja"));
    const unsubscribe = onSnapshot(qNotis, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const id = change.doc.id;
          setNotificaciones(prev => {
            if (!prev.find(n => n.id === id)) {
              const nuevaNoti = { id, mesa: data.mesa, cliente: data.cliente, total: data.total };
              setNotiFlotante(nuevaNoti);
              setTimeout(() => setNotiFlotante(null), 6000);
              return [nuevaNoti, ...prev];
            }
            return prev;
          });
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const leerNotificacion = (id) => {
    setNotificaciones(prev => prev.filter(n => n.id !== id));
    if (notiFlotante?.id === id) setNotiFlotante(null);
  };

  const verFacturaHistorial = (orden) => {
    setOrdenSeleccionada(orden);
    setModalFacturaVisible(true);
  };

  // 2. LÓGICA DE NEGOCIO
  const ventasDelDia = useMemo(() => {
    const hoy = new Date().toLocaleDateString('en-CA');
    return ordenes.filter(o => o.estado === 'Pagada' && o.fechaFiltro === hoy)
                  .reduce((acc, o) => acc + parseFloat(o.total || 0), 0).toFixed(2);
  }, [ordenes]);

  const ordenesFiltradas = useMemo(() => 
    ordenes.filter(o => o.estado === 'En Caja' && 
      (tipoFiltro === 'Comer Aquí' ? o.mesa !== 'Para Llevar' : o.mesa === 'Para Llevar')
    ), [ordenes, tipoFiltro]);

  const historialFiltrado = useMemo(() => {
    let base = ordenes.filter(o => o.estado === 'Pagada');
    if (busqueda) {
      const term = busqueda.toLowerCase();
      base = base.filter(o => o.cliente.toLowerCase().includes(term) || o.nombreMesero?.toLowerCase().includes(term) || o.mesa.toLowerCase().includes(term));
    }
    if (filtroFecha) base = base.filter(o => o.fechaFiltro === filtroFecha);
    return base.sort((a, b) => new Date(b.fechaPago) - new Date(a.fechaPago));
  }, [ordenes, busqueda, filtroFecha]);

  // 3. CALENDARIO
  const diasCalendario = useMemo(() => {
    const year = mesActual.getFullYear();
    const month = mesActual.getMonth();
    const primerDia = new Date(year, month, 1).getDay();
    const totalDias = new Date(year, month + 1, 0).getDate();
    let dias = [];
    const offset = primerDia === 0 ? 6 : primerDia - 1;
    for (let i = 0; i < offset; i++) dias.push(null);
    for (let i = 1; i <= totalDias; i++) dias.push(i);
    return dias;
  }, [mesActual]);

  const cambiarMes = (valor) => {
    setMesActual(new Date(mesActual.setMonth(mesActual.getMonth() + valor)));
  };

  // 4. ACCIÓN DE PAGO
  const ejecutarCobroFinal = async () => {
    setProcesandoPago(true);
    setTimeout(async () => {
      try {
        const ahora = new Date();
        const fFiltro = ahora.toLocaleDateString('en-CA');
        const fISO = ahora.toISOString();

        await updateDoc(doc(db, "ordenes", ordenSeleccionada.id), { 
          estado: 'Pagada',
          metodoPago: metodoPago,
          fechaPago: fISO,
          fechaFiltro: fFiltro,
          responsableFinal: usuario?.nombre || 'Anderson'
        });

        if (ordenSeleccionada.idMesa) await updateDoc(doc(db, "mesas", ordenSeleccionada.idMesa), { estado: 'libre' });

        leerNotificacion(ordenSeleccionada.id);
        setProcesandoPago(false);
        setPagoCompletado(true);
      } catch (error) {
        setProcesandoPago(false);
        Alert.alert("Error", "No se pudo completar el cobro.");
      }
    }, 2000);
  };

  const cerrarModalYLimpiar = () => {
    setModalVisible(false);
    setPagoCompletado(false);
    setOrdenSeleccionada(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* NOTIFICACIÓN FLOTANTE (IGUAL A MESERO) */}
      {notiFlotante && (
        <TouchableOpacity 
          style={styles.floatingNoti} 
          onPress={() => { setNotiFlotante(null); setNotisVisibles(true); }}
        >
          <Ionicons name="notifications" size={24} color="white" />
          <View style={{marginLeft: 10, flex: 1}}>
            <Text style={styles.notiTitle}>¡Nuevo Cobro!</Text>
            <Text style={styles.notiText}>{notiFlotante.mesa} - {notiFlotante.cliente} (${notiFlotante.total})</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="white" />
        </TouchableOpacity>
      )}

      {/* HEADER AJUSTADO */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSubtitle}>Caja Registradora</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{usuario?.nombre || 'Anderson'}</Text>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* RESUMEN */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#4CAF50' }]}><Text style={styles.statLabel}>VENTAS HOY</Text><Text style={[styles.statValue, { color: '#4CAF50' }]}>${ventasDelDia}</Text></View>
          <View style={[styles.statCard, { borderLeftColor: '#FF6F00' }]}><Text style={styles.statLabel}>PENDIENTES</Text><Text style={[styles.statValue, { color: '#FF6F00' }]}>{ordenesFiltradas.length}</Text></View>
        </View>

        {/* TABS */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tab, tipoFiltro === 'Comer Aquí' && styles.tabActive]} onPress={() => setTipoFiltro('Comer Aquí')}><Text style={[styles.tabText, tipoFiltro === 'Comer Aquí' && styles.tabTextActive]}>En Mesas</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tipoFiltro === 'Llevar' && styles.tabActive]} onPress={() => setTipoFiltro('Llevar')}><Text style={[styles.tabText, tipoFiltro === 'Llevar' && styles.tabTextActive]}>Para Llevar</Text></TouchableOpacity>
        </View>

        {/* ÓRDENES POR COBRAR */}
        {ordenesFiltradas.map(item => (
          <View key={item.id} style={styles.cardItem}>
            <View style={{flex:1}}><Text style={styles.mesaBadgeText}>{item.mesa.toUpperCase()}</Text><Text style={styles.itemName}>{item.cliente}</Text></View>
            <TouchableOpacity style={styles.payBtn} onPress={() => { setOrdenSeleccionada(item); setPagoCompletado(false); setModalVisible(true); }}>
              <Text style={styles.payBtnText}>Cobrar ${item.total}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>HISTORIAL DE VENTAS</Text>
        <View style={styles.searchContainer}>
          <TextInput placeholder="Buscar por cliente o mesa..." style={styles.searchInput} value={busqueda} onChangeText={setBusqueda} />
          <TouchableOpacity style={styles.calBtn} onPress={() => setModalCalendarioVisible(true)}>
            <Ionicons name="calendar" size={22} color={filtroFecha ? "#FF3B30" : "#8E8E93"} />
          </TouchableOpacity>
        </View>
        {filtroFecha !== '' && (
          <TouchableOpacity style={styles.chipFecha} onPress={() => setFiltroFecha('')}>
            <Text style={{color: '#FF3B30', fontSize: 12, fontWeight:'bold'}}>Fecha: {filtroFecha}  ✕</Text>
          </TouchableOpacity>
        )}

        {historialFiltrado.map(item => (
          <TouchableOpacity key={item.id} style={styles.historyCard} onPress={() => verFacturaHistorial(item)}>
            <View><Text style={{fontWeight: 'bold', fontSize: 15}}>{item.cliente}</Text><Text style={styles.historySub}>{item.mesa} • {item.fechaFiltro}</Text></View>
            <Text style={styles.historyAmount}>${item.total}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* MODAL COBRO */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.facturaContent}>
            {!pagoCompletado ? (
              <>
                <Text style={styles.modalTitle}>Detalle de Cobro</Text>
                <ScrollView style={{maxHeight: 180}}>{ordenSeleccionada?.productos.map((p, i) => (
                  <View key={i} style={styles.facturaRow}><Text style={styles.facturaItem}>{p.cantidad}x {p.nombre}</Text><Text style={{fontWeight:'bold'}}>${(p.cantidad * p.precio).toFixed(2)}</Text></View>
                ))}</ScrollView>
                <View style={styles.facturaDivider} />
                <View style={styles.facturaRow}><Text style={{fontSize: 18, fontWeight: 'bold'}}>TOTAL</Text><Text style={{fontSize: 18, fontWeight: 'bold', color: '#FF6F00'}}>${ordenSeleccionada?.total}</Text></View>
                {procesandoPago ? <ActivityIndicator size="large" color="#FF6F00" style={{marginTop: 20}} /> : (
                  <>
                    <View style={styles.metodoRow}>
                      <TouchableOpacity style={[styles.metodoBtn, metodoPago === 'Tarjeta' && styles.metodoBtnActive]} onPress={() => setMetodoPago('Tarjeta')}><Text style={{color: metodoPago === 'Tarjeta' ? 'white' : '#333'}}>Tarjeta</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.metodoBtn, metodoPago === 'Efectivo' && styles.metodoBtnActive]} onPress={() => setMetodoPago('Efectivo')}><Text style={{color: metodoPago === 'Efectivo' ? 'white' : '#333'}}>Efectivo</Text></TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.confirmBtn} onPress={ejecutarCobroFinal}><Text style={{color:'white', fontWeight:'bold'}}>REGISTRAR PAGO</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={{marginTop: 15, alignItems: 'center'}}><Text style={{color: '#8E8E93'}}>Cancelar</Text></TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <View style={{alignItems: 'center'}}><Ionicons name="checkmark-done-circle" size={80} color="#4CAF50" /><Text style={styles.modalTitle}>¡Cobro Registrado!</Text><TouchableOpacity style={styles.confirmBtn} onPress={cerrarModalYLimpiar}><Text style={{color:'white'}}>FINALIZAR</Text></TouchableOpacity></View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL HISTORIAL */}
      <Modal visible={modalFacturaVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.facturaContent}>
            <View style={{alignItems:'center', marginBottom: 15}}><Ionicons name="restaurant" size={30} color="#FF6F00" /><Text style={{fontWeight:'900', fontSize: 20}}>PIDEYCOME</Text><Text style={{fontSize: 10, color:'#888'}}>REPORTE DE VENTA</Text></View>
            <ScrollView showsVerticalScrollIndicator={false}>
               <Text style={styles.historyInfoText}>Cliente: <Text style={{fontWeight:'bold'}}>{ordenSeleccionada?.cliente}</Text></Text>
               <Text style={styles.historyInfoText}>Mesa: {ordenSeleccionada?.mesa}</Text>
               <Text style={styles.historyInfoText}>Mesero: {ordenSeleccionada?.nombreMesero}</Text>
               <Text style={styles.historyInfoText}>Fecha: {ordenSeleccionada?.fechaFiltro}</Text>
               <View style={styles.facturaDivider} />
               {ordenSeleccionada?.productos.map((p, i) => (
                  <View key={i} style={styles.facturaRow}><Text style={styles.facturaItem}>{p.cantidad}x {p.nombre}</Text><Text style={{fontWeight:'bold'}}>${(p.cantidad * p.precio).toFixed(2)}</Text></View>
               ))}
               <View style={styles.facturaDivider} />
               <View style={styles.facturaRow}><Text style={{fontWeight:'bold', fontSize: 16}}>TOTAL</Text><Text style={{fontWeight:'bold', fontSize: 16, color:'#FF6F00'}}>${ordenSeleccionada?.total}</Text></View>
               <Text style={{textAlign:'center', marginTop: 15, fontSize: 11, fontStyle:'italic', color:'#AAA'}}>Pagado vía {ordenSeleccionada?.metodoPago}</Text>
            </ScrollView>
            <TouchableOpacity style={[styles.confirmBtn, {backgroundColor:'#333', marginTop: 20}]} onPress={() => setModalFacturaVisible(false)}><Text style={{color:'white'}}>CERRAR</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL CALENDARIO */}
      <Modal visible={modalCalendarioVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => cambiarMes(-1)}><Ionicons name="chevron-back" size={24} color="white" /></TouchableOpacity>
              <Text style={{color:'white', fontWeight:'bold', fontSize: 16}}>{mesActual.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</Text>
              <TouchableOpacity onPress={() => cambiarMes(1)}><Ionicons name="chevron-forward" size={24} color="white" /></TouchableOpacity>
            </View>
            <View style={styles.calendarGrid}>
              {['LU','MA','MI','JU','VI','SA','DO'].map(d => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
              {diasCalendario.map((dia, idx) => {
                const fStr = dia ? `${mesActual.getFullYear()}-${String(mesActual.getMonth() + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}` : null;
                return (
                  <TouchableOpacity key={idx} style={[styles.dayCell, filtroFecha === fStr && {backgroundColor:'#FF3B30', borderRadius: 25}]} disabled={!dia} onPress={() => { setFiltroFecha(fStr); setModalCalendarioVisible(false); }}>
                    <Text style={{color: filtroFecha === fStr ? 'white' : '#333', fontSize: 13}}>{dia}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={{padding: 15, alignItems: 'center'}} onPress={() => setModalCalendarioVisible(false)}><Text style={{color: '#FF3B30', fontWeight: 'bold'}}>CANCELAR</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL NOTIFICACIONES (CAMPANITA) */}
      <Modal visible={notisVisibles} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.facturaContent}>
            <Text style={styles.modalTitle}>Bandeja de Cobros</Text>
            {notificaciones.length === 0 ? <Text style={{textAlign: 'center', color: '#888', marginVertical: 20}}>No hay cuentas nuevas</Text> : (
              <FlatList data={notificaciones} keyExtractor={item => item.id} renderItem={({item}) => (
                <TouchableOpacity style={styles.notiItem} onPress={() => { setOrdenSeleccionada(ordenes.find(o => o.id === item.id)); setModalVisible(true); setNotisVisibles(false); leerNotificacion(item.id); }}>
                  <Ionicons name="cash" size={20} color="#FF6F00" /><View style={{marginLeft: 10, flex: 1}}><Text style={{fontWeight: 'bold'}}>{item.mesa}</Text><Text style={{fontSize: 12}}>{item.cliente} - ${item.total}</Text></View>
                </TouchableOpacity>
              )} />
            )}
            <TouchableOpacity style={[styles.confirmBtn, {backgroundColor:'#333'}]} onPress={() => setNotisVisibles(false)}><Text style={{color:'white'}}>CERRAR</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 70 : 60, 
    paddingBottom: 25, 
    paddingHorizontal: 25, 
    backgroundColor: 'white', 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30, 
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E' },
  headerSubtitle: { fontSize: 12, color: '#8E8E93', marginBottom: 2 },
  logoutBtn: { padding: 10, backgroundColor: '#FFF1F0', borderRadius: 12, marginLeft: 10 },
  notiBtn: { padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12, position: 'relative' },
  notiBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#FF3B30', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  notiBadgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  
  floatingNoti: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 60 : 30, 
    left: 20, 
    right: 20, 
    backgroundColor: '#1C1C1E', 
    padding: 15, 
    borderRadius: 15, 
    flexDirection: 'row', 
    alignItems: 'center', 
    zIndex: 1000, 
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10
  },
  notiTitle: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  notiText: { color: '#CCC', fontSize: 12 },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { backgroundColor: 'white', padding: 15, borderRadius: 18, width: '48%', borderLeftWidth: 5, elevation: 3 },
  statLabel: { fontSize: 10, fontWeight: 'bold', color: '#8E8E93' },
  statValue: { fontSize: 20, fontWeight: '900' },
  tabBar: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 15, padding: 5, marginBottom: 20, elevation: 2 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: '#FFF5EE' },
  tabText: { fontSize: 12, color: '#8E8E93', fontWeight: 'bold' },
  tabTextActive: { color: '#FF6F00' },
  cardItem: { backgroundColor: 'white', padding: 18, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  itemName: { fontSize: 17, fontWeight: 'bold', color: '#1C1C1E' },
  mesaBadgeText: { fontSize: 10, color: '#FF6F00', fontWeight: 'bold', marginBottom: 4 },
  payBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
  payBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#8E8E93', marginTop: 25, marginBottom: 12, letterSpacing: 1 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 15, paddingHorizontal: 12, elevation: 3 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  calBtn: { padding: 8 },
  chipFecha: { backgroundColor: '#FFF5EE', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#FF3B30' },
  historyCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  historySub: { fontSize: 11, color: '#8E8E93' },
  historyAmount: { fontWeight: 'bold', color: '#4CAF50', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 25 },
  facturaContent: { backgroundColor: 'white', borderRadius: 25, padding: 25, elevation: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, color: '#1C1C1E' },
  facturaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  facturaItem: { fontSize: 14, flex: 1, color: '#333' },
  facturaDivider: { height: 1, backgroundColor: '#F2F2F7', marginVertical: 15 },
  metodoRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 15 },
  metodoBtn: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EEE', width: '45%', alignItems: 'center' },
  metodoBtnActive: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  confirmBtn: { backgroundColor: '#FF6F00', padding: 16, borderRadius: 15, alignItems: 'center' },
  historyInfoText: { fontSize: 13, color: '#555', marginBottom: 4 },
  calendarCard: { backgroundColor: 'white', borderRadius: 25, overflow: 'hidden', elevation: 20 },
  calendarHeader: { backgroundColor: '#FF3B30', flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 15, justifyContent: 'center' },
  dayLabel: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#AAA', marginBottom: 10 },
  dayCell: { width: '14.28%', height: 40, justifyContent: 'center', alignItems: 'center' },
  notiItem: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#F8F9FA', borderRadius: 15, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#FF6F00' },
});