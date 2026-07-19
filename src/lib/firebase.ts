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
// Also enable ignoreUndefinedProperties: true to prevent Firestore from rejecting objects with undefined fields.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true
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
export async function saveStateToFirestore(
  userId: string, 
  stateData: any, 
  deletedUsernames?: string[],
  editedUsers?: Record<string, { role: any; name: string }>
) {
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
          
          // Build set of deleted emails
          const deletedSet = new Set<string>();
          const rawDeleted = [
            ...(remoteData.deletedEmails || []),
            ...(deletedUsernames || [])
          ];
          rawDeleted.forEach((e: string) => {
            if (e) {
              deletedSet.add(e.toLowerCase().trim());
            }
          });

          // Helper to safely find custom administrative edits case-insensitively
          const getPendingEdit = (email: string) => {
            if (!editedUsers) return null;
            const clean = email.toLowerCase().trim();
            const foundKey = Object.keys(editedUsers).find(k => k.toLowerCase().trim() === clean);
            return foundKey ? editedUsers[foundKey] : null;
          };

          const map = new Map<string, any>();
          
          // 1. First, populate map with the local users list (contains latest admin updates and role assignments)
          mergedUsers.forEach((u: any) => {
            if (u && u.username) {
              const key = u.username.toLowerCase().trim();
              if (!deletedSet.has(key)) {
                let mergedUser = { ...u };
                
                // If there's an active local edit passed explicitly, apply it just in case
                const edit = getPendingEdit(key);
                if (edit) {
                  mergedUser.role = edit.role;
                  mergedUser.name = edit.name;
                  mergedUser.avatarColor = mergedUser.role === 'MASTER' ? 'bg-indigo-900' : mergedUser.role === 'TESOUREIRO' ? 'bg-blue-600' : mergedUser.role === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500';
                }
                
                map.set(key, mergedUser);
              }
            }
          });
          
          // 2. Second, merge remote users that are NOT present in local state (concurrent registrations/invites)
          remoteUsers.forEach((u: any) => {
            if (u && u.username) {
              const key = u.username.toLowerCase().trim();
              if (!deletedSet.has(key)) {
                if (!map.has(key)) {
                  // This is a concurrent registration from another device that hasn't synced locally yet
                  map.set(key, u);
                } else {
                  // If they exist in both, we keep the local version (with its updated role), but we can upgrade IDs if needed
                  const localUser = map.get(key);
                  if (u.id !== localUser.id && u.id.startsWith('fb-') && !u.id.startsWith('fb-invite-') && localUser.id.startsWith('fb-invite-')) {
                    localUser.id = u.id;
                    map.set(key, localUser);
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
      
      // Robust client-side sanitization to recursively strip out any "undefined" properties (e.g. approvedBy, approvedAt) before saving to Firestore
      const sanitizedState = JSON.parse(JSON.stringify(stateToSave));
      
      await setDoc(userDocRef, sanitizedState);
      console.log("State durably persisted to Google Firestore (shared_church_ebd)!");
      return true;
    } catch (err) {
      console.error("Error saving state to Firestore:", err);
      return false;
    }
  })();

  const timeoutPromise = new Promise<boolean>((resolve) => 
    setTimeout(() => {
      console.warn("Firestore save operation timed out after 15000ms.");
      resolve(false);
    }, 15000)
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
      console.warn("Firestore load operation timed out after 15000ms. Falling back to local state to prevent login hang.");
      resolve(null);
    }, 15000)
  );

  return Promise.race([fetchPromise, timeoutPromise]);
}
