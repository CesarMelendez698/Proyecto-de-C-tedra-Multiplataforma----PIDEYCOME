import React, { createContext, useState, useEffect } from 'react';
import { db } from '../firebaseConfig'; 
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null); // Usuario logueado
  const [productos, setProductos] = useState([]); // Lista de platillos/bebidas
  const [ordenes, setOrdenes] = useState([]); // Comandas para cocina/mesero/caja
  const [usuariosGlobales, setUsuariosGlobales] = useState([]); // Lista de empleados (para el Admin)
  const [cargando, setCargando] = useState(true);

  // 1. ESCUCHAR PRODUCTOS EN TIEMPO REAL
  useEffect(() => {
    const q = query(collection(db, "productos"), orderBy("nombre", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setProductos(lista);
    }, (error) => console.error("Error productos:", error));
    
    return () => unsubscribe();
  }, []);

  // 2. ESCUCHAR USUARIOS (PERSONAL) EN TIEMPO REAL
  useEffect(() => {
    const q = query(collection(db, "usuarios"), orderBy("nombre", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setUsuariosGlobales(lista);
    }, (error) => console.error("Error usuarios:", error));

    return () => unsubscribe();
  }, []);

  // 3. ESCUCHAR ÓRDENES EN TIEMPO REAL
  useEffect(() => {
    const q = query(collection(db, "ordenes"), orderBy("fechaCreacion", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setOrdenes(lista);
      setCargando(false);
    }, (error) => {
      console.error("Error ordenes:", error);
      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Función unificada para crear órdenes desde MeseroScreen
   * Incluye la corrección de fecha para los reportes de Caja y Admin
   */
  const crearOrden = async (nuevaOrden) => {
    try {
      const ahora = new Date();
      // Formato YYYY-MM-DD local para filtrado preciso en reportes
      const fechaLocalFiltro = ahora.toLocaleDateString('en-CA'); 

      await addDoc(collection(db, "ordenes"), {
        ...nuevaOrden,
        fechaCreacion: ahora.toISOString(), // ISO para ordenamiento
        fechaFiltro: fechaLocalFiltro, // Para búsqueda en historial y ventas del día
        timestamp: serverTimestamp(), // Marca de tiempo del servidor
        idMesero: usuario?.id || 'anonimo',
        nombreMesero: usuario?.nombre || 'Mesero',
        estado: nuevaOrden.estado || 'Ordenada'
      });
      return true;
    } catch (error) {
      console.error("Error al enviar a Firebase:", error);
      throw error;
    }
  };

  return (
    <AppContext.Provider
      value={{
        usuario,
        setUsuario,
        productos,
        ordenes,
        setOrdenes,
        usuariosGlobales,
        crearOrden,
        cargando
      }}
    >
      {children}
    </AppContext.Provider>
  );
};