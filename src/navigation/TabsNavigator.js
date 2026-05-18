import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

// Importación de Pantallas
import MeseroScreen from '../screens/MeseroScreen';
import CocinaScreen from '../screens/CocinaScreen';
import CajaScreen from '../screens/CajaScreen';
import AdminScreen from '../screens/AdminScreen';

const Tab = createBottomTabNavigator();

export default function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // Ocultamos el header por defecto para usar los personalizados de cada pantalla
        tabBarActiveTintColor: '#FF6F00',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 10,
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Mesero') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'Cocina') {
            iconName = focused ? 'flame' : 'flame-outline';
          } else if (route.name === 'Caja') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'Admin') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Mesero" 
        component={MeseroScreen} 
        options={{ tabBarLabel: 'Mesas' }}
      />
      <Tab.Screen 
        name="Cocina" 
        component={CocinaScreen} 
        options={{ tabBarLabel: 'Cocina' }}
      />
      <Tab.Screen 
        name="Caja" 
        component={CajaScreen} 
        options={{ tabBarLabel: 'Caja' }}
      />
      <Tab.Screen 
        name="Admin" 
        component={AdminScreen} 
        options={{ tabBarLabel: 'Admin' }}
      />
    </Tab.Navigator>
  );
}