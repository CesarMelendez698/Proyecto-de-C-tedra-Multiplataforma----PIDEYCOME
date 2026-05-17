import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { AppContext } from '../context/AppContext'; 
import { Ionicons } from '@expo/vector-icons'; 

// --- IMPORTACIONES DE FIREBASE ---
import { 
  signInWithEmailAndPassword, 
  updatePassword, 
  signOut, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, db } from '../firebaseConfig'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore'; 

export default function LoginScreen() {
  const { setUsuario } = useContext(AppContext);
  
  // Estados para el Login
  const [user, setUser] = useState(''); 
  const [pass, setPass] = useState(''); 
  const [loading, setLoading] = useState(false); 
  const [showPass, setShowPass] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null); 

  // Estados para Recuperación de Contraseña
  const [modalReset, setModalReset] = useState(false);
  const [emailReset, setEmailReset] = useState('');

  // Estados para Cambio de Contraseña Obligatorio
  const [modalCambio, setModalCambio] = useState(false);
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmarPass, setConfirmarPass] = useState('');
  const [showNuevaPass, setShowNuevaPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [tempUser, setTempUser] = useState(null);

  /**
   * Envía correo de recuperación
   */
  const handleResetPassword = async () => {
    if (!emailReset.trim()) {
      Alert.alert("Correo requerido", "Por favor ingresa tu correo electrónico.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, emailReset.trim().toLowerCase());
      Alert.alert(
        "Correo enviado", 
        "Se ha enviado un enlace para restablecer tu contraseña a " + emailReset
      );
      setModalReset(false);
      setEmailReset('');
    } catch (error) {
      Alert.alert("Error", "No se pudo enviar el correo. Verifica que la dirección sea correcta.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!user.trim() || !pass.trim()) {
      Alert.alert('Datos incompletos', 'Por favor, ingrese su correo y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, user.toLowerCase().trim(), pass);
      const firebaseUser = userCredential.user; 
      const docRef = doc(db, "usuarios", firebaseUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const datosDB = docSnap.data();
        if (datosDB.requiereCambio) {
          setTempUser({ id: firebaseUser.uid, ...datosDB });
          setModalCambio(true); 
          setLoading(false);
          return;
        }
        setUsuario({
          id: firebaseUser.uid,
          nombre: datosDB.nombre,
          rol: datosDB.rol.toLowerCase().trim(),
          email: firebaseUser.email
        });
      } else {
        Alert.alert('Error', 'Perfil no encontrado.');
        await signOut(auth);
      }
    } catch (error) {
      Alert.alert('Acceso Denegado', 'Correo o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  const procesarCambioPassword = async () => {
    if (nuevaPass.length < 6) {
      Alert.alert("Seguridad", "Mínimo 6 caracteres.");
      return;
    }
    if (nuevaPass !== confirmarPass) {
      Alert.alert("Error", "Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      // 1. Actualizar en Firebase Auth
      await updatePassword(auth.currentUser, nuevaPass);
      // 2. Modificar la bandera en Firestore
      await updateDoc(doc(db, "usuarios", tempUser.id), { requiereCambio: false });
      
      // 3. Forzar el cierre de sesión y limpiar campos para regresar de forma segura al Login
      await signOut(auth);
      setModalCambio(false);
      setNuevaPass('');
      setConfirmarPass('');
      setPass(''); // Limpiamos la clave temporal del formulario de login
      
      Alert.alert("Éxito", "Contraseña actualizada. Por favor, inicia sesión con tus nuevas credenciales.");
    } catch (error) {
      Alert.alert("Error", "La sesión expiró. Reintente el login.");
      setModalCambio(false);
      await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.containerMain}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
          <View style={styles.card}>
            <View style={styles.headerIcon}>
              <View style={styles.circle}><Ionicons name="restaurant" size={45} color="white" /></View>
            </View>
            <Text style={styles.title}>PideyCome</Text>
            <Text style={styles.subtitle}>Gestión Gastronómica</Text>
            
            <View style={styles.form}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <View style={[styles.inputContainer, focusedInput === 'user' && styles.inputFocused]}>
                <Ionicons name="mail-outline" size={20} color={focusedInput === 'user' ? "#FF6F00" : "#666"} style={styles.inputIcon} />
                <TextInput 
                  placeholder="usuario@pideycome.com" 
                  style={styles.input}
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setFocusedInput('user')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
              
              <Text style={styles.label}>Contraseña</Text>
              <View style={[styles.inputContainer, focusedInput === 'pass' && styles.inputFocused]}>
                <Ionicons name="lock-closed-outline" size={20} color={focusedInput === 'pass' ? "#FF6F00" : "#666"} style={styles.inputIcon} />
                <TextInput 
                  placeholder="Contraseña" 
                  style={styles.input}
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry={!showPass}
                  onFocus={() => setFocusedInput('pass')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeIcon}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
                </TouchableOpacity>
              </View>

              {/* BOTÓN CENTRADO */}
              <TouchableOpacity onPress={() => setModalReset(true)} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLogin} style={styles.btnPrincipal} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : (
                  <View style={styles.btnContent}>
                     <Text style={styles.btnText}>Iniciar Sesión</Text>
                     <Ionicons name="arrow-forward" size={20} color="white" style={{marginLeft: 10}} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL RECUPERACIÓN */}
      <Modal visible={modalReset} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Recuperar Acceso</Text>
            <Text style={styles.modalText}>Ingresa tu correo para recibir un enlace de restablecimiento.</Text>
            <TextInput 
              placeholder="tu-correo@pideycome.com" 
              style={styles.modalInput}
              value={emailReset}
              onChangeText={setEmailReset}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.btnPrincipal} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Enviar Enlace</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalReset(false)} style={styles.btnCancel}>
              <Text style={{color: '#8E8E93'}}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL CAMBIO OBLIGATORIO */}
      <Modal visible={modalCambio} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="shield-checkmark" size={50} color="#FF6F00" />
            <Text style={styles.modalTitle}>Seguridad Requerida</Text>
            <Text style={styles.modalText}>Tu cuenta requiere una contraseña personal para continuar.</Text>
            
            <View style={[styles.inputContainer, focusedInput === 'nueva' && styles.inputFocused, {width: '100%'}]}>
              <TextInput 
                placeholder="Nueva contraseña" 
                secureTextEntry={!showNuevaPass} 
                style={styles.input} 
                value={nuevaPass} 
                onChangeText={setNuevaPass} 
                onFocus={() => setFocusedInput('nueva')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity onPress={() => setShowNuevaPass(!showNuevaPass)} style={styles.eyeIcon}>
                <Ionicons name={showNuevaPass ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, focusedInput === 'confirmar' && styles.inputFocused, {width: '100%'}]}>
              <TextInput 
                placeholder="Confirmar contraseña" 
                secureTextEntry={!showConfirmPass} 
                style={styles.input} 
                value={confirmarPass} 
                onChangeText={setConfirmarPass} 
                onFocus={() => setFocusedInput('confirmar')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} style={styles.eyeIcon}>
                <Ionicons name={showConfirmPass ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btnPrincipal} onPress={procesarCambioPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Actualizar e Ingresar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerMain: { flex: 1, backgroundColor: '#FDF2E9' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25 },
  card: { backgroundColor: 'white', borderRadius: 25, padding: 30, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  headerIcon: { alignItems: 'center', marginBottom: 15 },
  circle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FF6F00', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#333' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#999', marginBottom: 30 },
  form: { marginBottom: 10 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 8, marginLeft: 5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F8', borderRadius: 12, marginBottom: 20, borderWidth: 1.5, borderColor: '#E1E4E8', paddingHorizontal: 15, minHeight: 55 },
  inputFocused: { borderColor: '#FF6F00', backgroundColor: 'white' },
  inputIcon: { marginRight: 10 },
  eyeIcon: { padding: 10 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#333', height: '100%' },
  forgotBtn: { alignSelf: 'center', marginBottom: 25, marginTop: 5 },
  forgotText: { color: '#FF6F00', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  btnPrincipal: { backgroundColor: '#FF6F00', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 3, width: '100%' },
  btnContent: { flexDirection: 'row', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnCancel: { marginTop: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', borderRadius: 25, padding: 30, alignItems: 'center', elevation: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 10, color: '#333' },
  modalText: { textAlign: 'center', color: '#666', marginBottom: 20, fontSize: 14 },
  modalInput: { backgroundColor: '#F4F6F8', width: '100%', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E1E4E8' }
});