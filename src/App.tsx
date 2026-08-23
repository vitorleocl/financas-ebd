/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppState, getInitialState, saveState, recalculateBalances, addAuditLog } from './data/stateManager';
import { INITIAL_CATEGORIES } from './data/initialData';
import { User, BoxId, Transaction, WeeklyClosing as ClosingType, Person, UserRole, AuditLog } from './types';
import { 
  Lock, Landmark, ArrowLeftRight, PlusCircle, CalendarRange, 
  Users, BarChart3, History, LogOut, ShieldAlert, FileDown, FileUp, 
  Menu, X, BookOpen, AlertCircle, ShieldCheck, Cloud, Trash2, Loader2, RefreshCw
} from 'lucide-react';
import { 
  auth, 
  db,
  doc,
  getDoc,
  getDocFromServer,
  enableNetwork,
  setDoc,
  signOut as firebaseSignOut,
  saveStateToFirestore,
  loadStateFromFirestore,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  onSnapshot,
  updateDoc,
  arrayUnion,
  updateProfile
} from './lib/firebase';

import firebaseConfig from '../firebase-applet-config.json';

// Import our modular subcomponents
import Dashboard from './components/Dashboard';
import BoxesManagement from './components/BoxesManagement';
import TransactionForm from './components/TransactionForm';
import WeeklyClosing from './components/WeeklyClosing';
import ReportsView from './components/ReportsView';
import AuditoryView from './components/AuditoryView';
import UsersManagement from './components/UsersManagement';
import TransactionReceipt from './components/TransactionReceipt';
import AtaWeeklyClosing from './components/AtaWeeklyClosing';
import LogoEBD from './components/LogoEBD';

// Helper functions to merge local and remote lists to prevent data loss or duplicate transactions between devices
const mergeAndSortTransactions = (
  local: Transaction[], 
  remote: Transaction[],
  approvedMap?: Map<string, { approvedBy?: string; approvedAt?: string }>
): Transaction[] => {
  const map = new Map<string, Transaction>();
  
  // 1. First add remote transactions
  if (Array.isArray(remote)) {
    remote.forEach(t => {
      if (t && t.id) {
        map.set(t.id, { ...t });
      }
    });
  }

  // 2. Merge local transactions
  if (Array.isArray(local)) {
    local.forEach(localTx => {
      if (localTx && localTx.id) {
        if (!map.has(localTx.id)) {
          map.set(localTx.id, { ...localTx });
        } else {
          const remoteTx = map.get(localTx.id)!;
          // CRITICAL INVARIANT: Once approved, ALWAYS approved!
          const isApproved = remoteTx.isApproved === true || localTx.isApproved === true || (approvedMap?.has(localTx.id) ?? false);
          const approvedBy = localTx.approvedBy || remoteTx.approvedBy || approvedMap?.get(localTx.id)?.approvedBy;
          const approvedAt = localTx.approvedAt || remoteTx.approvedAt || approvedMap?.get(localTx.id)?.approvedAt;

          map.set(localTx.id, {
            ...remoteTx,
            ...localTx,
            isApproved,
            approvedBy: isApproved ? approvedBy : undefined,
            approvedAt: isApproved ? approvedAt : undefined,
            attachment: localTx.attachment || remoteTx.attachment,
            signature: localTx.signature || remoteTx.signature
          });
        }
      }
    });
  }

  // 3. Guarantee any transaction recorded in approvedMap has isApproved: true and valid boxId
  const result: Transaction[] = [];
  map.forEach(tx => {
    if (approvedMap && approvedMap.has(tx.id)) {
      const approvalData = approvedMap.get(tx.id);
      tx.isApproved = true;
      if (!tx.approvedBy && approvalData?.approvedBy) tx.approvedBy = approvalData.approvedBy;
      if (!tx.approvedAt && approvalData?.approvedAt) tx.approvedAt = approvalData.approvedAt;
    }
    if (!tx.boxId) {
      if (tx.categoryId === 'cat-ent-3' || tx.categoryId === 'cat-sai-1' || 
          (tx.description && (tx.description.toLowerCase().includes('revista') || tx.description.toLowerCase().includes('lição') || tx.description.toLowerCase().includes('licao')))) {
        tx.boxId = 'CAIXA_LICOES';
      } else {
        tx.boxId = 'CAIXA_5_EBD';
      }
    }
    result.push(tx);
  });

  return result.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.id.replace('tx-', '')).getTime();
    const timeB = new Date(b.createdAt || b.id.replace('tx-', '')).getTime();
    return timeB - timeA;
  });
};

const mergeUsers = (
  local: any[], 
  remote: any[], 
  deletedUsernames?: Set<string>,
  editedUsers?: Map<string, { role: UserRole; name: string }>
): any[] => {
  const map = new Map<string, any>();
  
  // Helper to find pending edits case-insensitively in the Map
  const getPendingEdit = (email: string) => {
    if (!editedUsers) return null;
    const clean = email.toLowerCase().trim();
    for (const [k, v] of editedUsers.entries()) {
      if (k.toLowerCase().trim() === clean) {
        return v;
      }
    }
    return null;
  };

  // 1. Put remote users in first (they are the absolute source of truth for any loaded database snapshot)
  if (Array.isArray(remote)) {
    remote.forEach(u => {
      if (u && u.username) {
        const key = u.username.toLowerCase().trim();
        if (!deletedUsernames || !deletedUsernames.has(key)) {
          let mergedUser = { ...u };
          // Prioritize active administrative edits over the remote snapshot
          const edit = getPendingEdit(key);
          if (edit) {
            mergedUser.role = edit.role;
            mergedUser.name = edit.name;
            mergedUser.avatarColor = edit.role === 'MASTER' ? 'bg-indigo-900' : edit.role === 'TESOUREIRO' ? 'bg-blue-600' : edit.role === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500';
          }
          map.set(key, mergedUser);
        }
      }
    });
  }
  
  // 2. Put local users in second ONLY if they do NOT exist in remote (to preserve newly registered/signed-up users before Firestore snapshot catches up)
  if (Array.isArray(local)) {
    local.forEach(u => {
      if (u && u.username) {
        const key = u.username.toLowerCase().trim();
        if (!deletedUsernames || !deletedUsernames.has(key)) {
          if (!map.has(key)) {
            let mergedUser = { ...u };
            const edit = getPendingEdit(key);
            if (edit) {
              mergedUser.role = edit.role;
              mergedUser.name = edit.name;
              mergedUser.avatarColor = edit.role === 'MASTER' ? 'bg-indigo-900' : edit.role === 'TESOUREIRO' ? 'bg-blue-600' : edit.role === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500';
            }
            map.set(key, mergedUser);
          } else {
            // Keep remote user's role and details to prevent stale/optimistic local client states (like default localStorage values)
            // from overriding the authorized Firestore roles on page load/refresh.
            // The ONLY exception: if local user transitioned from a placeholder ID (fb-invite-) to a real Firebase ID, we can update the ID, but NOT the role/details.
            const remoteUser = map.get(key);
            
            // If we have an active edit, don't overwrite with remote ID unless necessary
            let finalId = remoteUser.id;
            if (u.id !== remoteUser.id && u.id.startsWith('fb-') && !u.id.startsWith('fb-invite-') && remoteUser.id.startsWith('fb-invite-')) {
              finalId = u.id;
            }
            
            const finalUser = {
              ...remoteUser,
              id: finalId
            };
            
            // Re-apply the active edit on top of merged remote/local just in case
            const edit = getPendingEdit(key);
            if (edit) {
              finalUser.role = edit.role;
              finalUser.name = edit.name;
              finalUser.avatarColor = edit.role === 'MASTER' ? 'bg-indigo-900' : edit.role === 'TESOUREIRO' ? 'bg-blue-600' : edit.role === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500';
            }
            
            map.set(key, finalUser);
          }
        }
      }
    });
  }
  
  return Array.from(map.values());
};

const mergeArraysById = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
  const map = new Map<string, T>();
  if (Array.isArray(remote)) remote.forEach(item => map.set(item.id, item));
  if (Array.isArray(local)) {
    local.forEach(item => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });
  }
  return Array.from(map.values());
};

const mergeClosings = (local: ClosingType[], remote: ClosingType[]): ClosingType[] => {
  const map = new Map<string, ClosingType>();
  if (Array.isArray(remote)) remote.forEach(c => map.set(c.id, c));
  if (Array.isArray(local)) {
    local.forEach(c => {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      }
    });
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
};

