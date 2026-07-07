/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X, Printer, ShieldCheck, Calendar, Clock, DollarSign, User, Folder, Layers } from 'lucide-react';
import { Transaction, Category, Box } from '../types';
import QRCodeIcon from './QRCodeIcon';

interface TransactionReceiptProps {
  transaction: Transaction;
  category: Category | undefined;
  box: Box | undefined;
  onClose: () => void;
}

export default function TransactionReceipt({ transaction, category, box, onClose }: TransactionReceiptProps) {
  const isEntrada = transaction.type === 'ENTRADA';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      {/* Styles injected specifically for cleaner printing outputs */}
      <style>{`
        @media print {
          body > * {
            display: none !important;
          }
          #printable-receipt-container {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div 
        id="printable-receipt-container"
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative flex flex-col max-h-[90vh]"
      >
        {/* Header Header */}
        <div className={`p-5 text-white flex items-center justify-between no-print ${
          isEntrada ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-red-600 to-rose-700'
        }`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-100 animate-pulse" />
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider">Comprovante de Transação</h3>
              <p className="text-xs text-white/80 font-mono">{transaction.transactionNum}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Fechar"
            id="close-receipt-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Voucher Shell */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
          {/* Institution Header (Visible always, useful for print) */}
          <div className="text-center pb-5 border-b border-dashed border-slate-200">
            <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">Escola Bíblica Dominical</span>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Comprovante Financeiro Oficial</h2>
            <p className="text-xs text-slate-500 mt-0.5">Igreja Evangélica EBD - CNPJ Registrado localmente</p>
          </div>

          {/* Amount Showcase */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center relative overflow-hidden">
            <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider block">Valor Transacionado</span>
            <div className={`text-3xl font-extrabold mt-1.5 ${isEntrada ? 'text-emerald-600' : 'text-red-600'}`}>
              {isEntrada ? '+' : '-'} {formatCurrency(transaction.amount)}
            </div>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border">
              {isEntrada ? (
                <span className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Entrada de Recursos</span>
              ) : (
                <span className="bg-red-50 text-red-700 border-red-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Saída de Caixa</span>
              )}
            </div>
          </div>

          {/* Core Table Grid */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-500" /> Caixa Destino
              </span>
              <p className="font-bold text-slate-700">{box?.name || 'Caixa Geral'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-indigo-500" /> Categoria
              </span>
              <p className="font-semibold text-slate-700">{category?.name || 'Não Categoria'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Data Operação
              </span>
              <p className="font-semibold text-slate-700">{formatDate(transaction.date)}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" /> Hora
              </span>
              <p className="font-semibold text-slate-700 font-mono">{transaction.time}</p>
            </div>

            <div className="col-span-2 space-y-1 border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-500" /> Responsável pela Ação
              </span>
              <p className="font-bold text-slate-700">{transaction.responsible}</p>
            </div>

            <div className="col-span-2 space-y-1">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                Descrição Detalhada
              </span>
              <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed text-xs">
                {transaction.description || 'Nenhuma descrição secundária fornecida.'}
              </p>
            </div>
          </div>

          {/* Signature and Verification QR Code Block */}
          <div className="pt-4 border-t border-dashed border-slate-200 grid grid-cols-5 gap-4 items-center">
            
            <div className="col-span-3 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assinatura do Responsável</span>
              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 flex items-center justify-center min-h-[64px]">
                {transaction.signature ? (
                  <img 
                    src={transaction.signature} 
                    alt="Digital Signature" 
                    className="max-h-16 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs text-amber-600 italic">Sem Assinatura Vinculada</span>
                )}
              </div>
              <p className="text-[9px] text-slate-500 text-center font-mono truncate">{transaction.responsible}</p>
            </div>

            <div className="col-span-2 flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Validação QR</span>
              <QRCodeIcon value={`${transaction.transactionNum}|${transaction.amount}|${transaction.createdAt}`} size={70} />
              <span className="text-[8px] text-slate-400 font-mono font-bold tracking-tight">Autenticidade EBD</span>
            </div>
            
          </div>

          {/* Attached Receipt / Attachment Photo */}
          {transaction.attachment && (
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-500" /> Comprovante Anexado
              </span>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 text-center max-w-sm mx-auto shadow-inner">
                <img 
                  src={transaction.attachment} 
                  alt="Foto do Comprovante" 
                  className="max-h-64 object-contain mx-auto rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Validation Stamp */}
          <div className="bg-slate-50 border border-indigo-100 rounded-xl px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <div className="text-[10px] text-indigo-700 font-medium">
              Documento assinado digitalmente e registrado no Livro Diário EBD sob hash {transaction.id.substring(0, 10)}.
            </div>
          </div>
        </div>

        {/* Footer actions (Hidden on Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors bg-slate-200/60"
          >
            Fechar Janela
          </button>
          
          <button
            type="button"
            onClick={handlePrint}
            className={`px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-sm transition-all hover:shadow hover:brightness-105 active:scale-95 ${
              isEntrada ? 'bg-emerald-600' : 'bg-red-600'
            }`}
            id="print-receipt-btn"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Comprovante
          </button>
        </div>
      </div>
    </div>
  );
}
