/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Box, Category, Transaction, Person, AuditLog, WeeklyClosing } from '../types';

export const INITIAL_USERS: (User & { passwordHash: string })[] = [];

export const INITIAL_BOXES: Box[] = [
  {
    id: 'CAIXA_5_EBD',
    name: 'Caixa 5% EBD',
    description: 'Fundo de caixa proveniente de dízimos/ofertas da igreja central (cota de 5% destinada à EBD) para manutenção diária e necessidades gerais.',
    balance: 0.00,
    initialBalance: 0.00
  },
  {
    id: 'CAIXA_LICOES',
    name: 'Caixa Lições',
    description: 'Caixa exclusivo de receitas da venda de revistas (lições dominicais) e despesas de aquisição das novas lições trimestrais.',
    balance: 0.00,
    initialBalance: 0.00
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  // Entradas
  { id: 'cat-ent-1', name: 'Oferta do Dia', type: 'ENTRADA' },
  { id: 'cat-ent-2', name: 'Cota 5% Igreja', type: 'ENTRADA' },
  { id: 'cat-ent-3', name: 'Venda de Revista/Lição', type: 'ENTRADA' },
  { id: 'cat-ent-4', name: 'Doações Especiais', type: 'ENTRADA' },
  { id: 'cat-ent-5', name: 'Rendimento de Caixa', type: 'ENTRADA' },
  
  // Saídas
  { id: 'cat-sai-1', name: 'Compra de Revistas/Lições', type: 'SAIDA' },
  { id: 'cat-sai-2', name: 'Material Didático/Papelaria', type: 'SAIDA' },
  { id: 'cat-sai-3', name: 'Alimentação (Lanche EBD)', type: 'SAIDA' },
  { id: 'cat-sai-4', name: 'Festividades/Eventos', type: 'SAIDA' },
  { id: 'cat-sai-5', name: 'Brindes e Premiações Alunos', type: 'SAIDA' },
  { id: 'cat-sai-6', name: 'Manutenção / Decoração de Salas', type: 'SAIDA' },
  { id: 'cat-sai-7', name: 'Passagens/Despesas', type: 'SAIDA' }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_PEOPLE: Person[] = [];

export const INITIAL_CLOSINGS: WeeklyClosing[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
