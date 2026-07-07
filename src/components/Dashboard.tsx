/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Transaction, User } from '../types';
import { ArrowUpRight, ArrowDownRight, SquareCheck, RefreshCw, Landmark, Calendar, Clock, Lock, Paperclip } from 'lucide-react';

interface DashboardProps {
  boxes: Box[];
  transactions: Transaction[];
  onApproveTransaction?: (txId: string) => void;
  onViewTransaction: (tx: Transaction) => void;
  currentUser: User | null;
  onNavigateToTab: (tab: string) => void;
}

export default function Dashboard({
  boxes,
  transactions,
  onApproveTransaction,
  onViewTransaction,
  currentUser,
  onNavigateToTab
}: DashboardProps) {
  
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getWeekRange = () => {
    const now = new Date();
    // Monday as start of week
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };

  const weekRange = getWeekRange();

  // Entradas e saídas da semana atual (Approved only)
  const isDateInCurrentWeek = (dateStr: string) => {
    return dateStr >= weekRange.start && dateStr <= weekRange.end;
  };

  const weeklyTransactions = transactions.filter(t => isDateInCurrentWeek(t.date) && t.isApproved);
  
  const weeklyInflow = weeklyTransactions
    .filter(t => t.type === 'ENTRADA')
    .reduce((sum, t) => sum + t.amount, 0);

  const weeklyOutflow = weeklyTransactions
    .filter(t => t.type === 'SAIDA')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingApprovals = transactions.filter(t => !t.isApproved);

  // For charts, let's sum category totals
  const getCategoryRatio = () => {
    const entries = transactions.filter(t => t.type === 'ENTRADA' && t.isApproved);
    const exits = transactions.filter(t => t.type === 'SAIDA' && t.isApproved);
    
    const entrySum = entries.reduce((sum, t) => sum + t.amount, 0);
    const exitSum = exits.reduce((sum, t) => sum + t.amount, 0);
    const total = entrySum + exitSum || 1;

    return {
      entryPercentage: Math.round((entrySum / total) * 100),
      exitPercentage: Math.round((exitSum / total) * 100)
    };
  };

  const ratio = getCategoryRatio();
  const box1 = boxes.find(b => b.id === 'CAIXA_5_EBD');
  const box2 = boxes.find(b => b.id === 'CAIXA_LICOES');

  const totalEbd = box1?.balance || 0;
  const totalLicoes = box2?.balance || 0;
  const totalCombined = totalEbd + totalLicoes;

  const box1Percentage = totalCombined > 0 ? (totalEbd / totalCombined) * 100 : 50;
  const box2Percentage = totalCombined > 0 ? (totalLicoes / totalCombined) * 100 : 50;

  return (
    <div className="space-y-6">
      
      {/* Hero Welcome banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-400/25 uppercase">
            Escola Bíblica Dominical • EBD
          </span>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight pt-1">
            Olá, {currentUser?.name}! 👋
          </h2>
          <p className="text-slate-400 text-xs md:text-sm max-w-xl leading-relaxed">
            Bem-vindo ao painel financeiro oficial da EBD. {currentUser?.role === 'VISITANTE' 
              ? 'Você possui credenciais de visitante com acesso restrito a visualização de balanços.' 
              : `Você está logado com perfil de ${currentUser?.role?.toLowerCase()}. Todas as suas ações serão registradas em auditoria.`}
          </p>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Caixa 1 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Caixa 01 - 5% EBD</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight block">
              {formatCurrency(totalEbd)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">Cota reservada da tesouraria central</span>
          </div>
        </div>

        {/* Caixa 2 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Caixa 02 - Lições</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight block">
              {formatCurrency(totalLicoes)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">Fundo de revistas e material dominical</span>
          </div>
        </div>

        {/* Entradas da semana */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receitas Semanais</span>
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-emerald-600 tracking-tight block">
              + {formatCurrency(weeklyInflow)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Lançamentos aprovados nesta semana</span>
          </div>
        </div>

        {/* Saídas da semana */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Despesas Semanais</span>
            <div className="p-1.5 rounded-xl bg-red-50 text-red-600">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-red-600 tracking-tight block">
              - {formatCurrency(weeklyOutflow)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Despesas quitadas nesta semana</span>
          </div>
        </div>

      </div>

      {/* Handcrafted Interactive SVG Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Comparativo entre Caixas (Bento Design Card) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 shadow-sm">
          <div>
            <h4 className="font-bold text-sm text-slate-800 tracking-tight">Comparativo de Alocação de Caixas</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Medição do peso de cada caixa sobre o saldo consolidado total</p>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            
            {/* Caixa 1 Progress Bar */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600">Caixa 5% EBD</span>
                <span className="text-blue-600">{Math.round(box1Percentage)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-700" 
                  style={{ width: `${box1Percentage}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">{formatCurrency(totalEbd)}</span>
            </div>

            {/* Caixa 2 Progress Bar */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600">Caixa Lições</span>
                <span className="text-emerald-600">{Math.round(box2Percentage)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 rounded-full transition-all duration-700" 
                  style={{ width: `${box2Percentage}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">{formatCurrency(totalLicoes)}</span>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-50 text-center bg-slate-50/50 rounded-xl p-3 border border-slate-100">
            <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Fundo Acumulado EBD Consolidado</span>
            <span className="text-lg font-black text-slate-800 font-mono mt-1 block">{formatCurrency(totalCombined)}</span>
          </div>
        </div>

        {/* Chart 2: Entrada vs Saída Stack (Bento Design Card) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-800 tracking-tight">Composição Geral de Balanço (Arrecadado vs Gasto)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Indicador acumulado histórico de entradas vs saídas aprovadas</p>
          </div>

          <div className="space-y-4 my-auto pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Entradas ({ratio.entryPercentage}%)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Saídas ({ratio.exitPercentage}%)</span>
            </div>

            <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden flex shadow-inner border border-slate-100">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700" 
                style={{ width: `${ratio.entryPercentage}%` }}
              />
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-red-650 transition-all duration-700" 
                style={{ width: `${ratio.exitPercentage}%` }}
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-400 font-medium italic pt-2 border-t border-slate-50">
            Manter o índice de saídas inferior a 80% do arrecadado geral é recomendado pela auditoria interna municipal.
          </p>
        </div>

      </div>

      {/* Row: Pending approvals & recent transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Approvals Drawer (2/3 width on desktop) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col min-h-[350px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <SquareCheck className="w-4 h-4 text-amber-500" />
                Lançamentos Pendentes de Visto Eletrônico
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Transações que necessitam do aval institucional do Dirigente</p>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {pendingApprovals.length} pendentes
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
            {pendingApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center h-full text-slate-400 py-10">
                <CheckCircleAnimation />
                <span className="text-xs font-semibold text-slate-600 mt-3">Tudo em ordem por aqui!</span>
                <span className="text-[10px] text-slate-400 mt-1 max-w-[280px]">Nenhuma transação pendente de aprovação do dirigente no momento.</span>
              </div>
            ) : (
              pendingApprovals.map(t => (
                <div 
                  key={t.id} 
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl flex items-center justify-between gap-3 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`p-1.5 rounded-lg shrink-0 font-extrabold text-[10px] ${
                      t.type === 'ENTRADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {t.type === 'ENTRADA' ? 'ENT' : 'SAÍ'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate flex items-center gap-1" title={t.description}>
                        {t.description || 'Sem descrição'}
                        {t.attachment && (
                          <Paperclip className="w-3 h-3 text-indigo-500 shrink-0" title="Possui comprovante / foto" />
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 truncate">
                        <span className="font-mono font-bold dark:text-slate-600">{t.transactionNum}</span>
                        <span>•</span>
                        <span>{t.date} {t.time}</span>
                        <span>•</span>
                        <span className="font-medium text-slate-500">{t.boxId === 'CAIXA_5_EBD' ? 'Caixa 5%' : 'Caixa Lições'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-mono font-black ${
                      t.type === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(t.amount)}
                    </span>
                    
                    {/* Action buttons based on Role */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onViewTransaction(t)}
                        className="py-1 px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-[10px] transition-colors"
                        title="Ver Comprovante"
                      >
                        Voucher
                      </button>

                      {(currentUser?.role === 'DIRIGENTE' || currentUser?.role === 'MASTER') && onApproveTransaction ? (
                        <button
                          onClick={() => onApproveTransaction(t.id)}
                          className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                          id={`approve-btn-${t.id}`}
                        >
                          Aprovar
                        </button>
                      ) : (
                        (currentUser?.role !== 'DIRIGENTE' && currentUser?.role !== 'MASTER') && (
                          <div className="flex items-center gap-1 text-[10px] bg-slate-200/50 text-slate-500 border border-slate-200 px-2 py-1 rounded" title="Apenas o perfil Dirigente ou Master pode validar">
                            <Lock className="w-3 h-3 shrink-0" />
                            Aguardando
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent ledger transactions drawer (1/3 width) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div className="pb-4 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-800">Histórico de Caixa Recente</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Últimas movimentações lançadas no livro diário</p>
          </div>

          <div className="my-4 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[220px] pr-1">
            {transactions.slice(0, 5).map(t => (
              <div 
                key={t.id} 
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs group cursor-pointer"
                onClick={() => onViewTransaction(t)}
                title="Clique para ver o voucher"
              >
                <div className="flex flex-col min-w-0 pr-3">
                  <span className="font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                    {t.description || 'Sem descrição específica'}
                    {t.attachment && (
                      <Paperclip className="w-3 h-3 text-indigo-500 shrink-0" title="Possui comprovante / foto" />
                    )}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className={`font-extrabold px-1 py-0.2 rounded text-[9px] ${
                      t.isApproved 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {t.isApproved ? 'Aprovado' : 'Aguardando'}
                    </span>
                    <span className="font-semibold text-slate-500">
                      {t.boxId === 'CAIXA_5_EBD' ? '5% EBD' : 'Lições'}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{t.date}</span>
                  </div>
                </div>

                <span className={`font-mono font-bold shrink-0 text-right ${
                  t.type === 'ENTRADA' ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {t.type === 'ENTRADA' ? '+' : '-'} {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>

          <button 
            onClick={() => onNavigateToTab('caixas')}
            className="w-full text-center py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
          >
            Ver Livro Caixa Completo
          </button>
        </div>

      </div>

    </div>
  );
}

// Check circle line animation helper
function CheckCircleAnimation() {
  return (
    <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center animate-pulse">
      <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}
