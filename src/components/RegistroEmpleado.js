import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { db, auth } from '../firebaseConfig';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export default function RegistroEmpleado({ onFinalizar, itemParaEditar }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('mesero');
  const [loading, setLoading] = useState(false);

  // Lista de roles disponibles incluyendo Administrador
  const rolesDisponibles = ['mesero', 'cocina', 'caja', 'admin'];

  useEffect(() => {
    if (itemParaEditar) {
      setNombre(itemParaEditar.nombre);
      setEmail(itemParaEditar.email);
      setRol(itemParaEditar.rol);
    }
  }, [itemParaEditar]);

  // --- FUNCIÓN PARA GENERAR CONTRASEÑA ALEATORIA ---
  const generarPasswordAleatoria = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
    let resultado = '';
    for (let i = 0; i < 8; i++) {
      resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
  };

  const handleGuardar = async () => {
    if (!nombre.trim() || !email.trim()) {
      Alert.alert("Error", "El nombre y el correo son obligatorios");
      return;
    }

    // --- NUEVA VALIDACIÓN DE FORMATO DE CORREO (REGEX) ---
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(email.trim())) {
      Alert.alert("Formato Inválido", "Por favor ingresa una dirección de correo electrónico válida.");
      return;
    }

    setLoading(true);
    try {
      if (itemParaEditar) {
        // --- EDICIÓN ---
        const userRef = doc(db, "usuarios", itemParaEditar.id);
        await updateDoc(userRef, {
          nombre: nombre.trim(),
          rol: rol.toLowerCase().trim()
        });
        Alert.alert("Éxito", "Perfil actualizado correctamente");
      } else {
        // --- CREACIÓN CON CONTRASEÑA AUTOGENERADA ---
        const passwordTemporal = generarPasswordAleatoria();
        
        // 1. Crear cuenta en Firebase Auth con la clave generada
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          email.toLowerCase().trim(), 
          passwordTemporal
        );
        
        const nuevoUid = userCredential.user.uid;

        // 2. Crear documento de perfil en Firestore
        await setDoc(doc(db, "usuarios", nuevoUid), {
          nombre: nombre.trim(),
          email: email.toLowerCase().trim(),
          rol: rol.toLowerCase().trim(), 
          uid: nuevoUid,
          requiereCambio: true, // Se aplica a TODOS los nuevos registros
          fechaAlta: new Date().toISOString()
        });
        
        // Mostrar la contraseña generada al administrador
        Alert.alert(
          "Usuario Registrado", 
          `Se ha creado la cuenta de ${rol.toUpperCase()}.\n\nContraseña Temporal:\n${passwordTemporal}\n\nPor favor, cópiala y entrégala al empleado. Deberá cambiarla al iniciar sesión.`,
          [{ text: "Entendido", onPress: () => onFinalizar() }]
        );
        return; // Evita que ejecute el onFinalizar duplicado de abajo
      }
      
      onFinalizar(); 
    } catch (e) {
      console.log("Error Firebase:", e.code);
      if (e.code === 'auth/email-already-in-use') {
        Alert.alert("Error", "Este correo electrónico ya está registrado");
      } else if (e.code === 'auth/invalid-email') {
        Alert.alert("Error", "El formato del correo no es aceptado por el servidor.");
      } else {
        Alert.alert("Error", "No se pudo completar la operación: " + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.headerForm}>
        {itemParaEditar ? "Editar Perfil" : "Registrar Nuevo Miembro"}
      </Text>

      <Text style={styles.labelInput}>Nombre Completo</Text>
      <TextInput 
        placeholder="Ej: Cesar Melendez" 
        style={styles.input} 
        value={nombre} 
        onChangeText={setNombre} 
      />

      <Text style={styles.labelInput}>Correo Electrónico</Text>
      <TextInput 
        placeholder="correo@pideycome.com" 
        style={[styles.input, itemParaEditar && styles.inputDisabled]} 
        value={email} 
        onChangeText={setEmail} 
        autoCapitalize="none" 
        keyboardType="email-address"
        editable={!itemParaEditar} 
      />
      
      <Text style={styles.label}>Asignar Rol:</Text>
      <View style={styles.rolesGrid}>
        {rolesDisponibles.map(r => (
          <TouchableOpacity 
            key={r} 
            onPress={() => setRol(r)} 
            style={[styles.rolBtn, rol === r && styles.active]}
          >
            <Text style={[styles.rolText, rol === r && styles.activeText]}>
              {r.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        onPress={handleGuardar} 
        style={[styles.btnMain, itemParaEditar && {backgroundColor: '#2196F3'}]} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.textBtn}>
            {itemParaEditar ? "GUARDAR CAMBIOS" : "CREAR CUENTA"}
          </Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={onFinalizar} style={styles.btnCancel}>
        <Text style={{color: '#888', fontWeight: '500'}}>Cancelar y volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  headerForm: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#333', textAlign: 'center' },
  labelInput: { fontSize: 12, color: '#999', marginBottom: 5, marginLeft: 5 },
  input: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#EEE', color: '#333' },
  inputDisabled: { backgroundColor: '#EEE', color: '#888' },
  label: { fontWeight: 'bold', marginBottom: 10, color: '#555' },
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  rolBtn: { 
    padding: 10, 
    borderWidth: 1, 
    borderColor: '#FF6F00', 
    borderRadius: 8, 
    width: '48%', 
    alignItems: 'center',
    marginBottom: 10
  },
  active: { backgroundColor: '#FF6F00' },
  rolText: { color: '#FF6F00', fontSize: 12, fontWeight: '600' },
  activeText: { color: 'white' },
  btnMain: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnCancel: { marginTop: 15, alignItems: 'center', padding: 5 },
  textBtn: { color: 'white', fontWeight: 'bold', fontSize: 15 }
});
