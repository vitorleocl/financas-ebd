/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'MASTER' | 'DIRIGENTE' | 'TESOUREIRO' | 'VISITANTE';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  avatarColor: string;
}

export type BoxId = 'CAIXA_5_EBD' | 'CAIXA_LICOES';

export interface Box {
  id: BoxId;
  name: string;
  description: string;
  balance: number;
  initialBalance?: number;
}

export type TransactionType = 'ENTRADA' | 'SAIDA';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  transactionNum: string; // e.g. "TX-1002"
  type: TransactionType;
  boxId: BoxId;
  amount: number;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  categoryId: string;
  description: string;
  responsible: string;
  signature: string; // Base64 signature image
  createdAt: string; // ISO string
  isApproved: boolean; // Approved by Dirigente
  approvedBy?: string;
  approvedAt?: string;
  attachment?: string; // Base64 attached photo/receipt
}

export interface WeeklyClosing {
  id: string;
  closingNum: string; // e.g. "FECH-2026-W25"
  startDate: string;
  endDate: string;
  totalInflows: number;
  totalOutflows: number;
  startingBalance: number;
  endingBalance: number;
  difference: number;
  status: 'PENDENTE' | 'APROVADO';
  dirigenteApprover?: string;
  dirigenteApprovedAt?: string;
  treasurerName: string;
  treasurerSignature: string; // Base64
  closedAt: string;
  comments?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  ip: string;
  timestamp: string; // ISO string
}

export interface Person {
  id: string;
  name: string;
  type: 'ALUNO' | 'VISITANTE';
  phone?: string;
  classGroup?: string; // e.g. "Adultos", "Jovens", "Crianças"
  registeredAt: string; // yyyy-mm-dd
}
