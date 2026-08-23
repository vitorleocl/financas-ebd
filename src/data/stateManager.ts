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
  deletedTransactionIds?: string[];
  deletedClosingIds?: string[];
  deletedPeopleIds?: string[];
}

const STORAGE_KEY = 'ebd_financial_system_state_v1';

// Helper to identify and purge legacy seed / opening transactions that double-count the starting balance
export const isLegacySeedTx = (t: any): boolean => {
  if (!t) return true;
  const amt = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0;
  if (amt === 250.25 || amt === 150.00 || amt === 326.40 || amt === 310.00) return true;
  if (t.id && (t.id.startsWith('tx-init-') || t.id === 'tx-seed-1' || t.id === 'tx-seed-2' || t.id === 'tx-1' || t.id === 'tx-2')) return true;
  if (t.description && typeof t.description === 'string') {
    const desc = t.description.toLowerCase().trim();
    if (
      desc === 'saldo inicial' || 
      desc === 'saldo de abertura' || 
      desc === 'abertura de caixa' ||
      desc.startsWith('saldo inicial') ||
      desc.startsWith('saldo de abertura') ||
      desc.startsWith('abertura de caixa')
    ) {
      return true;
    }
  }
  return false;
};

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

      let loadedBoxes = parsed.boxes || INITIAL_BOXES;
      if (Array.isArray(loadedBoxes)) {
        loadedBoxes = loadedBoxes.map((b: Box) => {
          if (b.id === 'CAIXA_5_EBD') {
            if (
              b.initialBalance === 250.25 || 
              b.initialBalance === 326.40 || 
              b.initialBalance === 326.4 || 
              b.initialBalance === 0 || 
              b.initialBalance === 250 ||
              typeof b.initialBalance !== 'number'
            ) {
              return { ...b, initialBalance: 76.15 };
            }
          }
          if (b.id === 'CAIXA_LICOES') {
            if (
              b.initialBalance === 150.00 || 
              b.initialBalance === 310.00 || 
              b.initialBalance === 310 || 
              b.initialBalance === 0 || 
              b.initialBalance === 150 ||
              typeof b.initialBalance !== 'number'
            ) {
              return { ...b, initialBalance: 160.00 };
            }
          }
          return b;
        });
      }

      // Filter out legacy seed / opening transactions that duplicate initial balance
      const deletedTxIds = new Set<string>(parsed.deletedTransactionIds || []);
      let loadedTransactions = parsed.transactions || INITIAL_TRANSACTIONS;
      if (Array.isArray(loadedTransactions)) {
        loadedTransactions = loadedTransactions.filter((t: any) => {
          if (!t) return false;
          if (isLegacySeedTx(t)) {
            if (t.id) deletedTxIds.add(t.id);
            return false;
          }
          return !deletedTxIds.has(t.id);
        });
      }

      return {
        currentUser: parsed.currentUser || null,
        users: parsed.users || INITIAL_USERS,
        boxes: loadedBoxes,
        categories: loadedCategories,
        transactions: loadedTransactions,
        people: parsed.people || INITIAL_PEOPLE,
        closings: parsed.closings || INITIAL_CLOSINGS,
        auditLogs: parsed.auditLogs || INITIAL_AUDIT_LOGS,
        deletedTransactionIds: Array.from(deletedTxIds),
        deletedClosingIds: parsed.deletedClosingIds || [],
        deletedPeopleIds: parsed.deletedPeopleIds || []
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
    auditLogs: INITIAL_AUDIT_LOGS,
    deletedTransactionIds: [],
    deletedClosingIds: [],
    deletedPeopleIds: []
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
  const transactions = state.transactions || [];

  const defaultBoxesTemplate: Box[] = [
    {
      id: 'CAIXA_5_EBD',
      name: 'Caixa 5% EBD',
      description: 'Fundo de caixa proveniente de dízimos/ofertas da igreja central (cota de 5% destinada à EBD) para manutenção diária e necessidades gerais.',
      balance: 76.15,
      initialBalance: 76.15
    },
    {
      id: 'CAIXA_LICOES',
      name: 'Caixa Lições',
      description: 'Caixa exclusivo de receitas da venda de revistas (lições dominicais) e despesas de aquisição das novas lições trimestrais.',
      balance: 160.00,
      initialBalance: 160.00
    }
  ];

  return defaultBoxesTemplate.map(templateBox => {
    const existingBox = state.boxes?.find(b => b && b.id === templateBox.id);
    let initialBalance = templateBox.initialBalance;

    if (existingBox && typeof existingBox.initialBalance === 'number') {
      if (templateBox.id === 'CAIXA_5_EBD') {
        if (
          existingBox.initialBalance === 250.25 || 
          existingBox.initialBalance === 326.40 || 
          existingBox.initialBalance === 326.4 || 
          existingBox.initialBalance === 0 || 
          existingBox.initialBalance === 250
        ) {
          initialBalance = 76.15;
        } else {
          initialBalance = existingBox.initialBalance;
        }
      } else if (templateBox.id === 'CAIXA_LICOES') {
        if (
          existingBox.initialBalance === 150.00 || 
          existingBox.initialBalance === 310.00 || 
          existingBox.initialBalance === 310 || 
          existingBox.initialBalance === 0 || 
          existingBox.initialBalance === 150
        ) {
          initialBalance = 160.00;
        } else {
          initialBalance = existingBox.initialBalance;
        }
      } else {
        initialBalance = existingBox.initialBalance;
      }
    }

    const boxTransactionsForThisBox = transactions.filter(t => {
      if (!t) return false;
      // Exclude legacy seed opening transactions that duplicate initial balance
      if (isLegacySeedTx(t)) {
        return false;
      }
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
      return bid === templateBox.id;
    });
    
    // Base is starting balance which is constant or starting from initial balance.
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
    }, initialBalance);

    return {
      id: templateBox.id,
      name: templateBox.name,
      description: templateBox.description,
      initialBalance,
      balance: parseFloat(balance.toFixed(2)) // Keep decimal precision safe
    };
  });
}
