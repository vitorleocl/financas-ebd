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
      let finalDeletedEmails: string[] = [];
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
          
          // Build set of active local user emails to ensure we don't accidentally filter them out!
          const activeLocalEmails = new Set((stateData.users || []).map((u: any) => u && u.username ? u.username.toLowerCase().trim() : ''));

          // Merge local and remote users safely
          const map = new Map<string, any>();
          
          // Build deleted emails list, but EXCLUDE any email that is currently in our active local users list!
          const deletedSet = new Set<string>();
          const rawDeleted = [
            ...(remoteData.deletedEmails || []),
            ...(deletedUsernames || [])
          ];
          rawDeleted.forEach((e: string) => {
            if (e) {
              const emailClean = e.toLowerCase().trim();
              if (!activeLocalEmails.has(emailClean)) {
                deletedSet.add(emailClean);
              }
            }
          });
          
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

          // Filter out active users from the deletedEmails list to allow clean re-invites
          const activeEmails = new Set(mergedUsers.map((u: any) => u.username.toLowerCase().trim()));
          finalDeletedEmails = Array.from(deletedSet).filter((e: string) => !activeEmails.has(e));
        } else {
          finalDeletedEmails = (deletedUsernames || []).map(e => e.toLowerCase().trim());
        }
      } catch (err) {
        console.warn("Could not fetch remote users for merging before save:", err);
        finalDeletedEmails = (deletedUsernames || []).map(e => e.toLowerCase().trim());
      }

      // Ensure box balances are 100% mathematically correct based on transactions being saved
      let finalBoxes = stateData.boxes || [];
      if (Array.isArray(finalBoxes)) {
        const txs = stateData.transactions || [];
        finalBoxes = finalBoxes.map((box: any) => {
          if (!box) return box;
          const boxTransactions = txs.filter((t: any) => {
            if (!t) return false;
            let bid = t.boxId;
            if (!bid) {
              if (t.categoryId === 'cat-ent-3' || t.categoryId === 'cat-sai-1' || 
                  (t.description && (t.description.toLowerCase().includes('revista') || t.description.toLowerCase().includes('lição') || t.description.toLowerCase().includes('licao')))) {
                bid = 'CAIXA_LICOES';
              } else {
                bid = 'CAIXA_5_EBD';
              }
            }
            return bid === box.id;
          });
          const baseBalance = box.initialBalance || 0;
          const balance = boxTransactions.reduce((acc: number, t: any) => {
            if (t && t.isApproved !== false) {
              const amt = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0;
              if (t.type === 'ENTRADA') {
                return acc + amt;
              } else {
                return acc - amt;
              }
            }
            return acc;
          }, baseBalance);
          return {
            ...box,
            balance: parseFloat(balance.toFixed(2))
          };
        });
      }

      // Ensure currentUser is null so credentials/local sessions are kept local
      const stateToSave = {
        ...stateData,
        boxes: finalBoxes,
        users: mergedUsers,
        deletedEmails: finalDeletedEmails,
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
