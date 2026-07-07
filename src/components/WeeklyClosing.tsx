/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WeeklyClosing as ClosingType, Transaction, User } from '../types';
import { Calendar, ShieldAlert, CheckCircle, FileText, Lock, PenTool, ClipboardCheck, Clock, Trash2 } from 'lucide-react';
import SignaturePad from './SignaturePad';

interface WeeklyClosingProps {
  closings: ClosingType[];
  transactions: Transaction[];
  currentUser: User | null;
  onViewAta: (closing: ClosingType) => void;
  onAddClosing: (data: {
    startDate: string;
    endDate: string;
    totalInflows: number;
    totalOutflows: number;
    startingBalance: number;
    endingBalance: number;
    comments: string;
    treasurerName: string;
    treasurerSignature: string;
  }) => void;
  onApproveClosing?: (closingId: string) => void;
  onDeleteClosing?: (closingId: string) => void;
  onClearAllClosings?: () => void;
}

export default function WeeklyClosing({
  closings,
  transactions,
  currentUser,
  onViewAta,
  onAddClosing,
  onApproveClosing,
  onDeleteClosing,
  onClearAllClosings
}: WeeklyClosingProps) {
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [comments, setComments] = useState('');
  const [treasurerName, setTreasurerName] = useState(currentUser?.name || '');
  const [signature, setSignature] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Determine the date range of the upcoming closing cycle
  const getNextCycleRange = () => {
    if (closings.length === 0) {
      // Default to start of June 2026 if empty
      return {
        start: '2026-06-01',
        end: '2026-06-07'
      };
    }

    // Sort closings by descending endDate
    const sorted = [...closings].sort((a, b) => b.endDate.localeCompare(a.endDate));
    const lastClosing = sorted[0];
    
    // Starting date is the next day after last closing
    const lastEnd = new Date(lastClosing.endDate + 'T12:00:00Z');
    const startObj = new Date(lastEnd);
    startObj.setDate(lastEnd.getDate() + 1);
    const startStr = startObj.toISOString().split('T')[0];

    // Weekly cycle (add 6 days)
    const endObj = new Date(startObj);
    endObj.setDate(startObj.getDate() + 6);
    const endStr = endObj.toISOString().split('T')[0];

    return { start: startStr, end: endStr };
  };

  const nextCycle = getNextCycleRange();

  // Filter approved transactions within the next cycle dates
  const isDateBetween = (dateStr: string, start: string, end: string) => {
    return dateStr >= start && dateStr <= end;
  };

  const cycleTransactions = transactions.filter(
    t => isDateBetween(t.date, nextCycle.start, nextCycle.end) && t.isApproved
  );

  // Computations for next closing
  const getNextCycleBalances = () => {
    // Starting balance should equal the ending balance of the exact last closing
    let startBal = 0.00; // Seed value if first
    if (closings.length > 0) {
      const sorted = [...closings].sort((a, b) => b.endDate.localeCompare(a.endDate));
      startBal = sorted[0].endingBalance;
    }

    const inflows = cycleTransactions
      .filter(t => t.type === 'ENTRADA')
      .reduce((sum, t) => sum + t.amount, 0);

    const outflows = cycleTransactions
      .filter(t => t.type === 'SAIDA')
      .reduce((sum, t) => sum + t.amount, 0);

    const endBal = startBal + inflows - outflows;

    return {
      startBal,
      inflows,
      outflows,
      endBal
    };
  };

  const cycleMetrics = getNextCycleBalances();

  const handleCreateClosing = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!treasurerName.trim()) {
      setFormError('Por favor informe o nome completo do Tesoureiro responsável.');
      return;
    }

    if (!signature) {
      setFormError('Uma rubrica / assinatura digital em tela é obrigatória para registrar a ata de fechamento.');
      return;
    }

    onAddClosing({
      startDate: nextCycle.start,
      endDate: nextCycle.end,
      totalInflows: cycleMetrics.inflows,
      totalOutflows: cycleMetrics.outflows,
      startingBalance: cycleMetrics.startBal,
      endingBalance: cycleMetrics.endBal,
      comments,
      treasurerName,
      treasurerSignature: signature
    });

    // Reset Form
    setComments('');
    setSignature(null);
    setShowClosingForm(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Current/Next Cycle Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Current status KPIs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-150 mb-5">
              <Calendar className="w-5 h-5 text-indigo-600 animate-pulse" />
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 tracking-tight">Período de Apuração em Aberto</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Lançamentos acumulados aguardando conciliação de ata</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center my-4">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Saldo Anterior</span>
                <span className="text-sm font-extrabold text-slate-700 font-mono tracking-tight">
                  {formatCurrency(cycleMetrics.startBal)}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/40 border border-emerald-100/50 rounded-xl space-y-1">
                <span className="text-[10px] text-emerald-600 uppercase font-bold block">Receitas (+)</span>
                <span className="text-sm font-extrabold text-emerald-600 font-mono tracking-tight">
                  + {formatCurrency(cycleMetrics.inflows)}
                </span>
              </div>

              <div className="p-3 bg-red-50/45 border border-red-100/50 rounded-xl space-y-1">
                <span className="text-[10px] text-red-500 uppercase font-bold block">Despesas (-)</span>
                <span className="text-sm font-extrabold text-red-500 font-mono tracking-tight">
                  - {formatCurrency(cycleMetrics.outflows)}
                </span>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/65 flex items-center justify-between mt-5">
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Projeção Próximo Saldo Final</span>
                <span className="text-base font-black text-indigo-900 font-mono tracking-tight">{formatCurrency(cycleMetrics.endBal)}</span>
              </div>

              <div className="text-right text-xs text-slate-500 font-semibold space-y-1">
                <div className="flex items-center gap-1">
                  <span>Ciclo:</span>
                  <span className="font-bold text-slate-800">{formatDate(nextCycle.start)}</span>
                  <span>até</span>
                  <span className="font-bold text-slate-800">{formatDate(nextCycle.end)}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  Contém <span className="font-bold text-indigo-600">{cycleTransactions.length}</span> lançamentos aprovados sob este período.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-50 mt-6 text-right">
            {!showClosingForm ? (
              (currentUser?.role === 'TESOUREIRO' || currentUser?.role === 'MASTER') ? (
                <button
                  onClick={() => setShowClosingForm(true)}
                  className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-200 transition-all cursor-pointer active:scale-95"
                >
                  Iniciar Ata de Fechamento Coletivo
                </button>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl py-2.5 px-4">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  Somente usuários com o perfil de <strong>Tesoureiro ou Master</strong> podem formular fechamentos financeiros.
                </p>
              )
            ) : null}
          </div>
        </div>

        {/* Closing form widget (opens on trigger) */}
        {showClosingForm && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-slide-in">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-4">
              <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                Registrar Ata Semanal
              </span>
              <button
                onClick={() => {
                  setShowClosingForm(false);
                  setFormError(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Voltar
              </button>
            </div>

            {formError && (
              <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-start gap-1.5 text-xs font-semibold">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateClosing} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide block">Nome do Tesoureiro Responsável</label>
                <input
                  type="text"
                  required
                  value={treasurerName}
                  onChange={(e) => setTreasurerName(e.target.value)}
                  className="block w-full border border-slate-200 rounded-xl p-2.5 text-slate-800 bg-slate-50"
                  placeholder="Nome por extenso"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 uppercase tracking-wide block">Parecer / Resumo da Secretária (Opcional)</label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Ex: Conciliação bem sucedida de todas as revistas vendidas..."
                  rows={2}
                  className="block w-full border border-slate-200 rounded-xl p-2.5 text-slate-700 font-medium"
                />
              </div>

              <div>
                <SignaturePad onChange={setSignature} value={signature} />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer"
              >
                Gravar Ata e Enviar para Visto Geral
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Closings archive table */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800 tracking-tight flex items-center gap-1.5">
              <ClipboardCheck className="w-4.5 h-4.5 text-indigo-600" />
              Arquivo Permanente de Atas de Fechamentos
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Livro eletrônico de reconciliações aprovadas e pendentes</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
              {closings.length} atas fechadas
            </span>
            {onClearAllClosings && closings.length > 0 && (currentUser?.role === 'MASTER' || currentUser?.role === 'TESOUREIRO') && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("ATENÇÃO: Tem certeza de que deseja excluir permanentemente TODAS as atas de fechamento do sistema? Esta ação não pode ser desfeita e removerá todo o histórico de atas.")) {
                    onClearAllClosings();
                  }
                }}
                className="py-1 px-2.5 rounded bg-red-50 hover:bg-red-600 border border-red-200 text-red-600 hover:text-white font-bold text-[10px] duration-150 uppercase tracking-wide flex items-center gap-1 cursor-pointer"
                id="clear-all-closings-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Arquivo
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-semibold">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-3">Código Ata</th>
                <th className="p-3">Início Período</th>
                <th className="p-3">Término Período</th>
                <th className="p-3 text-right">Receitas (Inflows)</th>
                <th className="p-3 text-right">Despesas (Outflows)</th>
                <th className="p-3 text-right">Saldo Final</th>
                <th className="p-3 text-center">Status Visto</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {closings.map(close => {
                const isApproved = close.status === 'APROVADO';
                return (
                  <tr key={close.id} className="hover:bg-slate-50 hover:text-slate-900 transition-colors">
                    <td className="p-3 font-mono font-bold text-indigo-900">{close.closingNum}</td>
                    <td className="p-3 text-slate-500">{formatDate(close.startDate)}</td>
                    <td className="p-3 text-slate-500">{formatDate(close.endDate)}</td>
                    <td className="p-3 text-right text-emerald-600 font-mono font-bold">+{formatCurrency(close.totalInflows)}</td>
                    <td className="p-3 text-right text-red-500 font-mono font-bold">-{formatCurrency(close.totalOutflows)}</td>
                    <td className="p-3 text-right text-slate-800 font-mono font-bold text-[13px]">{formatCurrency(close.endingBalance)}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                        isApproved 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isApproved ? 'Aprovado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewAta(close)}
                          className="py-1 px-2.5 rounded bg-indigo-50 hover:bg-slate-900 duration-150 border border-indigo-200 text-indigo-700 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer"
                          title="Exibir Ata Ofical Completa"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Ata
                        </button>

                        {!isApproved && (currentUser?.role === 'DIRIGENTE' || currentUser?.role === 'MASTER') && onApproveClosing && (
                          <button
                            onClick={() => onApproveClosing(close.id)}
                            className="py-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                            id={`approve-closing-btn-${close.id}`}
                          >
                            Dar Visto
                          </button>
                        )}

                        {onDeleteClosing && currentUser?.role !== 'VISITANTE' && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Tem certeza de que deseja excluir a Ata ${close.closingNum}?`)) {
                                onDeleteClosing(close.id);
                              }
                            }}
                            className="py-1 px-2.5 rounded bg-red-50 hover:bg-red-600 duration-150 border border-red-200 text-red-600 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                            title="Excluir Ata de Fechamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
