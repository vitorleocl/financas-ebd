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

// Mapeia e permite sobrescrever as credenciais do Firebase com variáveis de ambiente personalizadas caso desejado
const envProjectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID;
const envAuthDomain = (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN;
const envApiKey = (import.meta as any).env?.VITE_FIREBASE_API_KEY;
const envStorageBucket = (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET;
const envMessagingSenderId = (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID;
const envAppId = (import.meta as any).env?.VITE_FIREBASE_APP_ID;
const envMeasurementId = (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID;

const dynamicFirebaseConfig = {
  apiKey: envApiKey || firebaseConfig.apiKey,
  authDomain: envAuthDomain || firebaseConfig.authDomain,
  projectId: envProjectId || firebaseConfig.projectId,
  storageBucket: envStorageBucket || firebaseConfig.storageBucket,
  messagingSenderId: envMessagingSenderId || firebaseConfig.messagingSenderId,
  appId: envAppId || firebaseConfig.appId,
  measurementId: envMeasurementId || firebaseConfig.measurementId,
};

// ID do banco Firestore (se "(default)" ou não especificado, usa a instância padrão)
const rawDatabaseId = (import.meta as any).env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId;
const customDatabaseId = (rawDatabaseId && rawDatabaseId !== "(default)") ? rawDatabaseId : undefined;

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(dynamicFirebaseConfig) : getApp();

export const auth = getAuth(app);

// Use initializeFirestore with experimentalAutoDetectLongPolling: true to automatically switch to HTTP long-polling if WebSockets are blocked or fail.
// This is critical for mobile carriers and firewall-restricted networks, preventing "Failed to get document because the client is offline" errors.
// Also enable ignoreUndefinedProperties: true to prevent Firestore from rejecting objects with undefined fields.
export const db = customDatabaseId 
  ? initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true
    }, customDatabaseId)
  : initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true
    });

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

let saveQueue: Promise<any> = Promise.resolve(true);

/**
 * Saves the entire application state (excluding currentUser session) to Firestore for any authenticated user.
 * Uses a sequential promise queue to avoid race conditions when multiple writes happen in quick succession.
 */
export async function saveStateToFirestore(
  userId: string, 
  stateData: any, 
  deletedUsernames?: string[],
  editedUsers?: Record<string, { role: any; name: string }>
): Promise<boolean> {
  const operation = async () => {
    try {
      return await executeSaveStateToFirestore(userId, stateData, deletedUsernames, editedUsers);
    } catch (e) {
      console.error("Save queue execution failed:", e);
      return false;
    }
  };

  saveQueue = saveQueue.then(operation, operation);
  return saveQueue;
}

