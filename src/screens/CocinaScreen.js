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