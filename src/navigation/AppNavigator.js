import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AppContext } from '../context/AppContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Importación de Pantallas
import LoginScreen from '../screens/LoginScreen';
import MeseroScreen from '../screens/MeseroScreen';
import CocinaScreen from '../screens/CocinaScreen';
import CajaScreen from '../screens/CajaScreen';
import AdminScreen from '../screens/AdminScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { usuario, cargando } = useContext(AppContext);

  // 1. Pantalla de carga mientras se recupera la sesión de Firebase
  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6F00" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {usuario == null ? (
        // 2. Flujo de Autenticación
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        // 3. Flujo Protegido por Roles
        <>
          {usuario.rol?.toLowerCase().trim() === 'mesero' && (
            <Stack.Screen name="MeseroHome" component={MeseroScreen} />
          )}
          
          {usuario.rol?.toLowerCase().trim() === 'cocina' && (
            <Stack.Screen name="CocinaHome" component={CocinaScreen} />
          )}
          
          {usuario.rol?.toLowerCase().trim() === 'caja' && (
            <Stack.Screen name="CajaHome" component={CajaScreen} />
          )}
          
          {usuario.rol?.toLowerCase().trim() === 'admin' && (
            <Stack.Screen name="AdminHome" component={AdminScreen} />
          )}

          {/* Opcional: Si por algún error el usuario tiene un rol que no existe, 
            podemos agregar una pantalla de error o simplemente no renderizar nada 
            para que el sistema lo mantenga fuera de las funciones críticas.
          */}
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDF2E9', // Color acorde a tu identidad visual
  },
});