const mergeAuditLogs = (local: AuditLog[], remote: AuditLog[]): AuditLog[] => {
  const map = new Map<string, AuditLog>();
  if (Array.isArray(remote)) remote.forEach(l => map.set(l.id, l));
  if (Array.isArray(local)) {
    local.forEach(l => {
      if (!map.has(l.id)) {
        map.set(l.id, l);
      }
    });
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const registerUserProfileInFirestore = async (fbUser: any): Promise<void> => {
  const emailLower = fbUser.email?.toLowerCase().trim() || '';
  if (!emailLower) return;

  try {
    const docRef = doc(db, "ebd_states", "shared_church_ebd");
    
    // Fetch latest remote document directly from the server to avoid local cache collisions
    let docSnap;
    try {
      docSnap = await getDocFromServer(docRef);
    } catch (srvErr) {
      console.warn("getDocFromServer failed in registration, falling back to standard getDoc:", srvErr);
      docSnap = await getDoc(docRef);
    }
    
    let assignedRole: UserRole = 'VISITANTE';
    let displayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Membro';

    if (
      emailLower === 'vitorleonardoc@gmail.com' || 
      emailLower === 'vitorleonardocl@gmail.com' || 
      emailLower === 'vitorleonardocl@gmail.com.br' ||
      emailLower === 'vlcl@poli.br' ||
      emailLower === 'eduardasoares86617@gmail.com'
    ) {
      assignedRole = 'MASTER';
      displayName = emailLower === 'eduardasoares86617@gmail.com' ? 'Eduarda Soares' : 'Vitor Leonardo';
    } else if (emailLower === 'marcoswlima.adv@gmail.com') {
      assignedRole = 'DIRIGENTE';
      displayName = 'Marcos Lima';
    }

    const getRoleAvatarColor = (r: UserRole) => {
      switch (r) {
        case 'MASTER': return 'bg-indigo-900';
        case 'DIRIGENTE': return 'bg-emerald-600';
        case 'TESOUREIRO': return 'bg-blue-600';
        default: return 'bg-slate-500';
      }
    };

    const newUserProfile = {
      id: `fb-${fbUser.uid}`,
      name: displayName,
      username: emailLower,
      role: assignedRole,
      avatarColor: getRoleAvatarColor(assignedRole)
    };

    if (docSnap.exists()) {
      const savedState = docSnap.data();
      const remoteUsers = savedState.users || [];
      const deletedEmails = savedState.deletedEmails || [];
      const isDeleted = deletedEmails.some((e: string) => e && e.toLowerCase().trim() === emailLower);

      // If they were explicitly deleted, skip auto-registration unless they are MASTER
      if (isDeleted && assignedRole !== 'MASTER') {
        console.log(`[Firebase Register] User ${emailLower} is in deleted/blocked list. Skipping auto-registration.`);
        return;
      }

      const existingUserIndex = remoteUsers.findIndex((u: any) => u && u.username && u.username.toLowerCase().trim() === emailLower);

      if (existingUserIndex === -1) {
        console.log(`[Firebase Register] Registrando usuário ${emailLower} atomicamente via updateDoc...`);
        await updateDoc(docRef, {
          users: arrayUnion(newUserProfile)
        });
        console.log(`[Firebase Register] Usuário ${emailLower} registrado com sucesso em Firestore.`);
      } else {
        const existingUser = remoteUsers[existingUserIndex];
        // If the existing user was a pre-registered invite or has a different ID, update their ID and details to their real Firebase credentials
        if (existingUser.id.startsWith('fb-invite-') || existingUser.id !== `fb-${fbUser.uid}`) {
          console.log(`[Firebase Register] Atualizando ID/perfil de convite de ${emailLower} para UID do Firebase...`);
          const updatedUsers = [...remoteUsers];
          updatedUsers[existingUserIndex] = {
            ...existingUser,
            id: `fb-${fbUser.uid}`,
            name: fbUser.displayName || existingUser.name,
            avatarColor: existingUser.role === 'MASTER' ? 'bg-indigo-900' : 'bg-slate-500'
          };
          await updateDoc(docRef, {
            users: updatedUsers
          });
          console.log(`[Firebase Register] ID do usuário ${emailLower} atualizado com sucesso no Firestore.`);
        } else {
          console.log(`[Firebase Register] Usuário ${emailLower} já está registrado com UID correto.`);
        }
      }
    } else {
      // If the document doesn't exist, we only call setDoc if the user registering is a MASTER user.
      // This protects the database from accidental resets due to transient read failures.
      if (assignedRole === 'MASTER') {
        console.log(`[Firebase Register] Documento não existe. Inicializando com o primeiro usuário MASTER: ${emailLower}...`);
        const defaultState = getInitialState();
        defaultState.users = [newUserProfile];
        const stateToSave = {
          ...defaultState,
          currentUser: null,
          updatedAt: new Date().toISOString()
        };
        await setDoc(docRef, stateToSave);
        console.log(`[Firebase Register] Documento inicializado com o usuário MASTER ${emailLower}.`);
      } else {
        console.warn(`[Firebase Register] Documento não encontrado no Firestore e o usuário não é MASTER. Ignorando inicialização para evitar riscos de sobrescrever dados.`);
      }
    }
  } catch (err) {
    console.error(`[Firebase Register] Erro no registro de perfil para ${emailLower}:`, err);
  }
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const initial = getInitialState();
    if (initial.users) {
      initial.users = initial.users.filter(u => !['usr1', 'usr2', 'usr3', 'usr4'].includes(u.id));
    }
    return initial;
  });

  // Bulletproof state deduplication and sync-loop prevention string
  const lastSyncStringRef = useRef<string>('');

  // Gate to prevent local stale state from overwriting Firestore during connection
  const hasLoadedFromFirestoreRef = useRef<boolean>(false);

  // Keep track of users explicitly deleted by the Master to prevent them from being brought back in snap merges
  const deletedUsernamesRef = useRef<Set<string>>((() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ebd_deleted_usernames');
        return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
      } catch (e) {
        console.warn("Failed to load deletedUsernamesRef from localStorage:", e);
      }
    }
    return new Set<string>();
  })());

  // Keep track of active role/name modifications to prevent in-flight Firestore snapshots from reverting edits
  const editedUsersRef = useRef<Map<string, { role: UserRole; name: string }>>((() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ebd_edited_users');
        return saved ? new Map<string, { role: UserRole; name: string }>(JSON.parse(saved)) : new Map<string, { role: UserRole; name: string }>();
      } catch (e) {
        console.warn("Failed to load editedUsersRef from localStorage:", e);
      }
    }
    return new Map<string, { role: UserRole; name: string }>();
  })());

  // Keep track of approved transactions to guarantee "once approved, ALWAYS approved" and prevent race conditions from reverting approvals
  const approvedTransactionsRef = useRef<Map<string, { approvedBy?: string; approvedAt?: string }>>((() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ebd_approved_transactions');
        return saved ? new Map<string, { approvedBy?: string; approvedAt?: string }>(JSON.parse(saved)) : new Map();
      } catch (e) {
        console.warn("Failed to load approvedTransactionsRef from localStorage:", e);
      }
    }
    return new Map();
  })());

  const saveAdministrativeRefs = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ebd_deleted_usernames', JSON.stringify(Array.from(deletedUsernamesRef.current)));
        localStorage.setItem('ebd_edited_users', JSON.stringify(Array.from(editedUsersRef.current.entries())));
        localStorage.setItem('ebd_approved_transactions', JSON.stringify(Array.from(approvedTransactionsRef.current.entries())));
      } catch (e) {
        console.warn("Failed to save administrative refs to localStorage:", e);
      }
    }
  };

  // Connection and loading states
  const [isConnectingAuth, setIsConnectingAuth] = useState<boolean>(() => {
    // If there is no active session flag in localStorage, bypass the full-screen loading blocker on mount.
    // This allows the login form to render instantly in 0ms, making the app incredibly fast!
    return localStorage.getItem('ebd_has_session') === 'true';
  });
  
  // Login and Cloud state
  const [loginError, setLoginError] = useState<string | null>(null);
  const [syncingFirestore, setSyncingFirestore] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Google Authentication states
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [showGoogleRoleModal, setShowGoogleRoleModal] = useState(false);
  const [googleProfileData, setGoogleProfileData] = useState<{
    id: string;
    name: string;
    email: string;
    picture: string;
  } | null>(null);

  // Cloud Firestore Error State
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  // Role simulation state for Master
  const [simulationRole, setSimulationRole] = useState<UserRole | null>(null);

  // Shell Layout tab routing
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modal overlays
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);
  const [activeAta, setActiveAta] = useState<ClosingType | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sync state changes instantly to localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Handle Google Redirect login results on mobile mount
  useEffect(() => {
    let isMounted = true;
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && isMounted) {
          console.log("Sucesso ao recuperar resultado de login por redirecionamento:", result.user);
        }
      } catch (error: any) {
        if (isMounted) {
          console.error("Erro ao recuperar resultado de login por redirecionamento:", error);
          const friendlyMsg = getFriendlyFirebaseError(error.code || error.message);
          setLoginError(`Erro no retorno do redirecionamento Google: ${friendlyMsg}`);
        }
      } finally {
        if (isMounted) {
          setIsConnectingAuth(false);
        }
      }
    };
    checkRedirectResult();

    // Safety timeout to ensure loading screen never hangs on mobile/desktop
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsConnectingAuth(false);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Synchronize active authentication state changes and roles with real-time Firestore sync
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        localStorage.setItem('ebd_has_session', 'true');
        
        // Robust background registration of the logged-in user profile
        registerUserProfileInFirestore(fbUser);

        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }

        // OPTIMISTIC LOGIN LOAD: Configure current user optimistically and hide spinner instantly!
        const emailLower = fbUser.email?.toLowerCase().trim() || '';
        let assignedRole: UserRole = 'VISITANTE';
        let userDisplayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Membro';

        if (
          emailLower === 'vitorleonardoc@gmail.com' || 
          emailLower === 'vitorleonardocl@gmail.com' || 
          emailLower === 'vitorleonardocl@gmail.com.br' ||
          emailLower === 'vlcl@poli.br' ||
          emailLower === 'eduardasoares86617@gmail.com'
        ) {
          assignedRole = 'MASTER';
          userDisplayName = emailLower === 'eduardasoares86617@gmail.com' ? 'Eduarda Soares' : 'Vitor Leonardo';
        } else if (emailLower === 'marcoswlima.adv@gmail.com') {
          assignedRole = 'DIRIGENTE';
          userDisplayName = 'Marcos Lima';
        }

        setState(current => {
          if (current.currentUser && current.currentUser.username === emailLower) {
            return current;
          }
          const updatedState = { ...current };
          const registeredUser = updatedState.users.find(u => u && u.username && u.username.toLowerCase().trim() === emailLower);
          if (registeredUser) {
            if (assignedRole !== 'MASTER') {
              assignedRole = registeredUser.role;
            }
            userDisplayName = registeredUser.name;
          }
          updatedState.currentUser = {
            id: `fb-${fbUser.uid}`,
            name: userDisplayName,
            username: fbUser.email || '',
            role: assignedRole,
            avatarColor: assignedRole === 'MASTER' ? 'bg-indigo-900' : assignedRole === 'TESOUREIRO' ? 'bg-blue-600' : assignedRole === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500'
          };
          return updatedState;
        });

        // Instantly hide the loading screen so the app loads in milliseconds
        setIsConnectingAuth(false);

        try {
          const docRef = doc(db, "ebd_states", "shared_church_ebd");
          unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
            try {
              // Unblock and enable Firestore syncing once the first snapshot arrives
              hasLoadedFromFirestoreRef.current = true;
              setIsConnectingAuth(false);
              setFirebaseError(null); // Clear any previous error on success!

              if (docSnap.exists()) {
                const savedState = docSnap.data();

                // Atomic registration guard to guarantee new logins are recorded in Firestore immediately
                const emailLowerForReg = fbUser.email?.toLowerCase().trim() || '';
                const remoteUsersForReg = savedState.users || [];
                const deletedEmailsForReg = savedState.deletedEmails || [];
                const isAlreadyRegisteredInFirestore = remoteUsersForReg.some((u: any) => u && u.username && u.username.toLowerCase().trim() === emailLowerForReg);
                const isDeletedForReg = deletedEmailsForReg.some((e: string) => e && e.toLowerCase().trim() === emailLowerForReg);

                let assignedRoleForReg: UserRole = 'VISITANTE';
                let displayNameForReg = fbUser.displayName || fbUser.email?.split('@')[0] || 'Membro';

                if (
                  emailLowerForReg === 'vitorleonardoc@gmail.com' || 
                  emailLowerForReg === 'vitorleonardocl@gmail.com' || 
                  emailLowerForReg === 'vitorleonardocl@gmail.com.br' ||
                  emailLowerForReg === 'vlcl@poli.br' ||
                  emailLowerForReg === 'eduardasoares86617@gmail.com'
                ) {
                  assignedRoleForReg = 'MASTER';
                  displayNameForReg = emailLowerForReg === 'eduardasoares86617@gmail.com' ? 'Eduarda Soares' : 'Vitor Leonardo';
                } else if (emailLowerForReg === 'marcoswlima.adv@gmail.com') {
                  assignedRoleForReg = 'DIRIGENTE';
                  displayNameForReg = 'Marcos Lima';
                }

                if (!isAlreadyRegisteredInFirestore && emailLowerForReg && (!isDeletedForReg || assignedRoleForReg === 'MASTER')) {
                  const newUserProfile = {
                    id: `fb-${fbUser.uid}`,
                    name: displayNameForReg,
                    username: emailLowerForReg,
                    role: assignedRoleForReg,
                    avatarColor: assignedRoleForReg === 'MASTER' ? 'bg-indigo-900' : 'bg-slate-500'
                  };

                  console.log(`[Firebase Auth] Registering user ${emailLowerForReg} atomically into Firestore...`);
                  updateDoc(docRef, {
                    users: arrayUnion(newUserProfile)
                  }).then(() => {
                    console.log(`[Firebase Auth] Successfully registered ${emailLowerForReg} in Firestore.`);
                  }).catch(err => {
                    console.error("Error with atomic registration of user profile:", err);
                  });
                }

                setState(current => {
                  const updatedState = { ...current };

                  // Track deleted emails from Firestore unconditionally to ensure they remain deleted across devices
                  if (savedState.deletedEmails && Array.isArray(savedState.deletedEmails)) {
                    savedState.deletedEmails.forEach((e: string) => {
                      if (e) {
                        deletedUsernamesRef.current.add(e.toLowerCase().trim());
                      }
                    });
                    saveAdministrativeRefs();
                  }
                  
                  // Read and track deleted ID lists to keep types/states aligned
                  const deletedTxIds = new Set<string>(savedState.deletedTransactionIds || []);
                  const deletedCId = new Set<string>(savedState.deletedClosingIds || []);
                  const deletedPId = new Set<string>(savedState.deletedPeopleIds || []);

                  if (current.deletedTransactionIds) {
                    current.deletedTransactionIds.forEach(id => deletedTxIds.add(id));
                  }
                  if (current.deletedClosingIds) {
                    current.deletedClosingIds.forEach(id => deletedCId.add(id));
                  }
                  if (current.deletedPeopleIds) {
                    current.deletedPeopleIds.forEach(id => deletedPId.add(id));
                  }

                  updatedState.deletedTransactionIds = Array.from(deletedTxIds);
                  updatedState.deletedClosingIds = Array.from(deletedCId);
                  updatedState.deletedPeopleIds = Array.from(deletedPId);

                  // Set lists directly from the Firestore remote source of truth, completely eliminating resurrection bugs!
                  if (savedState.categories && Array.isArray(savedState.categories)) {
                    updatedState.categories = [...savedState.categories];
                  }
                  // Ensure all INITIAL_CATEGORIES are present in the list
                  INITIAL_CATEGORIES.forEach((initCat: any) => {
                    if (!updatedState.categories.some(c => c.id === initCat.id)) {
                      updatedState.categories.push(initCat);
                    }
                  });

                  if (savedState.transactions && Array.isArray(savedState.transactions)) {
                    // Record all remote approved transactions into our approvedTransactionsRef
                    let hasNewApproved = false;
                    savedState.transactions.forEach((t: any) => {
                      if (t && t.id && t.isApproved) {
                        if (!approvedTransactionsRef.current.has(t.id)) {
                          approvedTransactionsRef.current.set(t.id, {
                            approvedBy: t.approvedBy,
                            approvedAt: t.approvedAt
                          });
                          hasNewApproved = true;
                        }
                      }
                    });
                    if (hasNewApproved) {
                      saveAdministrativeRefs();
                    }

                    // Smart non-destructive merge: start with remote, merge with current local state
                    const txMap = new Map<string, any>();
                    
                    savedState.transactions.forEach((rt: any) => {
                      if (rt && rt.id && !deletedTxIds.has(rt.id)) {
                        txMap.set(rt.id, { ...rt });
                      }
                    });

                    (current.transactions || []).forEach((lt: any) => {
                      if (lt && lt.id && !deletedTxIds.has(lt.id)) {
                        if (!txMap.has(lt.id)) {
                          txMap.set(lt.id, { ...lt });
                        } else {
                          const remoteTx = txMap.get(lt.id);
                          const isApproved = remoteTx.isApproved === true || lt.isApproved === true || approvedTransactionsRef.current.has(lt.id);
                          const approval = approvedTransactionsRef.current.get(lt.id);
                          txMap.set(lt.id, {
                            ...remoteTx,
                            ...lt,
                            isApproved,
                            approvedBy: isApproved ? (lt.approvedBy || remoteTx.approvedBy || approval?.approvedBy) : undefined,
                            approvedAt: isApproved ? (lt.approvedAt || remoteTx.approvedAt || approval?.approvedAt) : undefined,
                            attachment: lt.attachment || remoteTx.attachment,
                            signature: lt.signature || remoteTx.signature
                          });
                        }
                      }
                    });

                    updatedState.transactions = Array.from(txMap.values())
                      .map((t: any) => {
                        let boxId = t.boxId;
                        if (!boxId) {
                          if (t.categoryId === 'cat-ent-3' || t.categoryId === 'cat-sai-1' || 
                              (t.description && (t.description.toLowerCase().includes('revista') || t.description.toLowerCase().includes('lição') || t.description.toLowerCase().includes('licao')))) {
                            boxId = 'CAIXA_LICOES';
                          } else {
                            boxId = 'CAIXA_5_EBD';
                          }
                        }
                        const isApproved = t.isApproved === true || approvedTransactionsRef.current.has(t.id);
                        const approval = approvedTransactionsRef.current.get(t.id);
                        return {
                          ...t,
                          boxId,
                          amount: typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0,
                          isApproved,
                          approvedBy: isApproved ? (t.approvedBy || approval?.approvedBy) : undefined,
                          approvedAt: isApproved ? (t.approvedAt || approval?.approvedAt) : undefined
                        };
                      })
                      .sort((a: any, b: any) => {
                        const timeA = new Date(a.createdAt || a.id.replace('tx-', '')).getTime();
                        const timeB = new Date(b.createdAt || b.id.replace('tx-', '')).getTime();
                        return timeB - timeA;
                      });
                  }
                  
                  if (savedState.people && Array.isArray(savedState.people)) {
                    updatedState.people = savedState.people.filter((p: any) => p && p.id && !deletedPId.has(p.id));
                  }

                  if (savedState.closings && Array.isArray(savedState.closings)) {
                    updatedState.closings = savedState.closings
                      .filter((c: any) => c && c.id && !deletedCId.has(c.id))
                      .sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
                  }

                  if (savedState.auditLogs && Array.isArray(savedState.auditLogs)) {
                    updatedState.auditLogs = [...savedState.auditLogs]
                      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 200);
                  }

                  // Recalculate box balances automatically based on the remote transactions list to ensure 100% mathematical consistency
                  updatedState.boxes = recalculateBalances(updatedState);
                  
                  // Save state locally to keep localStorage in sync with cloud snapshot
                  saveState(updatedState);
                  const emailLower = fbUser.email?.toLowerCase().trim() || '';
                  if (savedState.users && Array.isArray(savedState.users)) {
                    // Clear pending edit flags if the remote state has caught up with our local edit
                    let clearedAnyEdit = false;
                    savedState.users.forEach((remoteUser: any) => {
                      if (remoteUser && remoteUser.username) {
                        const key = remoteUser.username.toLowerCase().trim();
                        const pendingEdit = editedUsersRef.current.get(key);
                        if (pendingEdit && remoteUser.role === pendingEdit.role && remoteUser.name === pendingEdit.name) {
                          editedUsersRef.current.delete(key);
                          clearedAnyEdit = true;
                        }
                      }
                    });
                    if (clearedAnyEdit) {
                      saveAdministrativeRefs();
                    }

                    updatedState.users = mergeUsers(
                      current.users || [], 
                      savedState.users, 
                      deletedUsernamesRef.current,
                      editedUsersRef.current
                    );
                  }

                  // Check if currently authenticated user email's role has changed in the user list
                  let assignedRole: UserRole = 'VISITANTE';
                  let userDisplayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Membro';

                  if (
                    emailLower === 'vitorleonardoc@gmail.com' || 
                    emailLower === 'vitorleonardocl@gmail.com' || 
                    emailLower === 'vitorleonardocl@gmail.com.br' ||
                    emailLower === 'vlcl@poli.br' ||
                    emailLower === 'eduardasoares86617@gmail.com'
                  ) {
                    assignedRole = 'MASTER';
                    userDisplayName = emailLower === 'eduardasoares86617@gmail.com' ? 'Eduarda Soares' : 'Vitor Leonardo';
                  } else if (emailLower === 'marcoswlima.adv@gmail.com') {
                    assignedRole = 'DIRIGENTE';
                    userDisplayName = 'Marcos Lima';
                  }

                  const registeredUserIndex = updatedState.users.findIndex(u => u && u.username && u.username.toLowerCase().trim() === emailLower);
                  if (registeredUserIndex >= 0) {
                    const registeredUser = { ...updatedState.users[registeredUserIndex] };
                    if (assignedRole !== 'MASTER') {
                      assignedRole = registeredUser.role;
                    }
                    userDisplayName = registeredUser.name;

                    // Update their ID in the synced users list to reflect their real Firebase UID
                    if (registeredUser.id.startsWith('fb-invite-')) {
                      registeredUser.id = `fb-${fbUser.uid}`;
                    }
                    updatedState.users[registeredUserIndex] = registeredUser;
                  } else {
                    // Add them automatically to state.users so they show up in UsersManagement for administration
                    const newUserObj = {
                      id: `fb-${fbUser.uid}`,
                      name: userDisplayName,
                      username: emailLower,
                      role: assignedRole,
                      avatarColor: assignedRole === 'MASTER' ? 'bg-indigo-900' : 'bg-slate-500'
                    };
                    updatedState.users.push(newUserObj);
                  }

                  // If this is the initial login transition, route to correct default tab
                  if (!current.currentUser) {
                    setTimeout(() => {
                      setActiveTab('dashboard');
                    }, 0);
                  }

                  // Update context user session to align with the database
                  updatedState.currentUser = {
                    id: `fb-${fbUser.uid}`,
                    name: userDisplayName,
                    username: fbUser.email || '',
                    role: assignedRole,
                    avatarColor: assignedRole === 'MASTER' ? 'bg-indigo-900' : assignedRole === 'TESOUREIRO' ? 'bg-blue-600' : assignedRole === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500'
                  };

                  // Normalize and serialize the incoming remote database state to set as the sync reference string.
                  // This ensures that any local auto-additions or offline merges (like newly logged-in visitor users)
                  // differ from the remote state and are successfully written back to Firestore!
                  const normalizedRemote = {
                    boxes: savedState.boxes || [],
                    categories: savedState.categories || [],
                    transactions: savedState.transactions || [],
                    people: savedState.people || [],
                    closings: savedState.closings || [],
                    auditLogs: savedState.auditLogs || [],
                    users: savedState.users || []
                  };
                  lastSyncStringRef.current = JSON.stringify(normalizedRemote);

                  return updatedState;
                });
              } else {
                console.log("No shared church EBD document found in Firestore. Initializing with local state...");
                // Initialize with default state
                const defaultState = getInitialState();
                saveStateToFirestore(fbUser.uid, defaultState).then(() => {
                  console.log("Firestore state successfully initialized on-demand.");
                }).catch(err => {
                  console.error("Failed to initialize Firestore state on-demand:", err);
                });

                // Log user in locally to avoid hanging login page
                setState(current => {
                  const updatedState = { ...current };
                  const emailLower = fbUser.email?.toLowerCase().trim() || '';
                  let assignedRole: UserRole = 'VISITANTE';
                  let userDisplayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Membro';

                  if (
                    emailLower === 'vitorleonardoc@gmail.com' || 
                    emailLower === 'vitorleonardocl@gmail.com' || 
                    emailLower === 'vitorleonardocl@gmail.com.br' ||
                    emailLower === 'vlcl@poli.br' ||
                    emailLower === 'eduardasoares86617@gmail.com'
                  ) {
                    assignedRole = 'MASTER';
                    userDisplayName = emailLower === 'eduardasoares86617@gmail.com' ? 'Eduarda Soares' : 'Vitor Leonardo';
                  } else if (emailLower === 'marcoswlima.adv@gmail.com') {
                    assignedRole = 'DIRIGENTE';
                    userDisplayName = 'Marcos Lima';
                  }

                  const registeredUserIndex = updatedState.users.findIndex(u => u && u.username && u.username.toLowerCase().trim() === emailLower);
                  if (registeredUserIndex >= 0) {
                    const registeredUser = updatedState.users[registeredUserIndex];
                    if (assignedRole !== 'MASTER') {
                      assignedRole = registeredUser.role;
                    }
                    userDisplayName = registeredUser.name;
                  } else {
                    const newUserObj = {
                      id: `fb-${fbUser.uid}`,
                      name: userDisplayName,
                      username: emailLower,
                      role: assignedRole,
                      avatarColor: assignedRole === 'MASTER' ? 'bg-indigo-900' : 'bg-slate-500'
                    };
                    updatedState.users.push(newUserObj);
                  }

                  if (!current.currentUser) {
                    setTimeout(() => {
                      setActiveTab('dashboard');
                    }, 0);
                  }

                  updatedState.currentUser = {
                    id: `fb-${fbUser.uid}`,
                    name: userDisplayName,
                    username: fbUser.email || '',
                    role: assignedRole,
                    avatarColor: assignedRole === 'MASTER' ? 'bg-indigo-900' : assignedRole === 'TESOUREIRO' ? 'bg-blue-600' : assignedRole === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500'
                  };

                  // Normalize and serialize the newly initialized state to set as the sync reference string
                  const normalizedCurrent = {
                    boxes: updatedState.boxes || [],
                    categories: updatedState.categories || [],
                    transactions: updatedState.transactions || [],
                    people: updatedState.people || [],
                    closings: updatedState.closings || [],
                    auditLogs: updatedState.auditLogs || [],
                    users: updatedState.users || []
                  };
                  lastSyncStringRef.current = JSON.stringify(normalizedCurrent);

                  return updatedState;
                });

                // Also immediately set loading flags to false so user is unblocked
                hasLoadedFromFirestoreRef.current = true;
                setIsConnectingAuth(false);
              }
            } catch (snapErr) {
              console.error("Critical error in onSnapshot success callback:", snapErr);
            }
          }, (err: any) => {
            console.error("Erro no listener de Firestore onSnapshot:", err);
            setIsConnectingAuth(false);
            
            const msg = err.message || '';
            const msgLower = msg.toLowerCase();
            const isPermissionError = 
              err.code === "permission-denied" || 
              msg.includes("PERMISSION_DENIED") || 
              msg.includes("permission-denied") || 
              msgLower.includes("permission") || 
              msgLower.includes("insufficient");

            if (isPermissionError || msgLower.includes("api has not been used") || msgLower.includes("disabled")) {
              if (msgLower.includes("api has not been used") || msgLower.includes("disabled")) {
                setFirebaseError("API do Firestore desativada no seu Google Cloud Console. Ative para sincronizar!");
              } else {
                setFirebaseError("Permissão negada ao acessar o banco de dados. Crie o Firestore em modo de teste ou verifique as regras.");
              }
            } else if (err.code === "unavailable" || msgLower.includes("offline")) {
              setFirebaseError("O Firestore está offline ou inacessível. Usando armazenamento local temporário.");
            } else {
              setFirebaseError(`Erro ao sincronizar Nuvem: ${msg}`);
            }
          });
        } catch (err) {
          console.error("Erro ao sincronizar login ativo com Firestore:", err);
          setIsConnectingAuth(false);
        }
      } else {
        localStorage.removeItem('ebd_has_session');
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setIsConnectingAuth(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  // Sync state changes durably to Google Firestore if a Firebase User is logged in
  useEffect(() => {
    // Prevent syncing back local changes until the first remote snapshot has loaded and been merged
    if (!hasLoadedFromFirestoreRef.current) {
      return;
    }

    const normalizedCurrent = {
      boxes: state.boxes || [],
      categories: state.categories || [],
      transactions: state.transactions || [],
      people: state.people || [],
      closings: state.closings || [],
      auditLogs: state.auditLogs || [],
      users: state.users || []
    };
    const currentStr = JSON.stringify(normalizedCurrent);

    if (currentStr === lastSyncStringRef.current) {
      return;
    }

    if (state.currentUser && state.currentUser.id.startsWith('fb-') && state.currentUser.role !== 'VISITANTE') {
      const fbUserId = state.currentUser.id.replace('fb-', '');
      setSyncingFirestore(true);
      const timer = setTimeout(() => {
        lastSyncStringRef.current = currentStr;
        saveStateToFirestore(fbUserId, state, Array.from(deletedUsernamesRef.current), Object.fromEntries(editedUsersRef.current))
          .then(() => {
            setLastSyncedTime(new Date().toLocaleTimeString());
          })
          .catch(e => console.error("Erro ao sincronizar com Firestore:", e))
          .finally(() => {
            setSyncingFirestore(false);
          });
      }, 800); // debounce saves to prevent spamming
      return () => clearTimeout(timer);
    }
  }, [state]);

  // Handle local system backups
  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `EBD_Backup_Financeiro_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();

    // Log the backup download in audit trail
    const updatedState = { ...state };
    addAuditLog(updatedState, 'Backup de Sistema', 'Efetuou download de arquivo completo de seguranca local.');
    setState(updatedState);
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.users && parsed.boxes && parsed.transactions) {
            const updatedState: AppState = {
              ...parsed,
              currentUser: state.currentUser // Maintain current session
            };
            addAuditLog(updatedState, 'Restauracao de Backup', 'Backup de seguranca local restaurado com sucesso.');
            setState(updatedState);
            alert('Backup restaurado e consolidado com sucesso!');
          } else {
            alert('Arquivo inválido. Formato incompatível com o sistema financeiro EBD.');
          }
        } catch {
          alert('Erro de processamento d arquivo JSON de backup.');
        }
      };
    }
  };

  // Manual synchronization from Firestore to force refresh current local state on-demand
  const handleForceSync = async () => {
    try {
      // Forcefully wake up and re-establish the Firestore connection.
      // This is extremely helpful on mobile carriers when network drops or sleeps.
      try {
        console.log("Forçando reconexão da rede do Firestore via enableNetwork...");
        await enableNetwork(db);
      } catch (netErr) {
        console.warn("Aviso ao restabelecer rede do Firestore:", netErr);
      }

      const docRef = doc(db, "ebd_states", "shared_church_ebd");
      
      // Try fetching directly from the server to bypass stale offline local cache
      let docSnap;
      try {
        console.log("Buscando documento atualizado diretamente do servidor Firestore...");
        docSnap = await getDocFromServer(docRef);
      } catch (srvErr) {
        console.warn("Falha ao buscar do servidor diretamente, tentando getDoc padrão (cache/híbrido)...", srvErr);
        docSnap = await getDoc(docRef);
      }

      if (docSnap.exists()) {
        const savedState = docSnap.data();
        
        // Mark as loaded from Firestore successfully since we got a valid response
        hasLoadedFromFirestoreRef.current = true;
        
        setState(current => {
          const updatedState = { ...current };

          // Track deleted emails from Firestore unconditionally to ensure they remain deleted across devices
          if (savedState.deletedEmails && Array.isArray(savedState.deletedEmails)) {
            savedState.deletedEmails.forEach((e: string) => {
              if (e) {
                deletedUsernamesRef.current.add(e.toLowerCase().trim());
              }
            });
            saveAdministrativeRefs();
          }
          
          // Read and track deleted ID lists to keep types/states aligned
          const deletedTxIds = new Set<string>(savedState.deletedTransactionIds || []);
          const deletedCId = new Set<string>(savedState.deletedClosingIds || []);
          const deletedPId = new Set<string>(savedState.deletedPeopleIds || []);

          if (current.deletedTransactionIds) {
            current.deletedTransactionIds.forEach(id => deletedTxIds.add(id));
          }
          if (current.deletedClosingIds) {
            current.deletedClosingIds.forEach(id => deletedCId.add(id));
          }
          if (current.deletedPeopleIds) {
            current.deletedPeopleIds.forEach(id => deletedPId.add(id));
          }

          updatedState.deletedTransactionIds = Array.from(deletedTxIds);
          updatedState.deletedClosingIds = Array.from(deletedCId);
          updatedState.deletedPeopleIds = Array.from(deletedPId);

          // Set lists directly from the Firestore remote source of truth, completely eliminating resurrection bugs!
          if (savedState.categories && Array.isArray(savedState.categories)) {
            updatedState.categories = [...savedState.categories];
          }
          // Ensure all INITIAL_CATEGORIES are present in the list
          INITIAL_CATEGORIES.forEach((initCat: any) => {
            if (!updatedState.categories.some(c => c.id === initCat.id)) {
              updatedState.categories.push(initCat);
            }
          });

          if (savedState.transactions && Array.isArray(savedState.transactions)) {
            updatedState.transactions = savedState.transactions.filter((t: any) => t && t.id && !deletedTxIds.has(t.id));
          }
          
          if (savedState.people && Array.isArray(savedState.people)) {
            updatedState.people = savedState.people.filter((p: any) => p && p.id && !deletedPId.has(p.id));
          }

          if (savedState.closings && Array.isArray(savedState.closings)) {
            updatedState.closings = savedState.closings.filter((c: any) => c && c.id && !deletedCId.has(c.id));
          }

          if (savedState.auditLogs && Array.isArray(savedState.auditLogs)) {
            updatedState.auditLogs = [...savedState.auditLogs];
          }

          // Recalculate box balances automatically based on the remote transactions list to ensure 100% mathematical consistency
          updatedState.boxes = recalculateBalances(updatedState);
          if (savedState.users && Array.isArray(savedState.users)) {
            // Clear pending edit flags if the remote state has caught up with our local edit
            let clearedAnyEdit = false;
            savedState.users.forEach((remoteUser: any) => {
              if (remoteUser && remoteUser.username) {
                const key = remoteUser.username.toLowerCase().trim();
                const pendingEdit = editedUsersRef.current.get(key);
                if (pendingEdit && remoteUser.role === pendingEdit.role && remoteUser.name === pendingEdit.name) {
                  editedUsersRef.current.delete(key);
                  clearedAnyEdit = true;
                }
              }
            });
            if (clearedAnyEdit) {
              saveAdministrativeRefs();
            }

            updatedState.users = mergeUsers(
              current.users || [], 
              savedState.users, 
              deletedUsernamesRef.current,
              editedUsersRef.current
            );
          }

          // Force check authenticated user
          if (current.currentUser) {
            const emailLower = current.currentUser.username.toLowerCase().trim();
            let assignedRole: UserRole = current.currentUser.role;
            let userDisplayName = current.currentUser.name;

            if (
              emailLower === 'vitorleonardoc@gmail.com' || 
              emailLower === 'vitorleonardocl@gmail.com' || 
              emailLower === 'vitorleonardocl@gmail.com.br' ||
              emailLower === 'vlcl@poli.br' ||
              emailLower === 'eduardasoares86617@gmail.com'
            ) {
              assignedRole = 'MASTER';
              userDisplayName = emailLower === 'eduardasoares86617@gmail.com' ? 'Eduarda Soares' : 'Vitor Leonardo';
            } else if (emailLower === 'marcoswlima.adv@gmail.com') {
              assignedRole = 'DIRIGENTE';
              userDisplayName = 'Marcos Lima';
            }

            const registeredUserIndex = updatedState.users.findIndex(u => u && u.username && u.username.toLowerCase().trim() === emailLower);
            if (registeredUserIndex >= 0) {
              const registeredUser = { ...updatedState.users[registeredUserIndex] };
              if (assignedRole !== 'MASTER') {
                assignedRole = registeredUser.role;
              }
              userDisplayName = registeredUser.name;
              updatedState.users[registeredUserIndex] = registeredUser;
            }

            updatedState.currentUser = {
              ...current.currentUser,
              name: userDisplayName,
              role: assignedRole,
              avatarColor: assignedRole === 'MASTER' ? 'bg-indigo-900' : assignedRole === 'TESOUREIRO' ? 'bg-blue-600' : assignedRole === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500'
            };
          }

          // Update synchronization references to prevent immediate bounce-back loop
          const normalizedRemote = {
            boxes: savedState.boxes || [],
            categories: savedState.categories || [],
            transactions: savedState.transactions || [],
            people: savedState.people || [],
            closings: savedState.closings || [],
            auditLogs: savedState.auditLogs || [],
            users: savedState.users || []
          };
          lastSyncStringRef.current = JSON.stringify(normalizedRemote);

          return updatedState;
        });
      } else {
        throw new Error("O documento da igreja não existe no Firestore.");
      }
    } catch (err) {
      console.error("Erro ao forçar sincronização manual do Firestore:", err);
      throw err;
    }
  };

  // Google Login click handler via Firebase Auth Popup with Redirect fallback
  const handleGoogleLoginClick = async () => {
    setLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection to allow switching between vitorleonardocl@gmail.com and eduardasoares86617@gmail.com
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const isIframe = window.self !== window.top;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Trigger connecting auth to show loading spinner during redirect/popup transition
      setIsConnectingAuth(true);

      if (isIframe) {
        console.log("App carregado dentro de um Iframe. Forçando signInWithPopup...");
        await signInWithPopup(auth, provider);
      } else {
        // Try popup first because it doesn't reload the page and prevents loss of state/session.
        // It works perfectly in most mobile browsers (iOS Safari, Android Chrome) when triggered by a click.
        try {
          console.log("Iniciando login do Google via signInWithPopup...");
          await signInWithPopup(auth, provider);
        } catch (popupError: any) {
          console.warn("signInWithPopup falhou, tentando fallback via signInWithRedirect...", popupError);
          // If the popup was blocked, closed prematurely, or we are on mobile and popup failed, use redirect
          if (
            popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/cancelled-popup-request' ||
            popupError.code === 'auth/popup-closed-by-user' ||
            isMobile
          ) {
            console.log("Acionando fallback do Google via signInWithRedirect...");
            await signInWithRedirect(auth, provider);
          } else {
            setIsConnectingAuth(false);
            throw popupError;
          }
        }
      }
    } catch (error: any) {
      console.error("Erro Google Sign-In via Firebase:", error);
      setIsConnectingAuth(false);
      const friendlyMsg = getFriendlyFirebaseError(error.code || error.message);
      const rawDetails = error.message && error.message !== error.code ? ` (Mensagem técnica: ${error.message})` : '';
      setLoginError(`Erro de Login Google: ${friendlyMsg}${rawDetails}`);
    }
  };

  const getFriendlyFirebaseError = (code: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'O endereço de e-mail fornecido é inválido.';
      case 'auth/user-disabled':
        return 'Este usuário foi desativado.';
      case 'auth/user-not-found':
        return 'Nenhum usuário correspondente encontrado.';
      case 'auth/invalid-credential':
        return 'Credenciais de acesso incorretas ou expiradas.';
      case 'auth/unauthorized-domain':
        return `O domínio "${window.location.hostname}" precisa estar autorizado no console do seu Firebase (${firebaseConfig.projectId}). ` +
          `Acesse o Firebase Console do projeto "${firebaseConfig.projectId}" > Authentication > Settings > Authorized Domains e adicione "${window.location.hostname}" (sem "https://" e sem barra). ` +
          `Lembrete: O Google pode levar até 5 minutos para propagar domínios recém-adicionados.`;
      case 'auth/popup-closed-by-user':
        return 'O popup de autenticação do Google foi fechado antes de concluir o acesso. Por favor, tente novamente e mantenha a janela aberta até a conclusão.';
      case 'auth/cancelled-popup-request':
        return 'A janela popup foi reiniciada.';
      case 'auth/operation-not-allowed':
        return 'O provedor Google não está ativado no Firebase. Ative-o em "Authentication" > "Sign-in method" > "Google" no console do Firebase.';
      case 'auth/popup-blocked':
        return 'O popup de login do Google foi bloqueado pelo seu navegador. Por favor, habilite popups para este site nas configurações do navegador.';
      case 'auth/internal-error':
        return 'Ocorreu um erro interno de conexão com o Firebase. Verifique sua conexão com a internet e tente novamente.';
      default:
        return code;
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('ebd_has_session');
    const updatedState = { ...state };
    if (updatedState.currentUser) {
      addAuditLog(updatedState, 'Logout de Usuario', `Usuario ${updatedState.currentUser.name} encerrou a sessao.`);
    }

    // Sign out from Firebase Auth if logged in
    if (state.currentUser?.id.startsWith('fb-')) {
      firebaseSignOut(auth).catch(e => console.error("Erro logout Firebase:", e));
    }

    updatedState.currentUser = null;
    setState(updatedState);
    setMobileMenuOpen(false);
  };

  // Update state and immediately persist to Google Firestore to prevent any page-refresh data loss or snapshot race conditions
  const updateStateAndPersist = (updatedState: AppState) => {
    setState(updatedState);
    saveState(updatedState); // Immediately persist locally so refresh is always 100% resilient

    if (updatedState.currentUser && updatedState.currentUser.id.startsWith('fb-') && updatedState.currentUser.role !== 'VISITANTE') {
      const fbUserId = updatedState.currentUser.id.replace('fb-', '');
      
      const normalizedCurrent = {
        boxes: updatedState.boxes || [],
        categories: updatedState.categories || [],
        transactions: updatedState.transactions || [],
        people: updatedState.people || [],
        closings: updatedState.closings || [],
        auditLogs: updatedState.auditLogs || [],
        users: updatedState.users || []
      };
      
      lastSyncStringRef.current = JSON.stringify(normalizedCurrent);
      setSyncingFirestore(true);
      
      saveStateToFirestore(fbUserId, updatedState, Array.from(deletedUsernamesRef.current), Object.fromEntries(editedUsersRef.current))
        .then(() => {
          setLastSyncedTime(new Date().toLocaleTimeString());
        })
        .catch(e => console.error("Erro ao sincronizar com Firestore:", e))
        .finally(() => {
          setSyncingFirestore(false);
        });
    }
  };

  // Force-pull fresh canonical state directly from Google Cloud Firestore server
  const handleForceSyncFromFirestore = async () => {
    try {
      setSyncingFirestore(true);
      const userDocRef = doc(db, "ebd_states", "shared_church_ebd");
      let docSnap: any = null;
      try {
        docSnap = await getDocFromServer(userDocRef);
      } catch {
        docSnap = await getDoc(userDocRef);
      }

      if (docSnap && docSnap.exists()) {
        const savedState = docSnap.data();
        const deletedTxIds = new Set<string>(savedState.deletedTransactionIds || []);
        const deletedCId = new Set<string>(savedState.deletedClosingIds || []);
        const deletedPId = new Set<string>(savedState.deletedPeopleIds || []);

        setState(current => {
          const updatedState = { ...current };
          if (savedState.categories && Array.isArray(savedState.categories)) {
            updatedState.categories = [...savedState.categories];
          }
          INITIAL_CATEGORIES.forEach((initCat: any) => {
            if (!updatedState.categories.some(c => c.id === initCat.id)) {
              updatedState.categories.push(initCat);
            }
          });

          if (savedState.transactions && Array.isArray(savedState.transactions)) {
            const txMap = new Map<string, any>();
            
            savedState.transactions.forEach((rt: any) => {
              if (rt && rt.id && !deletedTxIds.has(rt.id)) {
                txMap.set(rt.id, { ...rt });
              }
            });

            (current.transactions || []).forEach((lt: any) => {
              if (lt && lt.id && !deletedTxIds.has(lt.id)) {
                if (!txMap.has(lt.id)) {
                  txMap.set(lt.id, { ...lt });
                } else {
                  const remoteTx = txMap.get(lt.id);
                  const isApproved = remoteTx.isApproved === true || lt.isApproved === true || approvedTransactionsRef.current.has(lt.id);
                  const approval = approvedTransactionsRef.current.get(lt.id);
                  txMap.set(lt.id, {
                    ...remoteTx,
                    ...lt,
                    isApproved,
                    approvedBy: isApproved ? (lt.approvedBy || remoteTx.approvedBy || approval?.approvedBy) : undefined,
                    approvedAt: isApproved ? (lt.approvedAt || remoteTx.approvedAt || approval?.approvedAt) : undefined,
                    attachment: lt.attachment || remoteTx.attachment,
                    signature: lt.signature || remoteTx.signature
                  });
                }
              }
            });

            updatedState.transactions = Array.from(txMap.values())
              .map((t: any) => {
                let boxId = t.boxId;
                if (!boxId) {
                  if (t.categoryId === 'cat-ent-3' || t.categoryId === 'cat-sai-1' || 
                      (t.description && (t.description.toLowerCase().includes('revista') || t.description.toLowerCase().includes('lição') || t.description.toLowerCase().includes('licao')))) {
                    boxId = 'CAIXA_LICOES';
                  } else {
                    boxId = 'CAIXA_5_EBD';
                  }
                }
                const isApproved = t.isApproved === true || approvedTransactionsRef.current.has(t.id);
                const approval = approvedTransactionsRef.current.get(t.id);
                return {
                  ...t,
                  boxId,
                  amount: typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0,
                  isApproved,
                  approvedBy: isApproved ? (t.approvedBy || approval?.approvedBy) : undefined,
                  approvedAt: isApproved ? (t.approvedAt || approval?.approvedAt) : undefined
                };
              })
              .sort((a: any, b: any) => {
                const timeA = new Date(a.createdAt || a.id.replace('tx-', '')).getTime();
                const timeB = new Date(b.createdAt || b.id.replace('tx-', '')).getTime();
                return timeB - timeA;
              });
          }

          if (savedState.people && Array.isArray(savedState.people)) {
            updatedState.people = savedState.people.filter((p: any) => p && p.id && !deletedPId.has(p.id));
          }

          if (savedState.closings && Array.isArray(savedState.closings)) {
            updatedState.closings = savedState.closings
              .filter((c: any) => c && c.id && !deletedCId.has(c.id))
              .sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
          }

          if (savedState.auditLogs && Array.isArray(savedState.auditLogs)) {
            updatedState.auditLogs = [...savedState.auditLogs]
              .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 200);
          }

          if (savedState.users && Array.isArray(savedState.users)) {
            updatedState.users = mergeUsers(
              current.users || [],
              savedState.users,
              deletedUsernamesRef.current,
              editedUsersRef.current
            );
          }

          updatedState.boxes = recalculateBalances(updatedState);
          saveState(updatedState);
          return updatedState;
        });

        setLastSyncedTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Erro ao forçar atualização na nuvem:", err);
    } finally {
      setSyncingFirestore(false);
    }
  };

  // Transaction submission (Secretary or Treasurer)
  const handleAddTransaction = (data: {
    type: 'ENTRADA' | 'SAIDA';
    boxId: BoxId;
    amount: number;
    date: string;
    categoryId: string;
    description: string;
    signature: string;
    attachment?: string;
  }) => {
    const updatedState = { ...state };
    
    // Generate readable transaction code (eg: TX-1009)
    const maxNum = (updatedState.transactions || []).reduce((max, t) => {
      if (t && t.transactionNum && t.transactionNum.startsWith('TX-')) {
        const n = parseInt(t.transactionNum.replace('TX-', ''), 10);
        if (!isNaN(n) && n > max) return n;
      }
      return max;
    }, 1000);
    const nextCode = `TX-${maxNum + 1}`;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      transactionNum: nextCode,
      type: data.type,
      boxId: data.boxId,
      amount: data.amount,
      date: data.date,
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      categoryId: data.categoryId,
      description: data.description,
      responsible: updatedState.currentUser?.name || 'Tesoureiro',
      signature: data.signature,
      createdAt: new Date().toISOString(),
      isApproved: false, // All new transactions require seen/visto/approval before posting to caixa
      approvedBy: undefined,
      approvedAt: undefined,
      attachment: data.attachment
    };

    // Prepend to transaction array
    updatedState.transactions = [newTx, ...updatedState.transactions];
    
    // Refresh final balances automatically
    updatedState.boxes = recalculateBalances(updatedState);
    
    // Check if the current submitter is 'TESOUREIRO' or 'SECRETARIA' and update logs
    addAuditLog(
      updatedState,
      'Inclusão de Movimentação',
      `Cadastrou ${data.type.toLowerCase()} ${nextCode} de R$ ${data.amount.toFixed(2)} pendente de visto eletrônico.`
    );

    updateStateAndPersist(updatedState);
    setActiveReceipt(newTx); // Automatically trigger Comprovante display!
  };

  // Transaction Visto Approval (Dirigente only)
  const handleApproveTransaction = (txId: string) => {
    const activeRole = (simulationRole && state.currentUser?.role === 'MASTER') ? simulationRole : state.currentUser?.role;
    if (activeRole !== 'MASTER' && activeRole !== 'DIRIGENTE') {
      alert("Apenas usuários do tipo MASTER ou DIRIGENTE podem aprovar lançamentos.");
      return;
    }
    const updatedState = { ...state };
    const tx = updatedState.transactions.find(t => t.id === txId);
    
    if (tx) {
      const approverName = updatedState.currentUser?.name || (activeRole === 'MASTER' ? 'Master' : 'Dirigente');
      const approvedAt = new Date().toISOString();

      // Permanent tracking: Once approved, ALWAYS approved!
      approvedTransactionsRef.current.set(txId, {
        approvedBy: approverName,
        approvedAt
      });
      saveAdministrativeRefs();

      // Immutably clone transactions array and replace the approved transaction with a clean clone
      updatedState.transactions = updatedState.transactions.map(t => {
        if (t.id === txId) {
          return {
            ...t,
            isApproved: true,
            approvedBy: approverName,
            approvedAt
          };
        }
        return t;
      });

      // Refresh final balances automatically
      updatedState.boxes = recalculateBalances(updatedState);

      // Audit Log
      addAuditLog(
        updatedState,
        'Aprovação de Movimentação',
        `Aprovou e conciliou o voucher ${tx.transactionNum} no valor de R$ ${tx.amount.toFixed(2)}.`
      );

      updateStateAndPersist(updatedState);
    }
  };

  // Transaction deletion/cancellation handler
  const handleDeleteTransaction = (txId: string) => {
    const updatedState = { ...state };
    const tx = updatedState.transactions.find(t => t.id === txId);
    if (tx) {
      // If deleted, remove from approved tracking
      approvedTransactionsRef.current.delete(txId);
      saveAdministrativeRefs();

      updatedState.transactions = updatedState.transactions.filter(t => t.id !== txId);
      
      if (!updatedState.deletedTransactionIds) {
        updatedState.deletedTransactionIds = [];
      }
      if (!updatedState.deletedTransactionIds.includes(txId)) {
        updatedState.deletedTransactionIds = [...updatedState.deletedTransactionIds, txId];
      }

      // Refresh final balances automatically
      updatedState.boxes = recalculateBalances(updatedState);

      // Audit Log
      addAuditLog(
        updatedState,
        'Exclusão de Lançamento',
        `Excluiu e cancelou o lançamento ${tx.transactionNum} no valor de R$ ${tx.amount.toFixed(2)} (${tx.type.toLowerCase()}).`
      );

      updateStateAndPersist(updatedState);
    }
  };

  // Fund balance transfer handler
  const handleTransferFunds = (data: {
    fromBox: BoxId;
    toBox: BoxId;
    amount: number;
    description: string;
    signature: string;
  }) => {
    const updatedState = { ...state };
    const timeNow = new Date().toTimeString().split(' ')[0].substring(0, 5);
    const dateToday = new Date().toISOString().split('T')[0];

    // Outflow from Box 1
    const lastNum1 = updatedState.transactions.length > 0
      ? parseInt(updatedState.transactions[0].transactionNum.replace('TX-', ''))
      : 1000;
    const txCodeOut = `TX-${lastNum1 + 1}`;
    
    const txOut: Transaction = {
      id: `tx-${Date.now()}-out`,
      transactionNum: txCodeOut,
      type: 'SAIDA',
      boxId: data.fromBox,
      amount: data.amount,
      date: dateToday,
      time: timeNow,
      categoryId: 'cat-sai-6', // Maintenance/Transfer type category placeholder
      description: `[TRANSFERÊNCIA ORIGEM] ${data.description}`,
      responsible: updatedState.currentUser?.name || 'Tesoureiro',
      signature: data.signature,
      createdAt: new Date().toISOString(),
      isApproved: true // Direct transfer is pre-approved by the signatory
    };

    // Inflow to Box 2
    const txIn: Transaction = {
      id: `tx-${Date.now()}-in`,
      transactionNum: `TX-${lastNum1 + 2}`,
      type: 'ENTRADA',
      boxId: data.toBox,
      amount: data.amount,
      date: dateToday,
      time: timeNow,
      categoryId: 'cat-ent-4', // Special donations
      description: `[TRANSFERÊNCIA DESTINO] ${data.description}`,
      responsible: updatedState.currentUser?.name || 'Tesoureiro',
      signature: data.signature,
      createdAt: new Date().toISOString(),
      isApproved: true
    };

    updatedState.transactions = [txIn, txOut, ...updatedState.transactions];
    
    // Recalculate
    updatedState.boxes = recalculateBalances(updatedState);

    // Logging
    addAuditLog(
      updatedState,
      'Transferência de Caixa',
      `Efetuou repasse de R$ ${data.amount.toFixed(2)} de ${data.fromBox === 'CAIXA_5_EBD' ? '5% EBD' : 'Lições'} para ${data.toBox === 'CAIXA_5_EBD' ? '5% EBD' : 'Lições'}.`
    );

    updateStateAndPersist(updatedState);
  };

  // Weekly closing drafting handler (Treasurer)
  const handleAddClosing = (data: {
    startDate: string;
    endDate: string;
    totalInflows: number;
    totalOutflows: number;
    startingBalance: number;
    endingBalance: number;
    comments: string;
    treasurerName: string;
    treasurerSignature: string;
  }) => {
    const updatedState = { ...state };
    
    // Code compilation (eg: FECH-2026-W25)
    const code = `FECH-2026-W${Math.floor(Math.random() * (52 - 26 + 1)) + 26}`;

    const newClosing: ClosingType = {
      id: `clos-${Date.now()}`,
      closingNum: code,
      startDate: data.startDate,
      endDate: data.endDate,
      totalInflows: data.totalInflows,
      totalOutflows: data.totalOutflows,
      startingBalance: data.startingBalance,
      endingBalance: data.endingBalance,
      difference: 0,
      status: 'PENDENTE',
      treasurerName: data.treasurerName,
      treasurerSignature: data.treasurerSignature,
      closedAt: new Date().toISOString()
    };

    updatedState.closings = [newClosing, ...updatedState.closings];

    // Logging
    addAuditLog(
      updatedState,
      'Fechamento Semanal',
      `Redigiu fechamento consolidado ${code} pendente de visto pastoral.`
    );

    updateStateAndPersist(updatedState);
    setActiveAta(newClosing); // Instantly showcase document!
  };

  // Closing clearance seen (Dirigente only)
  const handleApproveClosing = (idxId: string) => {
    const updatedState = { ...state };
    const closing = updatedState.closings.find(c => c.id === idxId);
    
    if (closing && closing.status === 'PENDENTE') {
      closing.status = 'APROVADO';
      closing.dirigenteApprover = updatedState.currentUser?.id;
      closing.dirigenteApprovedAt = new Date().toISOString();

      // Audit Log
      addAuditLog(
        updatedState,
        'Aprovação de Fechamento',
        `Aprovou e referendou o Fechamento Semanal ${closing.closingNum}.`
      );

      updateStateAndPersist(updatedState);
    }
  };

  // Delete closing handler
  const handleDeleteClosing = (closingId: string) => {
    const updatedState = { ...state };
    const closing = updatedState.closings.find(c => c.id === closingId);
    
    if (closing) {
      updatedState.closings = updatedState.closings.filter(c => c.id !== closingId);

      if (!updatedState.deletedClosingIds) {
        updatedState.deletedClosingIds = [];
      }
      if (!updatedState.deletedClosingIds.includes(closingId)) {
        updatedState.deletedClosingIds = [...updatedState.deletedClosingIds, closingId];
      }

      // Audit Log
      addAuditLog(
        updatedState,
        'Exclusão de Fechamento',
        `Excluiu a ata de fechamento semanal ${closing.closingNum}.`,
        updatedState.currentUser
      );

      updateStateAndPersist(updatedState);
    }
  };

  // Clear all closings (atas) from permanent archive
  const handleClearAllClosings = () => {
    const updatedState = { ...state };
    const ids = updatedState.closings.map(c => c.id);
    updatedState.closings = [];
    
    if (!updatedState.deletedClosingIds) {
      updatedState.deletedClosingIds = [];
    }
    ids.forEach(id => {
      if (!updatedState.deletedClosingIds!.includes(id)) {
        updatedState.deletedClosingIds!.push(id);
      }
    });
    
    // Audit Log
    addAuditLog(
      updatedState,
      'Limpeza de Arquivo',
      'Excluiu todas as atas de fechamento semanal do arquivo permanente.',
      updatedState.currentUser
    );

    updateStateAndPersist(updatedState);
  };

  // Student & Visitor registrant submittals (Secretary or Treasurer)
  const handleAddPerson = (data: {
    name: string;
    type: 'ALUNO' | 'VISITANTE';
    phone?: string;
    classGroup?: string;
  }) => {
    const updatedState = { ...state };

    const newPerson: Person = {
      id: `per-${Date.now()}`,
      name: data.name,
      type: data.type,
      phone: data.phone,
      classGroup: data.classGroup,
      registeredAt: new Date().toISOString().split('T')[0]
    };

    updatedState.people = [newPerson, ...updatedState.people];

    // Log in audit
    addAuditLog(
      updatedState,
      'Cadastro Realizado',
      `Cadastrou o ${data.type.toLowerCase()} "${data.name}" no sistema.`
    );

    updateStateAndPersist(updatedState);
  };

  // High-contrast premium loading screen for authentication check and Firestore sync
  if (isConnectingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
        {/* Background ambient decorations */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />

        <div className="text-center z-10 flex flex-col items-center space-y-6">
          <div className="animate-pulse flex flex-col items-center justify-center">
            <LogoEBD className="w-48 h-36 drop-shadow-lg" />
          </div>
          
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-300">
              Sincronizando dados com a nuvem...
            </p>
            <p className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">
              Por favor, aguarde um instante
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Session check wrapper
  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans select-none">
        
        {/* Ambient atmospheric lighting accents */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Subtle grid backdrop pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 space-y-4">
          <div className="flex flex-col items-center justify-center mb-1">
            <div className="relative p-3 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-xl group hover:border-slate-700/80 transition-all duration-300">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-3xl blur-md opacity-20 group-hover:opacity-35 transition-opacity" />
              <LogoEBD className="w-40 h-28 relative drop-shadow-md" />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-bold text-indigo-300 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              IEADALPE • Jardim Paulista Baixo
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
              Finanças <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-emerald-300">EBD</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
              Plataforma Oficial de Gestão e Tesouraria da Escola Bíblica Dominical
            </p>
          </div>
        </div>

        <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <div className="bg-white/95 backdrop-blur-2xl py-8 px-6 sm:px-10 shadow-2xl shadow-indigo-950/40 border border-white/20 rounded-3xl space-y-6">
            
            {loginError && (
              <div className="bg-red-50/90 border border-red-200 text-red-800 text-xs rounded-2xl p-3.5 flex items-start gap-2.5 animate-bounce-subtle shadow-sm">
                <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{loginError}</span>
              </div>
            )}

            {/* Google Authentication Section */}
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                  Acesso com Conta Google
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Clique no botão abaixo para autenticar ou registrar seu acesso no banco de dados na nuvem.
                </p>
              </div>

              {/* Google Sign-In / Register Trigger Button */}
              <button
                onClick={handleGoogleLoginClick}
                type="button"
                disabled={isConnectingAuth}
                className="w-full bg-slate-900 hover:bg-slate-850 text-white rounded-2xl py-4 px-5 font-bold text-xs shadow-xl shadow-slate-900/15 border border-slate-700/50 flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-[0.98] group hover:shadow-indigo-500/10 hover:border-indigo-500/40 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isConnectingAuth ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    <span className="text-slate-200 font-semibold text-xs">Conectando ao Google...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-1 rounded-full bg-white shadow-sm shrink-0">
                      <svg className="w-4 h-4 transition-transform group-hover:scale-110" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.5 24c0-1.63-.15-3.21-.42-4.75H24v9h12.75c-.55 2.87-2.18 5.31-4.62 6.95l7.2 5.58C43.5 36.54 46.5 30.77 46.5 24z"/>
                        <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.2-5.58c-2 .35-4.55 2.11-8.69 2.11-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                    </div>
                    <span className="text-white tracking-wide text-xs font-bold">Continuar com o Google</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-600">Cloud Firestore</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                v1.2.0 • Sincronizado
              </span>
            </div>
          </div>
        </div>

      </div>
    );
  }

  // Active User session context
  const user = state.currentUser ? {
    ...state.currentUser,
    role: (simulationRole && state.currentUser.role === 'MASTER') ? simulationRole : state.currentUser.role
  } : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {simulationRole && state.currentUser?.role === 'MASTER' && (
        <div className="bg-amber-600 text-white text-xs font-bold py-2 px-4 flex justify-between items-center shadow-lg animate-fade-in z-50 relative">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span>Você está operando sob o perfil de simulação: <strong>{simulationRole}</strong> (Seu login real é MASTER)</span>
          </div>
          <button
            onClick={() => setSimulationRole(null)}
            className="bg-white text-amber-700 hover:bg-slate-100 px-3 py-1 rounded-lg font-black tracking-wide uppercase text-[10px] transition-colors cursor-pointer"
          >
            Voltar para MASTER
          </button>
        </div>
      )}

      {firebaseError && (
        <div className="bg-red-50 border-b border-red-200 p-4 text-xs text-red-800 z-50 relative animate-fade-in no-print shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-3 items-start">
              <span className="p-1.5 bg-red-150 text-red-700 rounded-lg font-black text-[10px] tracking-wider uppercase shrink-0">
                ⚠️ Erro Nuvem
              </span>
              <div>
                <span className="font-extrabold block text-red-900 text-sm mb-0.5">Sincronização Desativada (Firestore Inativo)</span>
                <span className="leading-relaxed block text-[11px] text-red-750">
                  O Firebase reportou: <code className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-red-900 border border-red-200">{firebaseError}</code>.
                  {state.currentUser?.role === 'MASTER' ? (
                    <span> Isso indica que a <strong>Cloud Firestore API</strong> está desativada ou que o banco de dados não foi criado no projeto <code>financas-ebd</code>. Por esse motivo, novos usuários do Google (como <strong>eduardasoares86617@gmail.com</strong>) não conseguem se registrar nem sincronizar as telas. Ative a API e crie o banco clicando nos botões ao lado!</span>
                  ) : (
                    <span> O aplicativo está operando em modo offline. Por favor, solicite ao Administrador Master que acesse o painel e ative a Cloud Firestore API para habilitar a sincronização multiusuário.</span>
                  )}
                </span>
              </div>
            </div>
            {state.currentUser?.role === 'MASTER' ? (
              <div className="flex gap-2 shrink-0 self-end md:self-center items-center">
                <a
                  href="https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=financas-ebd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-[10px] uppercase tracking-wider"
                >
                  1. Ativar API no Console
                </a>
                <a
                  href="https://console.firebase.google.com/project/financas-ebd/firestore"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-[10px] uppercase tracking-wider"
                >
                  2. Criar Banco no Firebase
                </a>
                <button
                  onClick={() => setFirebaseError(null)}
                  className="bg-red-200 hover:bg-red-300 text-red-900 font-extrabold px-2.5 py-1.5 rounded-lg transition-colors text-[10px] uppercase cursor-pointer ml-1"
                  title="Fechar aviso"
                >
                  ✕ Ocultar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setFirebaseError(null)}
                className="bg-red-200 hover:bg-red-300 text-red-900 font-extrabold px-2.5 py-1.5 rounded-lg transition-colors text-[10px] uppercase cursor-pointer shrink-0 self-end md:self-center"
              >
                ✕ Ocultar
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Visual Navigation Header (Logo, profile selection and manual offline cloud controls) */}
      <nav className="bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 text-white shadow-xl shadow-slate-950/5 z-30 sticky top-0 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[68px]">
            
            {/* Logo area */}
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                <LogoEBD className="w-8 h-8 shrink-0" iconOnly={true} />
              </div>
              <div>
                <h1 className="font-black text-sm tracking-tight leading-none block text-white">
                  Finanças <span className="text-indigo-400">EBD</span>
                </h1>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mt-1">
                  IEADALPE • JP Baixo
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            {user.role !== 'VISITANTE' && (
              <div className="hidden lg:flex items-center gap-1 text-xs font-bold bg-slate-900/90 p-1 rounded-2xl border border-slate-800/80 shadow-inner">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3.5 py-2 rounded-xl transition-all font-semibold ${
                    activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Dashboard
                </button>

                <button
                  onClick={() => setActiveTab('caixas')}
                  className={`px-3.5 py-2 rounded-xl transition-all font-semibold ${
                    activeTab === 'caixas' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Caixas
                </button>

                {user.role !== 'VISITANTE' && user.role !== 'DIRIGENTE' && (
                  <button
                    onClick={() => setActiveTab('nova_movimentacao')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-semibold ${
                      activeTab === 'nova_movimentacao' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    id="tab-new-tx"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-indigo-300" />
                    Lançamento
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('fechamento')}
                  className={`px-3.5 py-2 rounded-xl transition-all font-semibold ${
                    activeTab === 'fechamento' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  id="tab-closing"
                >
                  Fechamento
                </button>

                <button
                  onClick={() => setActiveTab('relatorios')}
                  className={`px-3.5 py-2 rounded-xl transition-all font-semibold ${
                    activeTab === 'relatorios' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  id="tab-reports"
                >
                  Relatórios
                </button>

                {(user.role === 'TESOUREIRO' || user.role === 'MASTER' || user.role === 'DIRIGENTE') && (
                  <button
                    onClick={() => setActiveTab('auditoria')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-semibold ${
                      activeTab === 'auditoria' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    id="tab-audits"
                  >
                    <History className="w-3.5 h-3.5" />
                    Auditoria
                  </button>
                )}

                {user.role === 'MASTER' && (
                  <button
                    onClick={() => setActiveTab('usuarios')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-semibold ${
                      activeTab === 'usuarios' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    id="tab-users-mgmt"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Usuários
                  </button>
                )}
              </div>
            )}

            {/* Profile details & Cloud status */}
            <div className="hidden lg:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-900 rounded-full border border-slate-800 shadow-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${user.avatarColor || 'bg-indigo-400'} ring-2 ring-slate-800`} />
                <span className="font-bold text-[12px] text-slate-100">{user.name}</span>
                <span className="text-[9px] font-black bg-indigo-600/90 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {user.role}
                </span>
              </div>
              
              {/* Database sync and download backup row */}
              {user.role !== 'VISITANTE' && (
                <div className="flex items-center gap-1.5">
                  {user.id.startsWith('fb-') && (
                    <button
                      type="button"
                      onClick={handleForceSyncFromFirestore}
                      disabled={syncingFirestore}
                      className="flex items-center gap-1.5 text-[10px] font-bold font-mono px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-full transition-all cursor-pointer active:scale-95 disabled:opacity-70"
                      title="Clique para forçar sincronização imediata em tempo real com a nuvem"
                    >
                      <RefreshCw className={`w-3 h-3 text-indigo-400 ${syncingFirestore ? 'animate-spin' : ''}`} />
                      <span>{syncingFirestore ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="p-1.5 px-2.5 hover:bg-slate-800 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 duration-150 flex items-center gap-1 font-bold text-[10px] uppercase tracking-wide cursor-pointer"
                    title="Fazer download de Segurança (Respaldo Completo)"
                  >
                    <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                    Backup
                  </button>

                  <label className="p-1.5 px-2.5 hover:bg-slate-800 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white duration-150 flex items-center gap-1 font-bold text-[10px] uppercase tracking-wide cursor-pointer">
                    <FileUp className="w-3.5 h-3.5 text-emerald-400" />
                    Restaurar
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleUploadBackup}
                      className="hidden"
                    />
                  </label>

                  {user.role === 'MASTER' && (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="p-1.5 px-2.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 hover:border-red-700 text-red-300 duration-150 flex items-center gap-1 font-bold text-[10px] uppercase tracking-wide cursor-pointer rounded-xl"
                      title="Limpar todos os lançamentos, fechamentos e auditorias para iniciar o uso real"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      Zerar
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleLogout}
                className="p-2 rounded-full hover:bg-red-500/10 hover:text-red-400 text-slate-400 transition-all flex items-center justify-center cursor-pointer"
                title="Sair do Sistema"
                id="logout-btn"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile menu trigger */}
            <div className="lg:hidden flex items-center gap-3">
              <span className="text-[10px] font-bold bg-indigo-600 px-2 py-0.5 rounded uppercase tracking-wider">{user.role}</span>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1 rounded-md hover:bg-slate-800 text-white"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile menu panel dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-850 border-t border-slate-800 px-4 pt-2 pb-4 space-y-2 text-xs font-bold font-sans">
            {user.role !== 'VISITANTE' ? (
              <>
                <button
                  onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                  className={`block w-full text-left py-2 px-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-slate-800 text-indigo-300' : 'text-slate-300'}`}
                >
                  Dashboard
                </button>
                
                <button
                  onClick={() => { setActiveTab('caixas'); setMobileMenuOpen(false); }}
                  className={`block w-full text-left py-2 px-3 rounded-lg ${activeTab === 'caixas' ? 'bg-slate-800 text-indigo-300' : 'text-slate-300'}`}
                >
                  Caixas
                </button>

                {user.role !== 'VISITANTE' && user.role !== 'DIRIGENTE' && (
                  <button
                    onClick={() => { setActiveTab('nova_movimentacao'); setMobileMenuOpen(false); }}
                    className={`block w-full text-left py-2 px-3 rounded-lg ${activeTab === 'nova_movimentacao' ? 'bg-slate-800 text-indigo-300' : 'text-slate-300'}`}
                  >
                    Nova Movimentação
                  </button>
                )}

                <button
                  onClick={() => { setActiveTab('fechamento'); setMobileMenuOpen(false); }}
                  className={`block w-full text-left py-2 px-3 rounded-lg ${activeTab === 'fechamento' ? 'bg-slate-800 text-indigo-300' : 'text-slate-300'}`}
                >
                  Fechamento Semanal
                </button>

                <button
                  onClick={() => { setActiveTab('relatorios'); setMobileMenuOpen(false); }}
                  className={`block w-full text-left py-2 px-3 rounded-lg ${activeTab === 'relatorios' ? 'bg-slate-800 text-indigo-300' : 'text-slate-300'}`}
                >
                  Relatórios
                </button>

                {(user.role === 'TESOUREIRO' || user.role === 'MASTER' || user.role === 'DIRIGENTE') && (
                  <button
                    onClick={() => { setActiveTab('auditoria'); setMobileMenuOpen(false); }}
                    className={`block w-full text-left py-2 px-3 rounded-lg ${activeTab === 'auditoria' ? 'bg-slate-800 text-indigo-300' : 'text-slate-300'}`}
                  >
                    Auditoria
                  </button>
                )}

                {user.role === 'MASTER' && (
                  <button
                    onClick={() => { setActiveTab('usuarios'); setMobileMenuOpen(false); }}
                    className={`block w-full text-left py-2 px-3 rounded-lg ${activeTab === 'usuarios' ? 'bg-slate-800 text-indigo-300' : 'text-slate-300'}`}
                  >
                    Gerenciar Usuários
                  </button>
                )}

                <div className="border-t border-slate-700 pt-3 flex flex-col gap-2">
                  <div className="text-[10px] text-slate-400">Usuário: {user.name} ({user.role})</div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => { handleForceSyncFromFirestore(); setMobileMenuOpen(false); }}
                      disabled={syncingFirestore}
                      className="flex-1 py-1.5 px-3 bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 rounded text-center text-[10px] flex items-center justify-center gap-1.5 font-bold"
                    >
                      <RefreshCw className={`w-3 h-3 text-indigo-400 ${syncingFirestore ? 'animate-spin' : ''}`} />
                      <span>{syncingFirestore ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>
                    <button
                      onClick={() => { handleDownloadBackup(); setMobileMenuOpen(false); }}
                      className="flex-1 py-1.5 px-3 bg-slate-800 border border-slate-700 text-slate-300 rounded text-center text-[10px]"
                    >
                      Backup
                    </button>
                    {user.role === 'MASTER' && (
                      <button
                        onClick={() => { setShowResetConfirm(true); setMobileMenuOpen(false); }}
                        className="flex-1 py-1.5 px-3 bg-red-550/15 border border-red-500/20 text-red-300 rounded text-center text-[10px]"
                      >
                        Zerar
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex-1 py-1.5 px-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-center text-[10px]"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="pt-2 flex flex-col gap-2">
                <div className="text-[10px] text-slate-400">Acesso Restrito: {user.name} ({user.role})</div>
                <button
                  onClick={handleLogout}
                  className="w-full py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-center text-[11px]"
                >
                  Sair do Sistema
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {user.role === 'VISITANTE' ? (
          <div className="max-w-md mx-auto mt-12 text-center space-y-6">
            <div className="inline-flex p-4 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              <ShieldCheck className="w-12 h-12 text-indigo-600 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-xl text-slate-800 tracking-tight">Sessão Visitante Ativa</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Seu acesso foi registrado no sistema com sucesso como <strong>VISITANTE</strong>. Nenhuma informação financeira ou dado sensível está disponível para visualização no momento.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 text-left space-y-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  VL
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800">Vitor Leonardo</h4>
                  <p className="text-[10px] text-slate-400">Administrador Master</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal border-t border-slate-150 pt-2.5">
                Para fins de segurança e integridade das finanças, os privilégios de Secretária, Tesoureiro ou Dirigente devem ser atribuídos manualmente pelo Administrador Master. Por favor, solicite a liberação do seu perfil.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={handleLogout}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 border border-red-650 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
                id="visitor-logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair do Sistema
              </button>
            </div>
          </div>
        ) : (
          /* Render appropriate segment based on activeTab */
          <div className="transition-all duration-300">
            
            {activeTab === 'dashboard' && (
              <Dashboard
                boxes={state.boxes}
                transactions={state.transactions}
                onApproveTransaction={handleApproveTransaction}
                onViewTransaction={(tx) => setActiveReceipt(tx)}
                currentUser={user}
                onNavigateToTab={(tabName) => setActiveTab(tabName)}
              />
            )}

            {activeTab === 'caixas' && (
              <BoxesManagement
                boxes={state.boxes}
                transactions={state.transactions}
                categories={state.categories}
                currentUser={user}
                onViewTransaction={(tx) => setActiveReceipt(tx)}
                onDeleteTransaction={handleDeleteTransaction}
                onTransfer={handleTransferFunds}
              />
            )}

            {activeTab === 'nova_movimentacao' && (
              user.role !== 'VISITANTE' && user.role !== 'DIRIGENTE' ? (
                <TransactionForm
                  categories={state.categories}
                  onSubmit={handleAddTransaction}
                  currentUser={user}
                  onNavigateToDashboard={() => setActiveTab('dashboard')}
                />
              ) : (
                <div className="bg-white rounded-2xl p-8 text-center max-w-md mx-auto border border-slate-100">
                  <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <h4 className="font-bold text-sm text-slate-800">Acesso Restrito</h4>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Desculpe. O preenchimento e lançamento de lançamentos financeiros só é assegurado ao cargo de <strong>Tesoureiro</strong>.
                  </p>
                </div>
              )
            )}

            {activeTab === 'fechamento' && (
              <WeeklyClosing
                closings={state.closings}
                transactions={state.transactions}
                currentUser={user}
                onViewAta={(closing) => setActiveAta(closing)}
                onAddClosing={handleAddClosing}
                onApproveClosing={handleApproveClosing}
                onDeleteClosing={handleDeleteClosing}
                onClearAllClosings={handleClearAllClosings}
              />
            )}

            {activeTab === 'relatorios' && (
              <ReportsView
                transactions={state.transactions}
                categories={state.categories}
                boxes={state.boxes}
                onViewTransaction={(tx) => setActiveReceipt(tx)}
              />
            )}

            {activeTab === 'auditoria' && (user.role === 'TESOUREIRO' || user.role === 'MASTER' || user.role === 'DIRIGENTE') && (
              <AuditoryView logs={state.auditLogs} />
            )}

            {activeTab === 'usuarios' && state.currentUser?.role === 'MASTER' && (
              <UsersManagement
                users={state.users}
                currentUser={state.currentUser}
                onUpdateUsersList={(updatedUsers) => {
                  const currentEmails = new Set(updatedUsers.map(u => u && u.username ? u.username.toLowerCase().trim() : ''));
                  
                  // Find and track any user who was removed by the administrator
                  state.users.forEach(u => {
                    if (u && u.username) {
                      const emailClean = u.username.toLowerCase().trim();
                      if (!currentEmails.has(emailClean)) {
                        deletedUsernamesRef.current.add(emailClean);
                        editedUsersRef.current.delete(emailClean);
                      }
                    }
                  });
                  
                  // Find and track any user who was edited (role/name) or newly added/invited
                  updatedUsers.forEach(u => {
                    if (u && u.username) {
                      const emailClean = u.username.toLowerCase().trim();
                      
                      // Remove from deleted whitelist since they are now part of active users list
                      deletedUsernamesRef.current.delete(emailClean);
                      
                      const existing = state.users.find(oldU => oldU && oldU.username && oldU.username.toLowerCase().trim() === emailClean);
                      if (existing) {
                        if (existing.role !== u.role || existing.name !== u.name) {
                          editedUsersRef.current.set(emailClean, { role: u.role, name: u.name });
                        }
                      } else {
                        // Pre-registered new invite or newly added user
                        editedUsersRef.current.set(emailClean, { role: u.role, name: u.name });
                      }
                    }
                  });
                  
                  const newState = { ...state, users: updatedUsers };
                  setState(newState);
                  saveAdministrativeRefs();

                  // Bypassing debounce and saving administrative user list modifications IMMEDIATELY to Firestore!
                  // This completely prevents page-refresh data-loss or race conditions for user edits/deletions.
                  if (state.currentUser && state.currentUser.id.startsWith('fb-') && state.currentUser.role !== 'VISITANTE') {
                    const fbUserId = state.currentUser.id.replace('fb-', '');
                    saveStateToFirestore(fbUserId, newState, Array.from(deletedUsernamesRef.current), Object.fromEntries(editedUsersRef.current))
                      .then(() => {
                        console.log("[Users Management] Successfully persisted user list updates immediately to Firestore.");
                      })
                      .catch(e => {
                        console.error("[Users Management] Failed to persist user list updates immediately to Firestore:", e);
                      });
                  }
                }}
                onLogAudit={(action, details) => {
                  setState(current => {
                    const updatedState = { ...current };
                    addAuditLog(updatedState, action, details, state.currentUser);
                    return updatedState;
                  });
                }}
                simulationRole={simulationRole}
                onSelectSimulationRole={setSimulationRole}
                onForceSync={handleForceSync}
              />
            )}

          </div>
        )}

      </main>

      {/* Visual Modal Layer 1: Receipts Comprovante */}
      {activeReceipt && (
        <TransactionReceipt
          transaction={activeReceipt}
          category={state.categories.find(c => c.id === activeReceipt.categoryId)}
          box={state.boxes.find(b => b.id === activeReceipt.boxId)}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {/* Visual Modal Layer 2: Official Closings Minutes */}
      {activeAta && (
        <AtaWeeklyClosing
          closing={activeAta}
          transactions={state.transactions}
          onClose={() => setActiveAta(null)}
        />
      )}

      {/* Visual Modal Layer 3: System Reset Confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-100 shadow-2xl space-y-4 animate-scale-in text-left">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center border border-red-100">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-850 text-base">Confirmar Limpeza Completa</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tem certeza de que deseja apagar todos os lançamentos, fechamentos e dados históricos de teste? Todos os caixas serão redefinidos para <strong>R$ 0,00</strong> para permitir o preenchimento de seus saldos reais.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setState(current => {
                    const updatedState = { ...current };
                    updatedState.transactions = [];
                    updatedState.closings = [];
                    updatedState.people = [];
                    updatedState.auditLogs = [];
                    updatedState.boxes = current.boxes.map(b => ({
                      ...b,
                      balance: 0,
                      initialBalance: 0
                    }));
                    
                    addAuditLog(
                      updatedState,
                      'Zerar Sistema',
                      'O administrador realizou a limpeza completa de dados para início do uso real.',
                      current.currentUser
                    );
                    return updatedState;
                  });
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2.5 bg-red-650 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer text-center"
              >
                Sim, Apagar Tudo
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Institutional Legal Footer */}
      <footer className="bg-slate-900 text-slate-500 text-[10px] font-mono leading-normal text-center py-6 mt-12 border-t border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <p className="font-semibold text-slate-400">Escola Bíblica Dominical (EBD) - Todos os direitos reservados © 2026</p>
          <p className="max-w-xl mx-auto leading-relaxed">
            Painel eletrônico integrado de auditoria financeira garantindo a contabilidade, visto e transparência institucional das lições CPAD e fundos gerais ordinários da escola bíblica.
          </p>
        </div>
      </footer>

    </div>
  );
}
