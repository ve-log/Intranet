/*
 * VE-Log – zentrale Firebase-Konfiguration
 *
 * Diese Datei wird auf jeder Seite per <script> eingebunden und stellt die
 * Konfiguration als window.VELOG_FIREBASE_CONFIG bereit. Änderungen (z. B. neues
 * Firebase-Projekt) müssen nur noch HIER gemacht werden.
 *
 * Hinweis: Der apiKey einer Firebase-Web-App ist kein Geheimnis. Geschützt werden
 * die Daten durch die Firebase Security Rules und die Einschränkung des Keys auf
 * die eigene Domain (Google Cloud Console -> APIs & Dienste -> Anmeldedaten).
 */
window.VELOG_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDXTAVTeddKxwOp_C_2Z4lPY9yI5bAm0KM",
  authDomain: "ve-log.firebaseapp.com",
  databaseURL: "https://ve-log-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ve-log",
  storageBucket: "ve-log.firebasestorage.app",
  messagingSenderId: "749978080433",
  appId: "1:749978080433:web:8f64ef99a557fe2346be90",
  measurementId: "G-E0GXHSBHQ5"
};
