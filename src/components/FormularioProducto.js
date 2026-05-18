import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { db } from '../firebaseConfig'; 
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore'; 

export default function FormularioProducto({ visible, onClose, itemEditando }) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [categoria, setCategoria] = useState('plato fuerte'); // Valor inicial
  const [loading, setLoading] = useState(false);

  // Opciones fijas para evitar errores de escritura
  const categoriasMenu = ["entradas", "plato fuerte", "bebidas", "postres"];

  useEffect(() => {
    if (itemEditando) {
      setNombre(itemEditando.nombre);
      setPrecio(itemEditando.precio.toString());
      setCategoria(itemEditando.categoria.toLowerCase());
    } else {
      setNombre('');
      setPrecio('');
      setCategoria('plato fuerte');
    }
  }, [itemEditando, visible]);

  const guardarProducto = async () => {
    if (!nombre.trim() || !precio.trim()) {
      Alert.alert("Error", "El nombre y el precio son obligatorios");
      return;
    }

    setLoading(true);
    try {
      const datosProducto = {
        nombre: nombre.trim(),
        precio: parseFloat(precio),
        categoria: categoria, // Ya viene limpio del selector
        disponible: true,
        ultimaModificacion: new Date()
      };

      if (itemEditando) {
        const productoRef = doc(db, "productos", itemEditando.id);
        await updateDoc(productoRef, datosProducto);
        Alert.alert("Éxito", "Producto actualizado");
      } else {
        await addDoc(collection(db, "productos"), {
          ...datosProducto,
          fechaCreacion: new Date()
        });
        Alert.alert("Éxito", "Producto guardado");
      }

      onClose();
    } catch (error) {
      Alert.alert("Error", "No se pudo conectar con la base de datos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            {itemEditando ? "Editar Producto" : "Nuevo Producto"}
          </Text>
          
          <Text style={styles.label}>Nombre del platillo</Text>
          <TextInput 
            placeholder="Ej: Nachos con queso" 
            style={styles.input} 
            value={nombre} 
            onChangeText={setNombre} 
          />

          <Text style={styles.label}>Precio ($)</Text>
          <TextInput 
            placeholder="0.00" 
            style={styles.input} 
            keyboardType="numeric" 
            value={precio} 
            onChangeText={setPrecio} 
          />

          <Text style={styles.label}>Seleccionar Categoría</Text>
          <View style={styles.catContainer}>
            {categoriasMenu.map((cat) => (
              <TouchableOpacity 
                key={cat} 
                onPress={() => setCategoria(cat)}
                style={[
                  styles.catBtn, 
                  categoria === cat && styles.catBtnActive
                ]}
              >
                <Text style={[
                  styles.catText, 
                  categoria === cat && styles.catTextActive
                ]}>
                  {cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.buttons}>
            <TouchableOpacity onPress={onClose} style={styles.btnSec} disabled={loading}>
              <Text style={{color: '#666'}}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={guardarProducto} 
              style={[styles.btnPrim, loading && {backgroundColor: '#CCC'}]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.textBtn}>
                  {itemEditando ? "Actualizar" : "Guardar"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '85%', backgroundColor: 'white', padding: 25, borderRadius: 20, elevation: 10 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#333', textAlign: 'center' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#888', marginBottom: 8, marginLeft: 2 },
  input: { backgroundColor: '#F5F5F5', padding: 14, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' },
  catContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  catBtn: { width: '48%', paddingVertical: 10, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  catBtnActive: { backgroundColor: '#FF6F00', borderColor: '#FF6F00' },
  catText: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  catTextActive: { color: 'white' },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnPrim: { backgroundColor: '#FF6F00', padding: 15, borderRadius: 12, width: '48%', alignItems: 'center', elevation: 2 },
  btnSec: { padding: 15, width: '48%', alignItems: 'center' },
  textBtn: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
