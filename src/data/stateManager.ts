/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Box, Category, Transaction, Person, AuditLog, WeeklyClosing, BoxId } from '../types';
import {
  INITIAL_USERS,
  INITIAL_BOXES,
  INITIAL_CATEGORIES,
  INITIAL_TRANSACTIONS,
  INITIAL_PEOPLE,
  INITIAL_CLOSINGS,
  INITIAL_AUDIT_LOGS
} from './initialData';

// Generate safe IPs for audit
const MOCK_IPS = ['192.168.1.12', '192.168.1.45', '177.85.122.9', '186.204.1.84'];
const getRandomIp = () => MOCK_IPS[Math.floor(Math.random() * MOCK_IPS.length)];

export interface AppState {
  currentUser: User | null;
  users: (User & { passwordHash?: string })[];
  boxes: Box[];
  categories: Category[];
  transactions: Transaction[];
  people: Person[];
  closings: WeeklyClosing[];
  auditLogs: AuditLog[];
}

const STORAGE_KEY = 'ebd_financial_system_state_v1';

export function getInitialState(): AppState {
  if (typeof window === 'undefined') {
    return {
      currentUser: null,
      users: INITIAL_USERS,
      boxes: INITIAL_BOXES,
      categories: INITIAL_CATEGORIES,
      transactions: INITIAL_TRANSACTIONS,
      people: INITIAL_PEOPLE,
      closings: INITIAL_CLOSINGS,
      auditLogs: INITIAL_AUDIT_LOGS
    };
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Ensure all fields are present, and merge any new initial categories
      let loadedCategories = parsed.categories || INITIAL_CATEGORIES;
      if (Array.isArray(loadedCategories)) {
        INITIAL_CATEGORIES.forEach(initCat => {
          if (!loadedCategories.some((c: Category) => c.id === initCat.id)) {
            loadedCategories.push(initCat);
          }
        });
      }
      return {
        currentUser: parsed.currentUser || null,
        users: parsed.users || INITIAL_USERS,
        boxes: parsed.boxes || INITIAL_BOXES,
        categories: loadedCategories,
        transactions: parsed.transactions || INITIAL_TRANSACTIONS,
        people: parsed.people || INITIAL_PEOPLE,
        closings: parsed.closings || INITIAL_CLOSINGS,
        auditLogs: parsed.auditLogs || INITIAL_AUDIT_LOGS
      };
    } catch (e) {
      console.error("Failed to parse EBD financial state, resetting to defaults", e);
    }
  }

  const defaultState: AppState = {
    currentUser: null,
    users: INITIAL_USERS,
    boxes: INITIAL_BOXES,
    categories: INITIAL_CATEGORIES,
    transactions: INITIAL_TRANSACTIONS,
    people: INITIAL_PEOPLE,
    closings: INITIAL_CLOSINGS,
    auditLogs: INITIAL_AUDIT_LOGS
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
  return defaultState;
}

export function saveState(state: AppState) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

// Helpers to update and log actions
export function addAuditLog(
  state: AppState,
  action: string,
  details: string,
  userOverride?: User | null
): AuditLog {
  const user = userOverride !== undefined ? userOverride : state.currentUser;
  const newLog: AuditLog = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: user?.id || 'visitante-anonimo',
    userName: user?.name || 'Anonimo',
    userRole: user?.role || 'VISITANTE',
    action,
    details,
    ip: getRandomIp(),
    timestamp: new Date().toISOString()
  };
  state.auditLogs = [newLog, ...state.auditLogs];
  return newLog;
}

// Recalculates box balances based on APPROVED transactions
export function recalculateBalances(state: AppState): Box[] {
  const boxes = state.boxes || [];
  const transactions = state.transactions || [];

  return boxes.map(box => {
    if (!box) return box;
    
    const boxTransactionsForThisBox = transactions.filter(t => {
      if (!t) return false;
      let bid = t.boxId;
      if (!bid) {
        // Fallback for transactions missing boxId
        if (t.categoryId === 'cat-ent-3' || t.categoryId === 'cat-sai-1' || 
            (t.description && (t.description.toLowerCase().includes('revista') || t.description.toLowerCase().includes('lição') || t.description.toLowerCase().includes('licao')))) {
          bid = 'CAIXA_LICOES';
        } else {
          bid = 'CAIXA_5_EBD';
        }
      }
      return bid === box.id;
    });
    
    // Base is starting balance which is constant or starting from zero.
    const baseBalance = box.initialBalance || 0;
    
    const balance = boxTransactionsForThisBox.reduce((acc, t) => {
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
      balance: parseFloat(balance.toFixed(2)) // Keep decimal precision safe
    };
  });
}
