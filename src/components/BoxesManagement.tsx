/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Transaction, Category, BoxId, User } from '../types';
import { ArrowLeftRight, Landmark, Calendar, Search, ArrowUpRight, ArrowDownRight, FileText, CheckCircle, AlertCircle, Trash2, Paperclip } from 'lucide-react';
import SignaturePad from './SignaturePad';

interface BoxesManagementProps {
  boxes: Box[];
  transactions: Transaction[];
  categories: Category[];
  currentUser: User | null;
  onViewTransaction: (tx: Transaction) => void;
  onDeleteTransaction?: (txId: string) => void;
  onTransfer: (data: {
    fromBox: BoxId;
    toBox: BoxId;
    amount: number;
    description: string;
    signature: string;
  }) => void;
}

export default function BoxesManagement({
  boxes,
  transactions,
  categories,
  currentUser,
  onViewTransaction,
  onDeleteTransaction,
  onTransfer
}: BoxesManagementProps) {
  const [selectedBoxId, setSelectedBoxId] = useState<BoxId>('CAIXA_5_EBD');
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Transfer form fields
  const [fromBox, setFromBox] = useState<BoxId>('CAIXA_5_EBD');
  const [toBox, setToBox] = useState<BoxId>('CAIXA_LICOES');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferSign, setTransferSign] = useState<string | null>(null);
  
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const selectedBox = boxes.find(b => b.id === selectedBoxId);
  const boxTransactions = transactions.filter(t => t.boxId === selectedBoxId);

  // Filter calculations
  const filteredBoxTransactions = boxTransactions.filter(t => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const descMatch = (t.description || '').toLowerCase().includes(q);
      const numMatch = (t.transactionNum || '').toLowerCase().includes(q);
      const respMatch = (t.responsible || '').toLowerCase().includes(q);
      if (!descMatch && !numMatch && !respMatch) return false;
    }
    
    // 2. Type Filter
    if (filterType !== 'ALL' && t.type !== filterType) return false;
    
    // 3. Category Filter
    if (filterCategory !== 'ALL' && t.categoryId !== filterCategory) return false;
    
    // 4. Date range Filter
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    
    return true;
  });

  // Sync toBox opposite to fromBox for transfer
  const handleFromBoxChange = (val: BoxId) => {
    setFromBox(val);
    setToBox(val === 'CAIXA_5_EBD' ? 'CAIXA_LICOES' : 'CAIXA_5_EBD');
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    setTransferSuccess(false);

    const val = parseFloat(transferAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setTransferError('Por favor informe um valor decimal válido maior que zero.');
      return;
    }

    const currentSourceBox = boxes.find(b => b.id === fromBox);
    if (currentSourceBox && currentSourceBox.balance < val) {
      setTransferError(`Saldo insuficiente no caixa de origem. Saldo atual: ${formatCurrency(currentSourceBox.balance)}`);
      return;
    }

    if (!transferDesc.trim()) {
      setTransferError('Por favor descreva o motivo administrativo do repasse.');
      return;
    }

    if (!transferSign) {
      setTransferError('A assinatura do responsável é obrigatória para atestar a transferência.');
      return;
    }

    onTransfer({
      fromBox,
      toBox,
      amount: val,
      description: transferDesc,
      signature: transferSign
    });

    setTransferSuccess(true);
    setTransferAmount('');
    setTransferDesc('');
    setTransferSign(null);

    setTimeout(() => {
      setTransferSuccess(false);
      setShowTransferForm(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      
      {/* Box Cards selection container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {boxes.map(box => {
          const isSelected = selectedBoxId === box.id;
          return (
            <div
              key={box.id}
              onClick={() => setSelectedBoxId(box.id)}
              className={`p-6 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-slate-900 border-slate-800 text-white shadow-md shadow-indigo-950/20'
                  : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-800 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase ${
                  isSelected ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/25' : 'bg-slate-100/80 text-slate-500 border border-slate-200/55'
                }`}>
                  {box.id === 'CAIXA_5_EBD' ? 'Caixa 01' : 'Caixa 02'}
                </span>
                <Landmark className={`w-5 h-5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
              </div>

              <h3 className="font-extrabold text-base mb-1 tracking-tight">{box.name}</h3>
              <p className={`text-[11px] leading-relaxed line-clamp-2 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                {box.description}
              </p>

              <div className="border-t border-dashed mt-5 pt-4 flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>
                  Saldo Aprovado e Líquido
                </span>
                <span className={`text-xl font-black font-mono tracking-tight ${isSelected ? 'text-indigo-300' : 'text-indigo-600'}`}>
                  {formatCurrency(box.balance)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid: ledger table and transfer initiator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Ledger view for this specific box (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-2">
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 tracking-tight flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-indigo-600" />
                  Livro de Lançamentos: {selectedBox?.name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Visão unificada das movimentações deste caixa</p>
              </div>

              <div className="flex items-center gap-2">
                {boxTransactions.length !== filteredBoxTransactions.length && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-55 text-indigo-600 animate-pulse">
                    Filtrado: {filteredBoxTransactions.length} de {boxTransactions.length}
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                  {boxTransactions.length} total
                </span>
              </div>
            </div>

            {/* Inline Search and Advanced Filters */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-6 text-[10px] font-bold space-y-3 no-print">
              <div className="flex items-center gap-1.5 text-slate-750 pb-1.5 border-b border-slate-200/60">
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>Busca Rápida e Filtros de Fluxo</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full border border-slate-200 rounded-lg bg-white p-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Data Termino</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full border border-slate-200 rounded-lg bg-white p-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Tipo</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="block w-full border border-slate-200 rounded-lg bg-white p-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  >
                    <option value="ALL">Todos os Tipos</option>
                    <option value="ENTRADA">Entradas (+)</option>
                    <option value="SAIDA">Saídas (-)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Categoria</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="block w-full border border-slate-200 rounded-lg bg-white p-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  >
                    <option value="ALL">Todas as Categorias</option>
                    {categories.filter(cat => {
                      // Optionally filter categories based on selected flow type
                      if (filterType !== 'ALL' && cat.type !== filterType) return false;
                      return true;
                    }).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-1 border-t border-slate-200/40">
                <div className="md:col-span-4 space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Buscar palavras-chave (Descrição, Cód, Responsável)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ex: dízimo, cpad, lancamento, voucher..."
                      className="block w-full border border-slate-200 rounded-lg bg-white p-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterType('ALL');
                      setFilterCategory('ALL');
                      setStartDate('');
                      setEndDate('');
                    }}
                    disabled={!searchQuery && filterType === 'ALL' && filterCategory === 'ALL' && !startDate && !endDate}
                    className="w-full text-center py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 font-bold tracking-wide transition-all"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-3">Num</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Descrição / Resp</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-center no-print bg-slate-50 px-2 py-0.5 rounded-full">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBoxTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400 italic">
                        {boxTransactions.length === 0 
                          ? 'Nenhum fluxo registrado neste caixa até o momento.'
                          : 'Nenhum lançamento corresponde aos termos de busca aplicados.'}
                      </td>
                    </tr>
                  ) : (
                    filteredBoxTransactions.map(t => {
                      const categoryObj = categories.find(c => c.id === t.categoryId);
                      const isApprovedVal = t.isApproved;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/75 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-600">{t.transactionNum}</td>
                          <td className="p-3 text-slate-500">{formatDate(t.date)}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-700 bg-slate-100/90 text-[10px] px-2 py-0.5 rounded-full">
                              {categoryObj?.name || 'Geral'}
                            </span>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-700 text-[11px] max-w-[200px] truncate flex items-center gap-1" title={t.description}>
                              {t.description || 'S/D'}
                              {t.attachment && (
                                <Paperclip className="w-3 h-3 text-indigo-600 shrink-0" title="Possui comprovante / foto" />
                              )}
                            </p>
                            <p className="text-[9px] text-slate-400 mt-0.5 font-semibold">Resp: {t.responsible}</p>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-mono font-black ${
                              t.type === 'ENTRADA' ? 'text-emerald-600' : 'text-red-500'
                            }`}>
                              {t.type === 'ENTRADA' ? '+' : '-'} {formatCurrency(t.amount)}
                            </span>
                            <span className="text-[9px] block text-slate-400 font-bold">
                              {isApprovedVal ? 'Conciliado' : 'Aprovando'}
                            </span>
                          </td>
                          <td className="p-3 text-center no-print whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => onViewTransaction(t)}
                                className="inline-flex items-center gap-1 py-1 px-1.5 border border-indigo-200 hover:border-indigo-500 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold font-mono transition-all cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                VER
                              </button>
                              
                              {currentUser?.role !== 'VISITANTE' && (
                                confirmDeleteTxId === t.id ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onDeleteTransaction) {
                                          onDeleteTransaction(t.id);
                                        }
                                        setConfirmDeleteTxId(null);
                                      }}
                                      className="py-1 px-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold font-mono transition-all cursor-pointer"
                                    >
                                      SIM
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteTxId(null)}
                                      className="py-1 px-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 rounded text-[10px] font-bold font-mono transition-all cursor-pointer"
                                    >
                                      NÃO
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteTxId(t.id)}
                                    className="inline-flex items-center gap-1 py-1 px-1.5 border border-red-200 hover:border-red-500 rounded bg-red-50 hover:bg-red-100 text-red-750 text-[10px] font-bold font-mono transition-all cursor-pointer"
                                    title="Excluir ou cancelar este lançamento permanentemente"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    EXCLUIR
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Transfer Widget (1/3 width) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          {!showTransferForm ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div className="max-w-xs mx-auto">
                <h4 className="font-bold text-sm text-slate-800">Transferências de Recursos</h4>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Permite o repasse administrativo de fundos entre Caixa 01 (5% EBD) e Caixa 02 (Lições CPAD).
                </p>
              </div>
              {currentUser?.role === 'VISITANTE' ? (
                <p className="text-[10px] text-red-500 font-semibold bg-red-50 border border-red-100 rounded-lg p-2.5">
                  Apenas Tesoureiros autorizados podem movimentar transferências de fundos.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTransferForm(true)}
                  className="mx-auto flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold text-xs shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Transferir Recursos
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-slide-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                  Repasse Inter-caixas
                </h4>
                <button
                  onClick={() => {
                    setShowTransferForm(false);
                    setTransferError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                >
                  Cancelar
                </button>
              </div>

              {transferSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex items-start gap-1.5 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Sucesso!</span>
                    <span className="text-[10px]">Lançamentos de repasse compensados e aprovados automaticamente.</span>
                  </div>
                </div>
              )}

              {transferError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-start gap-1.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Erro de validação</span>
                    <span className="text-[10px]">{transferError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs font-semibold">
                {/* Source Account box selection */}
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase tracking-wider block">Origem do Dinheiro</label>
                  <select
                    value={fromBox}
                    onChange={(e) => handleFromBoxChange(e.target.value as BoxId)}
                    className="block w-full border border-slate-200 rounded-xl bg-white p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="CAIXA_5_EBD">Caixa 01 - 5% EBD</option>
                    <option value="CAIXA_LICOES">Caixa 02 - Lições</option>
                  </select>
                </div>

                {/* Target Account box selection */}
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase tracking-wider block">Destino do Dinheiro</label>
                  <select
                    value={toBox}
                    disabled
                    className="block w-full border border-slate-200 rounded-xl bg-slate-50 p-2.5 text-slate-500"
                  >
                    <option value="CAIXA_5_EBD">Caixa 01 - 5% EBD</option>
                    <option value="CAIXA_LICOES">Caixa 02 - Lições</option>
                  </select>
                </div>

                {/* Amount input */}
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase tracking-wider block">Valor R$</label>
                  <input
                    type="text"
                    required
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0,00"
                    className="block w-full border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase tracking-wider block">Motivo do Repasse</label>
                  <textarea
                    required
                    value={transferDesc}
                    onChange={(e) => setTransferDesc(e.target.value)}
                    placeholder="Ex: Doações recebidas no caixa geral repassadas para compra de materiais"
                    rows={2}
                    className="block w-full border border-slate-200 rounded-xl p-2.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Secure Signature Pad */}
                <div className="pt-2">
                  <SignaturePad onChange={setTransferSign} value={transferSign} />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full mt-2 bg-slate-900 text-white rounded-xl py-2.5 font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Concluir Repasse Financeiro
                </button>
              </form>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
