import React, { useState, useContext, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Dimensions, Platform, Modal } from 'react-native';
import { AppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import FormularioProducto from '../components/FormularioProducto';
import RegistroEmpleado from '../components/RegistroEmpleado';
import { db } from '../firebaseConfig';
import { doc, deleteDoc } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BarChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

export default function AdminScreen() {
  // Extraemos 'usuario' del contexto para saber quién está operando la app
  const { usuario, setUsuario, productos, usuariosGlobales, ordenes } = useContext(AppContext); 
  const [seccion, setSeccion] = useState('menu');
  const [modalProducto, setModalProducto] = useState(false);
  const [verRegistroUser, setVerRegistroUser] = useState(false);
  const [itemParaEditar, setItemParaEditar] = useState(null);
  const [usuarioParaEditar, setUsuarioParaEditar] = useState(null);

  // --- ESTADOS REPORTES ---
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toLocaleDateString('en-CA'));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);

  const categorias = ["entradas", "plato fuerte", "bebidas", "postres"];

  // --- LÓGICA DE REPORTES FILTRADOS ---
  const stats = useMemo(() => {
    const filtradas = ordenes.filter(o => o.estado === 'Pagada' && o.fechaFiltro === fechaFiltro);
    const totalDinero = filtradas.reduce((acc, o) => acc + parseFloat(o.total || 0), 0);
    return {
      monto: totalDinero.toFixed(2),
      cantidad: filtradas.length,
      lista: filtradas
    };
  }, [ordenes, fechaFiltro]);

  // --- DATOS PARA LA GRÁFICA (Últimos 7 días) ---
  const chartData = useMemo(() => {
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push(d.toLocaleDateString('en-CA'));
    }
    const valores = dias.map(d => {
      return ordenes
        .filter(o => o.estado === 'Pagada' && o.fechaFiltro === d)
        .reduce((acc, o) => acc + parseFloat(o.total || 0), 0);
    });
    return {
      labels: dias.map(d => d.split('-').slice(1).reverse().join('/')), // MM/DD
      datasets: [{ data: valores }]
    };
  }, [ordenes]);

  const handleLogout = () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro de salir del sistema?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar Sesión", style: "destructive", onPress: () => setUsuario(null) }
    ]);
  };

  // --- ELIMINACIÓN DE PRODUCTOS O EMPLEADOS ---
  const eliminarItem = (id, coleccion, nombre) => {
    const esUsuario = coleccion === 'usuarios';

    // Validación estricta de seguridad: El administrador activo en la sesión no puede borrarse a sí mismo
    if (esUsuario && id === usuario?.id) {
      Alert.alert("Acción no permitida", "No puedes eliminar tu propia cuenta de administrador mientras estás en sesión.");
      return;
    }

    Alert.alert(
      "Confirmar Eliminación",
      `¿Estás seguro de que deseas eliminar a "${nombre}"? \n\nEsta acción no se puede deshacer y el acceso al sistema será revocado de inmediato.`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Eliminar", 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, coleccion, id));
              Alert.alert("Éxito", `${esUsuario ? 'Empleado/Admin' : 'Producto'} eliminado correctamente.`);
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "No se pudo completar la operación. Revisa tu conexión.");
            }
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Bienvenido,</Text>
          <Text style={styles.headerTitle}>{usuario?.nombre || 'Administrador'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* TABS PRINCIPALES */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, seccion === 'menu' && styles.tabActive]} onPress={() => { setSeccion('menu'); setVerRegistroUser(false); }}>
          <Ionicons name={seccion === 'menu' ? "fast-food" : "fast-food-outline"} size={22} color={seccion === 'menu' ? '#FF6F00' : '#8E8E93'} />
          <Text style={[styles.tabText, seccion === 'menu' && styles.tabTextActive]}>Menú</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tab, seccion === 'usuarios' && styles.tabActive]} onPress={() => setSeccion('usuarios')}>
          <Ionicons name={seccion === 'usuarios' ? "people" : "people-outline"} size={22} color={seccion === 'usuarios' ? '#FF6F00' : '#8E8E93'} />
          <Text style={[styles.tabText, seccion === 'usuarios' && styles.tabTextActive]}>Personal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tab, seccion === 'reportes' && styles.tabActive]} onPress={() => { setSeccion('reportes'); setVerRegistroUser(false); }}>
          <Ionicons name={seccion === 'reportes' ? "stats-chart" : "stats-chart-outline"} size={22} color={seccion === 'reportes' ? '#FF6F00' : '#8E8E93'} />
          <Text style={[styles.tabText, seccion === 'reportes' && styles.tabTextActive]}>Reportes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* SECCIÓN MENÚ */}
        {seccion === 'menu' && (
          <View style={styles.seccionContainer}>
            <TouchableOpacity style={styles.btnAdd} onPress={() => { setItemParaEditar(null); setModalProducto(true); }}>
              <Ionicons name="add-circle" size={22} color="white" />
              <Text style={styles.btnAddText}> Añadir Nuevo Producto</Text>
            </TouchableOpacity>

            {productos.length === 0 && <Text style={styles.emptyText}>No hay productos registrados.</Text>}

            {categorias.map((cat) => {
              const productosFiltrados = productos.filter(p => p.categoria.toLowerCase() === cat);
              if (productosFiltrados.length === 0) return null;

              return (
                <View key={cat} style={{marginBottom: 20}}>
                  <Text style={[styles.sectionTitle, {color: '#FF6F00'}]}>{cat.toUpperCase()}</Text>
                  {productosFiltrados.map((prod) => (
                    <View key={prod.id} style={styles.cardItem}>
                      <View style={styles.cardLeft}><Text style={styles.itemName}>{prod.nombre}</Text><Text style={styles.itemPrice}>${parseFloat(prod.precio).toFixed(2)}</Text></View>
                      <View style={styles.itemActions}>
                        <TouchableOpacity onPress={() => { setItemParaEditar(prod); setModalProducto(true); }} style={styles.actionBtn}><Ionicons name="pencil" size={20} color="#007AFF" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => eliminarItem(prod.id, 'productos', prod.nombre)} style={[styles.actionBtn, {backgroundColor: '#FFF1F0'}]}><Ionicons name="trash" size={20} color="#FF3B30" /></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* SECCIÓN PERSONAL */}
        {seccion === 'usuarios' && (
          <View style={styles.seccionContainer}>
            {!verRegistroUser ? (
              <>
                <TouchableOpacity style={[styles.btnAdd, {backgroundColor: '#007AFF'}]} onPress={() => { setUsuarioParaEditar(null); setVerRegistroUser(true); }}>
                  <Ionicons name="person-add" size={22} color="white" /><Text style={styles.btnAddText}> Registrar Nuevo Miembro</Text>
                </TouchableOpacity>
                
                <Text style={styles.sectionTitle}>Personal y Administradores</Text>
                {usuariosGlobales.length === 0 && <Text style={styles.emptyText}>No hay personal registrado.</Text>}
                
                {usuariosGlobales?.map((user) => (
                  <View key={user.id} style={styles.cardItem}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.itemName}>{user.nombre} {user.id === usuario?.id && "(Tú)"}</Text>
                      <View style={[styles.roleBadge, {backgroundColor: user.rol?.toLowerCase().includes('admin') ? '#E8F5E9' : '#FFF3E0'}]}>
                        <Text style={[styles.roleText, {color: user.rol?.toLowerCase().includes('admin') ? '#2E7D32' : '#E65100'}]}>{user.rol?.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.itemActions}>
                        <TouchableOpacity onPress={() => { setUsuarioParaEditar(user); setVerRegistroUser(true); }} style={styles.actionBtn}><Ionicons name="create-outline" size={22} color="#007AFF" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => eliminarItem(user.id, 'usuarios', user.nombre)} style={[styles.actionBtn, {backgroundColor: '#FFF1F0', marginLeft: 10}]}><Ionicons name="trash-outline" size={22} color="#FF3B30" /></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            ) : <RegistroEmpleado itemParaEditar={usuarioParaEditar} onFinalizar={() => { setVerRegistroUser(false); setUsuarioParaEditar(null); }} />}
          </View>
        )}

        {/* SECCIÓN REPORTES */}
        {seccion === 'reportes' && (
          <View style={styles.seccionContainer}>
            <Text style={styles.sectionTitle}>Análisis de Ventas</Text>
            
            {/* Filtro de Calendario */}
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar" size={20} color="#FF6F00" />
              <Text style={styles.dateSelectorText}>Fecha: {fechaFiltro}</Text>
              <Ionicons name="chevron-down" size={20} color="#8E8E93" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={new Date(fechaFiltro + 'T12:00:00')}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setFechaFiltro(date.toLocaleDateString('en-CA'));
                }}
              />
            )}

            {/* Card de Resumen */}
            <View style={styles.cardReporte}>
              <View style={styles.reportRow}>
                <View style={styles.reportCircle}><Ionicons name="wallet" size={30} color="#4CAF50" /></View>
                <View>
                  <Text style={styles.reportLabel}>Total Recaudado</Text>
                  <Text style={styles.reportValue}>${stats.monto}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={styles.reporteSub}><Ionicons name="checkmark-circle" size={14} color="#4CAF50" /> {stats.cantidad} facturas el {fechaFiltro}</Text>
            </View>

            {/* Gráfica */}
            <Text style={[styles.sectionTitle, {marginTop: 25}]}>Tendencia Semanal</Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={chartData}
                width={screenWidth - 40}
                height={220}
                yAxisLabel="$"
                fromZero
                chartConfig={{
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  color: (opacity = 1) => `rgba(255, 111, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `#8E8E93`,
                  barPercentage: 0.5,
                }}
                style={{ borderRadius: 16 }}
              />
            </View>

            {/* Listado de Facturas */}
            <Text style={[styles.sectionTitle, {marginTop: 25}]}>Detalle de Órdenes</Text>
            {stats.lista.length === 0 ? (
              <Text style={styles.emptyText}>No hay ventas registradas este día.</Text>
            ) : (
              stats.lista.map((item) => (
                <TouchableOpacity key={item.id} style={styles.cardItem} onPress={() => setOrdenSeleccionada(item)}>
                  <View>
                    <Text style={styles.itemName}>Mesa #{item.mesa}</Text>
                    <Text style={styles.reportLabel}>{item.hora || 'S/H'}</Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={styles.itemPrice}>${parseFloat(item.total).toFixed(2)}</Text>
                    <Text style={{color: '#007AFF', fontSize: 12, fontWeight: 'bold'}}>Ver Factura</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL HISTORIAL / DETALLE FACTURA (ESTILO EXACTO DE CAJERO) */}
      <Modal visible={!!ordenSeleccionada} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.facturaContent}>
            <View style={{alignItems:'center', marginBottom: 15}}>
              <Ionicons name="restaurant" size={30} color="#FF6F00" />
              <Text style={{fontWeight:'900', fontSize: 20, color: '#333'}}>PIDEYCOME</Text>
              <Text style={{fontSize: 10, color:'#888', letterSpacing: 1}}>REPORTE DE VENTA</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.historyInfoText}>Cliente: <Text style={{fontWeight:'bold', color: '#1C1C1E'}}>{ordenSeleccionada?.cliente}</Text></Text>
              <Text style={styles.historyInfoText}>Mesa: {ordenSeleccionada?.mesa}</Text>
              <Text style={styles.historyInfoText}>Mesero: {ordenSeleccionada?.nombreMesero || 'No asignado'}</Text>
              <Text style={styles.historyInfoText}>Fecha: {ordenSeleccionada?.fechaFiltro} {ordenSeleccionada?.hora || ''}</Text>
              <Text style={styles.historyInfoText}>Pago: {ordenSeleccionada?.metodoPago || 'Efectivo'}</Text>
              
              <View style={styles.facturaDivider} />
              
              {ordenSeleccionada?.productos?.map((p, i) => (
                <View key={i} style={styles.facturaRow}>
                  <Text style={styles.facturaItem}>{p.cantidad}x {p.nombre}</Text>
                  <Text style={{fontWeight:'bold', color: '#1C1C1E'}}>${(p.cantidad * p.precio).toFixed(2)}</Text>
                </View>
              ))}
              
              <View style={styles.facturaDivider} />
              
              <View style={styles.facturaRow}>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: '#1C1C1E'}}>TOTAL</Text>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: '#FF6F00'}}>${parseFloat(ordenSeleccionada?.total || 0).toFixed(2)}</Text>
              </View>
            </ScrollView>
            
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setOrdenSeleccionada(null)}>
              <Text style={{color:'white', fontWeight:'bold', textAlign: 'center'}}>CERRAR FACTURA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FormularioProducto visible={modalProducto} itemEditando={itemParaEditar} onClose={() => { setModalProducto(false); setItemParaEditar(null); }} />
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 25, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1C1C1E' },
    headerSubtitle: { fontSize: 14, color: '#8E8E93' },
    logoutBtn: { padding: 10, backgroundColor: '#FFF1F0', borderRadius: 12 },
    tabBar: { flexDirection: 'row', backgroundColor: 'white', marginTop: 15, marginHorizontal: 20, borderRadius: 15, padding: 5, elevation: 2 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    tabActive: { backgroundColor: '#FFF5EE' },
    tabText: { fontSize: 11, color: '#8E8E93', marginTop: 4, fontWeight: '500' },
    tabTextActive: { color: '#FF6F00', fontWeight: 'bold' },
    content: { flex: 1, padding: 20 },
    seccionContainer: { marginBottom: 20 },
    sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 15, color: '#3A3A3C', paddingLeft: 5 },
    btnAdd: { backgroundColor: '#FF6F00', padding: 16, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 25, elevation: 3 },
    btnAddText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    cardItem: { backgroundColor: 'white', padding: 18, borderRadius: 18, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
    cardLeft: { flex: 1 },
    itemName: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
    itemPrice: { fontSize: 15, color: '#FF6F00', fontWeight: 'bold', marginTop: 2 },
    roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
    roleText: { fontSize: 11, fontWeight: 'bold' },
    itemActions: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: { padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12, marginLeft: 8 },
    cardReporte: { backgroundColor: 'white', padding: 25, borderRadius: 22, elevation: 4, borderLeftWidth: 6, borderLeftColor: '#4CAF50' },
    reportRow: { flexDirection: 'row', alignItems: 'center' },
    reportCircle: { width: 55, height: 55, borderRadius: 28, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    reportLabel: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
    reportValue: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
    divider: { height: 1, backgroundColor: '#F2F2F7', marginVertical: 15 },
    reporteSub: { fontSize: 13, color: '#666', fontWeight: '500' },
    emptyText: { textAlign: 'center', color: '#8E8E93', marginVertical: 20, fontStyle: 'italic' },
    
    // ESTILOS DE COMPONENTES INTERNOS (REPORTES Y MODAL IDENTICOS A CAJA)
    dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 20, justifyContent: 'space-between' },
    dateSelectorText: { fontSize: 16, fontWeight: '600', color: '#3A3A3C' },
    chartContainer: { backgroundColor: 'white', borderRadius: 20, padding: 10, alignItems: 'center', elevation: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    facturaContent: { backgroundColor: 'white', borderRadius: 25, padding: 25, width: '100%', elevation: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12 },
    facturaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
    facturaItem: { fontSize: 15, color: '#3A3A3C', flex: 1, marginRight: 10 },
    facturaDivider: { height: 1, dashed: true, borderColor: '#E1E4E8', borderWidth: 1, borderStyle: 'dashed', marginVertical: 15 },
    historyInfoText: { fontSize: 14, color: '#555', marginBottom: 6 },
    confirmBtn: { backgroundColor: '#FF6F00', padding: 16, borderRadius: 12, marginTop: 20, width: '100%', elevation: 2 }
});