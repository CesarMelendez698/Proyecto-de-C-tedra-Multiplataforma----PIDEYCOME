// Importamos la función para inicializar la aplicación base de Firebase
import { initializeApp } from "firebase/app";

// Importamos getAuth para manejar el inicio de sesión y registro de empleados
import { getAuth } from "firebase/auth";

// IMPORTANTE: Importamos getFirestore para poder guardar productos y usuarios en la nube
import { getFirestore } from "firebase/firestore";

// Objeto de configuración con las credenciales de tu proyecto 'pideycome-d3318'
const firebaseConfig = {
  apiKey: "AIzaSyBRK92uoyWWp_MZeVcMPLrQOd1isLxDeWk",
  authDomain: "pideycome-d3318.firebaseapp.com",
  projectId: "pideycome-d3318",
  storageBucket: "pideycome-d3318.firebasestorage.app",
  messagingSenderId: "208846970212",
  appId: "1:208846970212:web:5b8441f6b03dbcbbbbee71"
};

// 1. Inicializamos la instancia principal de Firebase con tu configuración
const app = initializeApp(firebaseConfig);

// 2. Inicializamos el servicio de Autenticación y lo exportamos para usarlo en el Login
export const auth = getAuth(app);

// 3. Inicializamos la base de datos Firestore y la exportamos como 'db'
// Esta es la que usarán 'FormularioProducto' y 'RegistroEmpleado' para guardar datos
export const db = getFirestore(app);

// Exportamos la app por defecto por si se necesita en otros servicios (como Storage)
export default app;