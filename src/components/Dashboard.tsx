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

  const weeklyTransactions = (transactions || []).filter(t => t && t.date && isDateInCurrentWeek(t.date) && t.isApproved !== false);
  
  const weeklyInflow = weeklyTransactions
    .filter(t => t && t.type === 'ENTRADA')
    .reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0), 0);

  const weeklyOutflow = weeklyTransactions
    .filter(t => t && t.type === 'SAIDA')
    .reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0), 0);

  const pendingApprovals = (transactions || []).filter(t => t && t.isApproved === false);

  // For charts, let's sum category totals
  const getCategoryRatio = () => {
    const entries = (transactions || []).filter(t => t && t.type === 'ENTRADA' && t.isApproved !== false);
    const exits = (transactions || []).filter(t => t && t.type === 'SAIDA' && t.isApproved !== false);
    
    const entrySum = entries.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0), 0);
    const exitSum = exits.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as any) || 0), 0);
    const total = entrySum + exitSum || 1;

    return {
      entryPercentage: Math.round((entrySum / total) * 100),
      exitPercentage: Math.round((exitSum / total) * 100)
    };
  };

  const ratio = getCategoryRatio();
  const box1 = (boxes || []).find(b => b && b.id === 'CAIXA_5_EBD');
  const box2 = (boxes || []).find(b => b && b.id === 'CAIXA_LICOES');

  const totalEbd = box1?.balance || 0;
  const totalLicoes = box2?.balance || 0;
  const totalCombined = totalEbd + totalLicoes;

  const box1Percentage = totalCombined > 0 ? (totalEbd / totalCombined) * 100 : 50;
  const box2Percentage = totalCombined > 0 ? (totalLicoes / totalCombined) * 100 : 50;

  return (
    <div className="space-y-6">
      
      {/* Hero Welcome banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl shadow-slate-900/10 border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-400/30 uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Escola Bíblica Dominical • EBD
            </span>
            <span className="text-[11px] font-semibold text-slate-300 bg-white/10 px-3 py-1 rounded-full border border-white/10">
              IEADALPE Jardim Paulista Baixo
            </span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black tracking-tight pt-0.5">
            Olá, {currentUser?.name}!
          </h2>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed font-normal">
            Painel financeiro oficial da Escola Bíblica Dominical. {currentUser?.role === 'VISITANTE' 
              ? 'Você possui credenciais de visitante com acesso restrito a visualização de balanços.' 
              : `Você está logado com perfil de ${currentUser?.role?.toLowerCase()}. Todas as operações e lançamentos são sincronizados e auditados.`}
          </p>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Caixa 1 */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Caixa 01 - 5% EBD</span>
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/50">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight block font-mono">
              {formatCurrency(totalEbd)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 leading-relaxed font-medium">
              Cota reservada da tesouraria central
            </span>
          </div>
        </div>

        {/* Caixa 2 */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Caixa 02 - Lições</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/50">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight block font-mono">
              {formatCurrency(totalLicoes)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 leading-relaxed font-medium">
              Fundo de revistas e material dominical
            </span>
          </div>
        </div>

        {/* Entradas da semana */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receitas da Semana</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/50">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-emerald-600 tracking-tight block font-mono">
              + {formatCurrency(weeklyInflow)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 font-medium">
              Lançamentos aprovados nesta semana
            </span>
          </div>
        </div>

        {/* Saídas da semana */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Despesas da Semana</span>
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100/50">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-rose-600 tracking-tight block font-mono">
              - {formatCurrency(weeklyOutflow)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 font-medium">
              Despesas quitadas nesta semana
            </span>
          </div>
        </div>

      </div>

      {/* Handcrafted Interactive SVG Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Comparativo entre Caixas (Bento Design Card) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 space-y-6 shadow-sm">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800 tracking-tight">Comparativo de Alocação de Caixas</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Medição do peso de cada caixa sobre o saldo consolidado total</p>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            
            {/* Caixa 1 Progress Bar */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Caixa 5% EBD</span>
                <span className="text-indigo-600">{Math.round(box1Percentage)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-700" 
                  style={{ width: `${box1Percentage}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 block font-mono font-bold">{formatCurrency(totalEbd)}</span>
            </div>

            {/* Caixa 2 Progress Bar */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Caixa Lições</span>
                <span className="text-emerald-600">{Math.round(box2Percentage)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 rounded-full transition-all duration-700" 
                  style={{ width: `${box2Percentage}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 block font-mono font-bold">{formatCurrency(totalLicoes)}</span>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-100 text-center bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
            <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Fundo Acumulado EBD Consolidado</span>
            <span className="text-xl font-black text-slate-900 font-mono mt-1 block">{formatCurrency(totalCombined)}</span>
          </div>
        </div>

        {/* Chart 2: Entrada vs Saída Stack (Bento Design Card) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 space-y-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800 tracking-tight">Composição Geral de Balanço (Arrecadado vs Gasto)</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Indicador acumulado histórico de entradas vs saídas aprovadas</p>
          </div>

          <div className="space-y-4 my-auto pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Entradas ({ratio.entryPercentage}%)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Saídas ({ratio.exitPercentage}%)</span>
            </div>

            <div className="h-6 w-full bg-slate-100 rounded-2xl overflow-hidden flex shadow-inner border border-slate-100">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700" 
                style={{ width: `${ratio.entryPercentage}%` }}
              />
              <div 
                className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-700" 
                style={{ width: `${ratio.exitPercentage}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-medium italic pt-2 border-t border-slate-100">
            Manter o índice de saídas inferior a 80% do arrecadado geral é recomendado pela tesouraria.
          </p>
        </div>

      </div>

      {/* Row: Pending approvals & recent transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Approvals Drawer (2/3 width on desktop) */}
        <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 shadow-sm flex flex-col min-h-[350px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <SquareCheck className="w-4 h-4 text-amber-500" />
                Lançamentos Pendentes de Visto Eletrônico
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Transações que necessitam do aval institucional do Dirigente</p>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              {pendingApprovals.length} pendentes
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
            {pendingApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center h-full text-slate-400 py-10">
                <CheckCircleAnimation />
                <span className="text-xs font-bold text-slate-700 mt-3">Tudo em ordem por aqui!</span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-[280px]">Nenhuma transação pendente de aprovação do dirigente no momento.</span>
              </div>
            ) : (
              pendingApprovals.map(t => (
                <div 
                  key={t.id} 
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 rounded-2xl flex items-center justify-between gap-3 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`p-1.5 px-2 rounded-xl shrink-0 font-black text-[10px] ${
                      t.type === 'ENTRADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {t.type === 'ENTRADA' ? 'ENT' : 'SAÍ'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate flex items-center gap-1" title={t.description}>
                        {t.description || 'Sem descrição'}
                        {t.attachment && (
                          <Paperclip className="w-3.5 h-3.5 text-indigo-500 shrink-0" title="Possui comprovante / foto" />
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 truncate">
                        <span className="font-mono font-bold text-slate-500">{t.transactionNum}</span>
                        <span>•</span>
                        <span>{t.date} {t.time}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-600">{t.boxId === 'CAIXA_5_EBD' ? 'Caixa 5%' : 'Caixa Lições'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-mono font-black ${
                      t.type === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(t.amount)}
                    </span>
                    
                    {/* Action buttons based on Role */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onViewTransaction(t)}
                        className="py-1.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] transition-colors shadow-xs"
                        title="Ver Comprovante"
                      >
                        Voucher
                      </button>

                      {(currentUser?.role === 'DIRIGENTE' || currentUser?.role === 'MASTER') && onApproveTransaction ? (
                        <button
                          onClick={() => onApproveTransaction(t.id)}
                          className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer"
                          id={`approve-btn-${t.id}`}
                        >
                          Aprovar
                        </button>
                      ) : (
                        (currentUser?.role !== 'DIRIGENTE' && currentUser?.role !== 'MASTER') && (
                          <div className="flex items-center gap-1 text-[10px] bg-slate-200/50 text-slate-500 border border-slate-200 px-2 py-1 rounded-lg" title="Apenas o perfil Dirigente ou Master pode validar">
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
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          <div className="pb-4 border-b border-slate-100">
            <h4 className="font-extrabold text-sm text-slate-800">Histórico de Caixa Recente</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Últimas movimentações no livro diário</p>
          </div>

          <div className="my-4 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[220px] pr-1">
            {transactions.slice(0, 5).map(t => (
              <div 
                key={t.id} 
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs group cursor-pointer hover:bg-slate-50/60 rounded-xl px-2 -mx-2 transition-colors"
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
                    <span className={`font-black px-1.5 py-0.5 rounded-md text-[9px] ${
                      t.isApproved !== false 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {t.isApproved !== false ? 'Aprovado' : 'Aguardando'}
                    </span>
                    <span className="font-semibold text-slate-600">
                      {t.boxId === 'CAIXA_5_EBD' ? '5% EBD' : 'Lições'}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{t.date}</span>
                  </div>
                </div>

                <span className={`font-mono font-black shrink-0 text-right ${
                  t.type === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {t.type === 'ENTRADA' ? '+' : '-'} {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>

          <button 
            onClick={() => onNavigateToTab('caixas')}
            className="w-full text-center py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-2xs cursor-pointer"
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
