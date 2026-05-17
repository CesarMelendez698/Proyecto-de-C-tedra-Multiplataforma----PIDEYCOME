import React, { useContext, useMemo, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Alert,
  SafeAreaView,
  Platform,
  Modal,
  ActivityIndicator
} from 'react-native';
import { AppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { doc, updateDoc, collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';

export default function CocinaScreen() {
  const { ordenes, usuario, setUsuario } = useContext(AppContext);
  
  // --- ESTADOS DE NOTIFICACIONES ---
  const [notificaciones, setNotificaciones] = useState([]);
  const [notisVisibles, setNotisVisibles] = useState(false);
  const [notiFlotante, setNotiFlotante] = useState(null);

  // --- 1. LISTENER DE NUEVAS ÓRDENES (TIEMPO REAL) ---
  useEffect(() => {
    // Escuchamos órdenes con estado 'Ordenada' creadas recientemente
    const q = query(
      collection(db, "ordenes"), 
      where("estado", "==", "Ordenada")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        // Solo notificamos si es una orden NUEVA (added)
        if (change.type === "added") {
          const data = change.doc.data();
          const id = change.doc.id;

          setNotificaciones(prev => {
            if (!prev.find(n => n.id === id)) {
              const nuevaNoti = { id, mesa: data.mesa, cliente: data.cliente };
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

  // --- FILTRADO: Ordenar por fecha para que las más viejas aparezcan primero ---
  const ordenesActivas = useMemo(() => {
    return ordenes
      .filter(o => ['Ordenada', 'Recibida', 'Preparando'].includes(o.estado))
      .sort((a, b) => new Date(a.fechaCreacion) - new Date(b.fechaCreacion));
  }, [ordenes]);

  const cambiarEstado = async (id, estadoActual) => {
    let proximoEstado = '';
    if (estadoActual === 'Ordenada') proximoEstado = 'Recibida';
    else if (estadoActual === 'Recibida') proximoEstado = 'Preparando';
    else if (estadoActual === 'Preparando') proximoEstado = 'Despachada';

    if (proximoEstado) {
      try {
        const ordenRef = doc(db, "ordenes", id);
        await updateDoc(ordenRef, { 
          estado: proximoEstado,
          ultimaActualizacion: new Date().toISOString() 
        });
        leerNotificacion(id);
      } catch (error) {
        Alert.alert("Error", "No se pudo actualizar el estado.");
      }
    }
  };

  const handleLogout = () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro de salir de cocina?", [
      { text: "No" },
      { text: "Sí", onPress: () => setUsuario(null) }
    ]);
  };

  const renderOrden = ({ item }) => {
    let config = { label: 'NUEVA', color: '#FFB300', btnText: 'RECIBIR', icon: 'hand-left-outline' };
    if (item.estado === 'Recibida') config = { label: 'EN COLA', color: '#2196F3', btnText: 'COCINAR', icon: 'flame-outline' };
    else if (item.estado === 'Preparando') config = { label: 'COCCIÓN', color: '#FF6F00', btnText: 'LISTO', icon: 'checkmark-done-outline' };

    return (
      <View style={[styles.card, { borderLeftColor: config.color }]}>
        <View style={styles.cardHeader}>
          <View style={{flex: 1}}>
            <Text style={styles.mesaText}>{item.mesa.toUpperCase()}</Text>
            <Text style={styles.meseroText}>Mesero: {item.nombreMesero}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
            <Text style={styles.statusBadgeText}>{config.label}</Text>
          </View>
        </View>

        <View style={styles.clienteRow}>
          <Ionicons name="person-circle-outline" size={18} color="#666" />
          <Text style={styles.clienteText}> {item.cliente}</Text>
        </View>

        <View style={styles.divider} />

        {item.productos.map((prod, index) => (
          <View key={index} style={styles.productRow}>
            <View style={styles.qtyBadge}><Text style={styles.qtyText}>{prod.cantidad}</Text></View>
            <Text style={styles.productName}>{prod.nombre}</Text>
          </View>
        ))}

        <TouchableOpacity 
          style={[styles.btnAccion, { backgroundColor: config.color }]} 
          onPress={() => cambiarEstado(item.id, item.estado)}
        >
          <Ionicons name={config.icon} size={22} color="white" />
          <Text style={styles.btnAccionText}>{config.btnText}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* NOTIFICACIÓN FLOTANTE */}
      {notiFlotante && (
        <TouchableOpacity 
          style={styles.floatingNoti} 
          onPress={() => { setNotisVisibles(true); setNotiFlotante(null); }}
        >
          <Ionicons name="restaurant" size={24} color="white" />
          <View style={{marginLeft: 12, flex: 1}}>
            <Text style={styles.notiTitle}>¡Nuevo Pedido!</Text>
            <Text style={styles.notiText}>{notiFlotante.mesa} - {notiFlotante.cliente}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      )}

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSubtitle}>Monitor de Pedidos</Text>
          <Text style={styles.headerTitle}>Cocina Central</Text>
        </View>
        
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity style={styles.notiBtn} onPress={() => setNotisVisibles(true)}>
            <Ionicons name="notifications-outline" size={26} color="#1C1C1E" />
            {notificaciones.length > 0 && (
              <View style={styles.notiBadge}>
                <Text style={styles.notiBadgeText}>{notificaciones.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoBar}>
        <Ionicons name="time-outline" size={14} color="#8E8E93" />
        <Text style={styles.infoBarText}> {ordenesActivas.length} ORDENES ACTIVAS</Text>
      </View>

      <FlatList
        data={ordenesActivas}
        keyExtractor={(item) => item.id}
        renderItem={renderOrden}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cafe-outline" size={80} color="#DDD" />
            <Text style={styles.emptyText}>Monitor vacío por ahora</Text>
          </View>
        }
      />

      {/* MODAL NOTIFICACIONES */}
      <Modal visible={notisVisibles} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.notiContent}>
            <Text style={styles.modalTitle}>Bandeja de Entrada</Text>
            <View style={styles.divider} />
            {notificaciones.length === 0 ? (
              <Text style={{textAlign: 'center', color: '#999', marginVertical: 30}}>No hay avisos nuevos</Text>
            ) : (
              <FlatList
                data={notificaciones}
                keyExtractor={item => item.id}
                renderItem={({item}) => (
                  <TouchableOpacity style={styles.notiItem} onPress={() => leerNotificacion(item.id)}>
                    <View style={styles.notiDot} />
                    <View style={{flex: 1}}>
                      <Text style={{fontWeight: 'bold', fontSize: 15}}>{item.mesa}</Text>
                      <Text style={{fontSize: 13, color: '#666'}}>Cliente: {item.cliente}</Text>
                    </View>
                    <Ionicons name="checkmark-circle-outline" size={24} color="#4CAF50" />
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setNotisVisibles(false)}>
              <Text style={{color: 'white', fontWeight: 'bold'}}>VOLVER AL MONITOR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 20 : 40, 
    paddingBottom: 20, 
    paddingHorizontal: 25, 
    backgroundColor: 'white', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30, 
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1E' },
  headerSubtitle: { fontSize: 11, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  logoutBtn: { padding: 10, backgroundColor: '#FFF1F0', borderRadius: 12, marginLeft: 10 },
  notiBtn: { padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12, position: 'relative' },
  notiBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#FF3B30', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  notiBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  floatingNoti: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 50, left: 20, right: 20, backgroundColor: '#1C1C1E', padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', zIndex: 1000, elevation: 15, shadowColor: '#000', shadowOpacity: 0.3 },
  notiTitle: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  notiText: { color: '#AAA', fontSize: 13, marginTop: 2 },

  infoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 5 },
  infoBarText: { fontSize: 11, fontWeight: 'bold', color: '#8E8E93', letterSpacing: 1.5 },

  listContent: { padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 25, padding: 20, marginBottom: 20, elevation: 4, borderLeftWidth: 10, shadowColor: '#000', shadowOpacity: 0.05 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  mesaText: { fontSize: 22, fontWeight: '900', color: '#1C1C1E' },
  meseroText: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusBadgeText: { color: 'white', fontSize: 11, fontWeight: '900' },
  clienteRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 8, borderRadius: 10, marginTop: 5 },
  clienteText: { fontSize: 14, color: '#3A3A3C', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F2F2F7', marginVertical: 15 },
  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  qtyBadge: { backgroundColor: '#1C1C1E', width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  qtyText: { fontWeight: 'bold', fontSize: 14, color: 'white' },
  productName: { fontSize: 17, color: '#1C1C1E', fontWeight: '600' },
  btnAccion: { flexDirection: 'row', marginTop: 15, padding: 18, borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  btnAccionText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 15, letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  notiContent: { backgroundColor: 'white', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, height: '70%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#1C1C1E' },
  notiItem: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#F8F9FA', borderRadius: 20, marginBottom: 12 },
  notiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFB300', marginRight: 15 },
  closeBtn: { backgroundColor: '#1C1C1E', width: '100%', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#8E8E93', marginTop: 15, fontSize: 16, fontWeight: '600' }
});