async function executeSaveStateToFirestore(
  userId: string, 
  stateData: any, 
  deletedUsernames?: string[],
  editedUsers?: Record<string, { role: any; name: string }>
): Promise<boolean> {
  try {
    const userDocRef = doc(db, "ebd_states", "shared_church_ebd");
    
    // 1. Fetch latest remote document directly from the server to bypass cache and merge accurately
    let docSnap: any = null;
    try {
      try {
        docSnap = await getDocFromServer(userDocRef);
      } catch (srvErr) {
        docSnap = await getDoc(userDocRef);
      }
    } catch (err) {
      console.warn("Could not fetch remote document before save:", err);
    }

    const remoteData = docSnap && docSnap.exists() ? docSnap.data() : null;

    // 2. Build complete set of deleted IDs and emails
    const deletedTxIds = new Set<string>([
      ...(remoteData?.deletedTransactionIds || []),
      ...(stateData.deletedTransactionIds || [])
    ]);
    const deletedClosingIds = new Set<string>([
      ...(remoteData?.deletedClosingIds || []),
      ...(stateData.deletedClosingIds || [])
    ]);
    const deletedPeopleIds = new Set<string>([
      ...(remoteData?.deletedPeopleIds || []),
      ...(stateData.deletedPeopleIds || [])
    ]);

    const deletedSet = new Set<string>();
    const rawDeleted = [
      ...(remoteData?.deletedEmails || []),
      ...(deletedUsernames || [])
    ];
    rawDeleted.forEach((e: string) => {
      if (e) {
        deletedSet.add(e.toLowerCase().trim());
      }
    });

    // 3. User Merging
    let mergedUsers = stateData.users || [];
    const getPendingEdit = (email: string) => {
      if (!editedUsers) return null;
      const clean = email.toLowerCase().trim();
      const foundKey = Object.keys(editedUsers).find(k => k.toLowerCase().trim() === clean);
      return foundKey ? editedUsers[foundKey] : null;
    };

    const userMap = new Map<string, any>();
    // Populate with local users
    mergedUsers.forEach((u: any) => {
      if (u && u.username) {
        const key = u.username.toLowerCase().trim();
        if (!deletedSet.has(key)) {
          let mergedUser = { ...u };
          const edit = getPendingEdit(key);
          if (edit) {
            mergedUser.role = edit.role;
            mergedUser.name = edit.name;
            mergedUser.avatarColor = edit.role === 'MASTER' ? 'bg-indigo-900' : edit.role === 'TESOUREIRO' ? 'bg-blue-600' : edit.role === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500';
          }
          userMap.set(key, mergedUser);
        }
      }
    });

    // Merge remote users (concurrent registrations/invites)
    if (remoteData?.users && Array.isArray(remoteData.users)) {
      remoteData.users.forEach((u: any) => {
        if (u && u.username) {
          const key = u.username.toLowerCase().trim();
          if (!deletedSet.has(key)) {
            if (!userMap.has(key)) {
              userMap.set(key, u);
            } else {
              const localUser = userMap.get(key);
              if (u.id !== localUser.id && u.id.startsWith('fb-') && !u.id.startsWith('fb-invite-') && localUser.id.startsWith('fb-invite-')) {
                localUser.id = u.id;
                userMap.set(key, localUser);
              }
            }
          }
        }
      });
    }
    mergedUsers = Array.from(userMap.values());
    const activeEmails = new Set(mergedUsers.map((u: any) => u.username.toLowerCase().trim()));
    const finalDeletedEmails = Array.from(deletedSet).filter((e: string) => !activeEmails.has(e));

    // 4. CRITICAL: Bidirectional Transaction Merging (Preserves transactions from ALL users in real time)
    const isLegacySeedTx = (t: any) => {
      if (!t) return true;
      const amt = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0;
      if (
        amt === 250.25 || 
        amt === 150.00 || 
        amt === 326.40 || 
        amt === 310.00 || 
        amt === 152.30 || 
        amt === 320.00 ||
        amt === 250 ||
        amt === 150
      ) {
        return true;
      }
      if (t.id && (
        t.id.startsWith('tx-init-') || 
        t.id === 'tx-seed-1' || 
        t.id === 'tx-seed-2' || 
        t.id === 'tx-seed-3' || 
        t.id === 'tx-1' || 
        t.id === 'tx-2' || 
        t.id === 'tx-3' ||
        t.id.startsWith('tx-sample-') ||
        t.id.startsWith('seed-')
      )) {
        return true;
      }
      if (t.description && typeof t.description === 'string') {
        const desc = t.description.toLowerCase().trim();
        if (
          desc === 'saldo inicial' || 
          desc === 'saldo de abertura' || 
          desc === 'abertura de caixa' ||
          desc === 'saldo base inicial' ||
          desc === 'cota inicial' ||
          desc === 'saldo anterior' ||
          desc === 'saldo base' ||
          desc.startsWith('saldo inicial') ||
          desc.startsWith('saldo de abertura') ||
          desc.startsWith('abertura de caixa') ||
          desc.startsWith('saldo base inicial') ||
          desc.startsWith('saldo anterior')
        ) {
          return true;
        }
      }
      return false;
    };

    const txMap = new Map<string, any>();
    const remoteTransactions = remoteData?.transactions || [];
    const localTransactions = stateData.transactions || [];

    // Add remote transactions first (excluding deleted and legacy seeds)
    if (Array.isArray(remoteTransactions)) {
      remoteTransactions.forEach((rt: any) => {
        if (rt && rt.id) {
          if (isLegacySeedTx(rt)) {
            deletedTxIds.add(rt.id);
          } else if (!deletedTxIds.has(rt.id)) {
            txMap.set(rt.id, { ...rt });
          }
        }
      });
    }

    // Merge local transactions (guarantees newly created or newly approved transactions are never lost)
    if (Array.isArray(localTransactions)) {
      localTransactions.forEach((lt: any) => {
        if (lt && lt.id) {
          if (isLegacySeedTx(lt)) {
            deletedTxIds.add(lt.id);
          } else if (!deletedTxIds.has(lt.id)) {
            if (!txMap.has(lt.id)) {
              // New local transaction added by this user (e.g. Vitor or Eduarda)
              txMap.set(lt.id, { ...lt });
            } else {
              // Exists in both! Merge properties ensuring isApproved: true is NEVER reverted
              const remoteTx = txMap.get(lt.id);
              const isApproved = remoteTx.isApproved === true || lt.isApproved === true;
              const approvedBy = lt.approvedBy || remoteTx.approvedBy;
              const approvedAt = lt.approvedAt || remoteTx.approvedAt;

              txMap.set(lt.id, {
                ...remoteTx,
                ...lt,
                isApproved,
                approvedBy: isApproved ? approvedBy : undefined,
                approvedAt: isApproved ? approvedAt : undefined,
                attachment: lt.attachment || remoteTx.attachment,
                signature: lt.signature || remoteTx.signature
              });
            }
          }
        }
      });
    }

    const finalDeletedTxIds = Array.from(deletedTxIds);

    // Ensure fallback boxId if missing
    const finalTransactions = Array.from(txMap.values()).map((t: any) => {
      let boxId = t.boxId;
      if (!boxId) {
        if (t.categoryId === 'cat-ent-3' || t.categoryId === 'cat-sai-1' || 
            (t.description && (t.description.toLowerCase().includes('revista') || t.description.toLowerCase().includes('lição') || t.description.toLowerCase().includes('licao')))) {
          boxId = 'CAIXA_LICOES';
        } else {
          boxId = 'CAIXA_5_EBD';
        }
      }
      return {
        ...t,
        boxId,
        amount: typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0
      };
    }).sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt || a.id.replace('tx-', '')).getTime();
      const timeB = new Date(b.createdAt || b.id.replace('tx-', '')).getTime();
      return timeB - timeA;
    });

    // 5. Bidirectional Merging for Closings (Atas)
    const closingMap = new Map<string, any>();
    const remoteClosings = remoteData?.closings || [];
    const localClosings = stateData.closings || [];

    if (Array.isArray(remoteClosings)) {
      remoteClosings.forEach((rc: any) => {
        if (rc && rc.id && !deletedClosingIds.has(rc.id)) {
          closingMap.set(rc.id, { ...rc });
        }
      });
    }

    if (Array.isArray(localClosings)) {
      localClosings.forEach((lc: any) => {
        if (lc && lc.id && !deletedClosingIds.has(lc.id)) {
          if (!closingMap.has(lc.id)) {
            closingMap.set(lc.id, { ...lc });
          } else {
            const remoteC = closingMap.get(lc.id);
            const isApproved = remoteC.status === 'APROVADO' || lc.status === 'APROVADO';
            closingMap.set(lc.id, {
              ...remoteC,
              ...lc,
              status: isApproved ? 'APROVADO' : lc.status || remoteC.status,
              dirigenteApprover: lc.dirigenteApprover || remoteC.dirigenteApprover,
              dirigenteApprovedAt: lc.dirigenteApprovedAt || remoteC.dirigenteApprovedAt
            });
          }
        }
      });
    }
    const finalClosings = Array.from(closingMap.values()).sort((a: any, b: any) => 
      new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
    );

    // 6. Bidirectional Merging for People
    const peopleMap = new Map<string, any>();
    const remotePeople = remoteData?.people || [];
    const localPeople = stateData.people || [];

    if (Array.isArray(remotePeople)) {
      remotePeople.forEach((rp: any) => {
        if (rp && rp.id && !deletedPeopleIds.has(rp.id)) {
          peopleMap.set(rp.id, { ...rp });
        }
      });
    }

    if (Array.isArray(localPeople)) {
      localPeople.forEach((lp: any) => {
        if (lp && lp.id && !deletedPeopleIds.has(lp.id)) {
          peopleMap.set(lp.id, { ...lp });
        }
      });
    }
    const finalPeople = Array.from(peopleMap.values());

    // 7. Categories Merging (Ensure default initial categories + custom ones)
    const catMap = new Map<string, any>();
    if (Array.isArray(remoteData?.categories)) {
      remoteData.categories.forEach((c: any) => {
        if (c && c.id) catMap.set(c.id, c);
      });
    }
    if (Array.isArray(stateData.categories)) {
      stateData.categories.forEach((c: any) => {
        if (c && c.id) catMap.set(c.id, c);
      });
    }
    const finalCategories = Array.from(catMap.values());

    // 8. Audit Logs Merging (Keep latest 200)
    const auditMap = new Map<string, any>();
    if (Array.isArray(remoteData?.auditLogs)) {
      remoteData.auditLogs.forEach((l: any) => {
        if (l && l.id) auditMap.set(l.id, l);
      });
    }
    if (Array.isArray(stateData.auditLogs)) {
      stateData.auditLogs.forEach((l: any) => {
        if (l && l.id) auditMap.set(l.id, l);
      });
    }
    const finalAuditLogs = Array.from(auditMap.values())
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 200);

    // 9. CRITICAL: Recalculate Box Balances for BOTH Caixa 5% and Caixa Lições from the unified transactions!
    let initialBox5 = (stateData.boxes?.find((b: any) => b && b.id === 'CAIXA_5_EBD')?.initialBalance) ?? 
                      (remoteData?.boxes?.find((b: any) => b && b.id === 'CAIXA_5_EBD')?.initialBalance) ?? 76.15;
    let initialBoxLicoes = (stateData.boxes?.find((b: any) => b && b.id === 'CAIXA_LICOES')?.initialBalance) ?? 
                           (remoteData?.boxes?.find((b: any) => b && b.id === 'CAIXA_LICOES')?.initialBalance) ?? 160.00;

    if (
      initialBox5 === 152.30 ||
      initialBox5 === 250.25 || 
      initialBox5 === 326.40 || 
      initialBox5 === 326.4 || 
      initialBox5 === 250 || 
      initialBox5 === 0 ||
      typeof initialBox5 !== 'number'
    ) {
      initialBox5 = 76.15;
    }
    if (
      initialBoxLicoes === 320.00 ||
      initialBoxLicoes === 150.00 || 
      initialBoxLicoes === 310.00 || 
      initialBoxLicoes === 310 || 
      initialBoxLicoes === 150 || 
      initialBoxLicoes === 0 ||
      typeof initialBoxLicoes !== 'number'
    ) {
      initialBoxLicoes = 160.00;
    }

    const defaultBoxesTemplate = [
      {
        id: 'CAIXA_5_EBD',
        name: 'Caixa 01 - 5% EBD',
        description: 'Fundo de caixa proveniente de dízimos/ofertas da igreja central (cota de 5% destinada à EBD) para manutenção diária e necessidades gerais.',
        balance: 76.15,
        initialBalance: initialBox5
      },
      {
        id: 'CAIXA_LICOES',
        name: 'Caixa 02 - Lições',
        description: 'Caixa exclusivo de receitas da venda de revistas (lições dominicais) e despesas de aquisição das novas lições trimestrais.',
        balance: 160.00,
        initialBalance: initialBoxLicoes
      }
    ];

    const finalBoxes = defaultBoxesTemplate.map(box => {
      const boxTransactions = finalTransactions.filter((t: any) => {
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

    // Ensure currentUser is null so credentials/local sessions are kept local
    const stateToSave = {
      transactions: finalTransactions,
      boxes: finalBoxes,
      closings: finalClosings,
      people: finalPeople,
      categories: finalCategories,
      auditLogs: finalAuditLogs,
      users: mergedUsers,
      deletedEmails: finalDeletedEmails,
      deletedTransactionIds: Array.from(deletedTxIds),
      deletedClosingIds: Array.from(deletedClosingIds),
      deletedPeopleIds: Array.from(deletedPeopleIds),
      currentUser: null,
      updatedAt: new Date().toISOString()
    };
    
    // Robust client-side sanitization to recursively strip out any "undefined" properties before saving to Firestore
    const sanitizedState = JSON.parse(JSON.stringify(stateToSave));
    
    await setDoc(userDocRef, sanitizedState);
    console.log("State durably persisted to Google Firestore (shared_church_ebd)!");
    return true;
  } catch (err) {
    console.error("Error saving state to Firestore:", err);
    return false;
  }
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
