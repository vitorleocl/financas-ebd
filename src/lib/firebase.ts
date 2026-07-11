/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile
} from "firebase/auth";
import { 
  getFirestore,
  initializeFirestore, 
  doc, 
  setDoc, 
  getDoc,
  getDocFromServer,
  enableNetwork,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  arrayUnion
} from "firebase/firestore";

import firebaseConfig from "../../firebase-applet-config.json";

// Mapeia e permite sobrescrever as credenciais do Firebase com variáveis de ambiente personalizadas
const dynamicFirebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
};

const customDatabaseId = (import.meta as any).env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId;

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(dynamicFirebaseConfig) : getApp();

export const auth = getAuth(app);

// Use initializeFirestore with experimentalAutoDetectLongPolling: true to automatically switch to HTTP long-polling if WebSockets are blocked or fail.
// This is critical for mobile carriers and firewall-restricted networks, preventing "Failed to get document because the client is offline" errors.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
}, customDatabaseId || undefined);

export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onSnapshot,
  doc,
  getDoc,
  getDocFromServer,
  enableNetwork,
  setDoc,
  updateDoc,
  arrayUnion,
  updateProfile
};
export type { FirebaseUser };

/**
 * Saves the entire application state (excluding currentUser session) to Firestore for any authenticated user.
 */
export async function saveStateToFirestore(userId: string, stateData: any, deletedUsernames?: string[]) {
  const savePromise = (async () => {
    try {
      const userDocRef = doc(db, "ebd_states", "shared_church_ebd");
      
      // Fetch latest remote users directly from the server to bypass stale cache and prevent overwriting concurrent registrations!
      let mergedUsers = stateData.users || [];
      try {
        let docSnap;
        try {
          docSnap = await getDocFromServer(userDocRef);
        } catch (srvErr) {
          console.warn("getDocFromServer failed, trying standard getDoc (cache/hybrid)...", srvErr);
          docSnap = await getDoc(userDocRef);
        }

        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          const remoteUsers = remoteData.users || [];
          
          // Merge local and remote users safely
          const map = new Map<string, any>();
          const deletedSet = new Set(deletedUsernames?.map(u => u.toLowerCase().trim()) || []);
          
          remoteUsers.forEach((u: any) => {
            if (u && u.username) {
              const key = u.username.toLowerCase().trim();
              if (!deletedSet.has(key)) {
                map.set(key, u);
              }
            }
          });
          
          mergedUsers.forEach((u: any) => {
            if (u && u.username) {
              const key = u.username.toLowerCase().trim();
              if (!deletedSet.has(key)) {
                if (!map.has(key)) {
                  map.set(key, u);
                } else {
                  // If local has newer details (e.g. edited role or updated UID), prioritize it
                  const remoteUser = map.get(key);
                  if (u.role !== remoteUser.role || u.name !== remoteUser.name || u.id !== remoteUser.id) {
                    map.set(key, u);
                  }
                }
              }
            }
          });
          mergedUsers = Array.from(map.values());
        }
      } catch (err) {
        console.warn("Could not fetch remote users for merging before save:", err);
      }

      // Ensure currentUser is null so credentials/local sessions are kept local
      const stateToSave = {
        ...stateData,
        users: mergedUsers,
        currentUser: null,
        updatedAt: new Date().toISOString()
      };
      await setDoc(userDocRef, stateToSave);
      console.log("State durably persisted to Google Firestore (shared_church_ebd)!");
      return true;
    } catch (err) {
      console.error("Error saving state to Firestore:", err);
      return false;
    }
  })();

  const timeoutPromise = new Promise<boolean>((resolve) => 
    setTimeout(() => {
      console.warn("Firestore save operation timed out after 3000ms.");
      resolve(false);
    }, 3000)
  );

  return Promise.race([savePromise, timeoutPromise]);
}

/**
 * Loads the application state from Firestore, with a robust safety timeout.
 */
export async function loadStateFromFirestore(userId: string) {
  const fetchPromise = (async () => {
    try {
      const userDocRef = doc(db, "ebd_states", "shared_church_ebd");
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (err) {
      console.error("Error loading state from Firestore:", err);
    }
    return null;
  })();

  const timeoutPromise = new Promise<null>((resolve) => 
    setTimeout(() => {
      console.warn("Firestore load operation timed out after 3000ms. Falling back to local state to prevent login hang.");
      resolve(null);
    }, 3000)
  );

  return Promise.race([fetchPromise, timeoutPromise]);
}
