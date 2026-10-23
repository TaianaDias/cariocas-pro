import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { firebaseEmulators } from "./firebase-emulators";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || "demo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || "demo-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID?.trim() || "000000000000",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ||
    "1:000000000000:web:0000000000000000000000",
};

const emulators = firebaseEmulators({
  enabled: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true",
  environment: process.env.NODE_ENV,
  projectId: firebaseConfig.projectId,
  authHost: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
  firestoreHost: process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST,
});
const novoApp = getApps().length === 0;
export const app = novoApp ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

if (emulators && novoApp) {
  connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulators.firestore.host, emulators.firestore.port);
}
