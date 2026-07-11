/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X, Printer, Calendar, ShieldCheck, Signature, UserCheck } from 'lucide-react';
import { WeeklyClosing, Transaction } from '../types';

interface AtaWeeklyClosingProps {
  closing: WeeklyClosing;
  transactions: Transaction[];
  onClose: () => void;
}

export default function AtaWeeklyClosing({ closing, transactions, onClose }: AtaWeeklyClosingProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('pt-BR');
    } catch {
      return isoStr;
    }
  };

  // Filter transactions belonging to this weekly cycle and approved
  const isDateBetween = (dateStr: string, startStr: string, endStr: string) => {
    return dateStr >= startStr && dateStr <= endStr;
  };

  const cycleTransactions = transactions.filter(
    t => isDateBetween(t.date, closing.startDate, closing.endDate) && t.isApproved !== false
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
      <style>{`
        @media print {
          body > * {
            display: none !important;
          }
          #printable-ata-container {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            padding: 30px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div 
        id="printable-ata-container"
        className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative flex flex-col my-8 max-h-[90vh]"
      >
        {/* Nav Header */}
        <div className="p-5 text-white flex items-center justify-between bg-indigo-900 no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-200" />
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider">Ata de Fechamento Financeiro</h3>
              <p className="text-xs text-indigo-300 font-mono">ID: {closing.closingNum}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Fechar"
            id="close-ata-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Body */}
        <div className="p-8 md:p-10 overflow-y-auto flex-1 space-y-6 text-slate-800">
          
          {/* Official Letterhead */}
          <div className="text-center pb-6 border-b-2 border-slate-900 space-y-1">
            <h1 className="text-xl font-extrabold tracking-widest text-indigo-900 uppercase">ESCOLA BÍBLICA DOMINICAL (EBD)</h1>
            <p className="text-sm font-semibold text-slate-600">DEPARTAMENTO DE FINANÇAS E TESOURARIA</p>
            <p className="text-xs text-slate-400">Rua da Comunhão, 100 - Setor de Administração EBD</p>
          </div>

          {/* Title of Document */}
          <div className="text-center pt-2">
            <h2 className="text-lg font-bold uppercase decoration-dotted text-slate-800 underline underline-offset-4">
              ATA FINANCEIRA DE APURAÇÃO DE SALDOS ({closing.closingNum})
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Período de Apuração: de <span className="font-bold">{formatDate(closing.startDate)}</span> a <span className="font-bold">{formatDate(closing.endDate)}</span>
            </p>
          </div>

          {/* Legal / Administrative Narrative */}
          <div className="text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="first-letter:text-3xl first-letter:font-bold first-letter:text-slate-900 first-letter:mr-2">
              Aos {formatDate(closing.closedAt).split('/')[0]} dias do mês de {new Date(closing.closedAt).toLocaleString('pt-BR', { month: 'long' })} de {new Date(closing.closedAt).getFullYear()}, sob a orientação administrativa do pastor dirigente do campo de trabalho, reuniu-se a equipe de tesouraria para consolidar os lançamentos financeiros da Escola Bíblica Dominical, apurando os devidos fluxos detalhados a seguir:
            </p>
          </div>

          {/* Financial Summary Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Resumo Estatístico do Caixa</h3>
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="p-3 font-semibold text-slate-600">Indicador Caixa Geral</th>
                    <th className="p-3 text-right font-semibold text-slate-600">Valor Computado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-3 text-slate-700 flex items-center gap-1.5 font-medium">Saldo Anterior Acumulado</td>
                    <td className="p-3 text-right text-slate-700 font-mono font-semibold">{formatCurrency(closing.startingBalance)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-emerald-50/45">
                    <td className="p-3 text-emerald-800 font-bold flex items-center gap-1.5">(+) Total Recebido na Semana (Entradas)</td>
                    <td className="p-3 text-right text-emerald-700 font-mono font-bold">{formatCurrency(closing.totalInflows)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-red-50/45">
                    <td className="p-3 text-red-800 font-bold flex items-center gap-1.5">(-) Total de Despesas Pagas (Saídas)</td>
                    <td className="p-3 text-right text-red-700 font-mono font-bold">{formatCurrency(closing.totalOutflows)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-indigo-50/40">
                    <td className="p-3 text-slate-800 font-extrabold flex items-center gap-1.5">SALDO CONSOLIDADO FINAL</td>
                    <td className="p-3 text-right text-indigo-900 font-mono font-extrabold text-base">{formatCurrency(closing.endingBalance)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-500 text-xs italic">Diferença / Ajuste de Caixa Reconciliado</td>
                    <td className="p-3 text-right text-slate-500 font-mono text-xs font-semibold">{formatCurrency(closing.difference)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit trail list of transactions */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Transações Conciliadas no Período ({cycleTransactions.length})</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <th className="p-2 border-r border-slate-200">Num</th>
                    <th className="p-2 border-r border-slate-200 col-span-2">Tipo / Caixa</th>
                    <th className="p-2 border-r border-slate-200">Data</th>
                    <th className="p-2 border-r border-slate-200">Responsável</th>
                    <th className="p-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {cycleTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-3 text-center text-slate-400 italic">Nenhuma transação movimentada e aprovada neste período.</td>
                    </tr>
                  ) : (
                    cycleTransactions.map(t => (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2 border-r border-slate-200 font-mono text-slate-600 font-semibold">{t.transactionNum}</td>
                        <td className="p-2 border-r border-slate-200">
                          <span className={`inline-block font-bold px-1.5 py-0.5 rounded mr-1 ${
                            t.type === 'ENTRADA' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {t.type === 'ENTRADA' ? 'ENTRADA' : 'SAÍDA'}
                          </span>
                          <span className="text-slate-500 font-medium">{t.boxId === 'CAIXA_5_EBD' ? '5% EBD' : 'Lições'}</span>
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono text-slate-600">{formatDate(t.date)}</td>
                        <td className="p-2 border-r border-slate-200 text-slate-600 truncate max-w-[120px]" title={t.responsible}>{t.responsible}</td>
                        <td className={`p-2 text-right font-mono font-bold ${t.type === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === 'ENTRADA' ? '+' : '-'} {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observations and notes */}
          {closing.comments && (
            <div className="space-y-1">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block">Observações do Fechamento</span>
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg leading-relaxed">{closing.comments}</p>
            </div>
          )}

          {/* Approval & Signature Blocks */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
            {/* Treasurer Sign Column */}
            <div className="space-y-3 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Signature className="w-3.5 h-3.5 text-indigo-500" /> Relator da Ata
              </span>
              <div className="w-48 h-16 border-b border-slate-400 flex items-center justify-center p-1 bg-slate-50/50 rounded">
                {closing.treasurerSignature ? (
                  <img src={closing.treasurerSignature} alt="Assinatura Tesoureiro" className="max-h-12 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-slate-400 italic">Sem Rubrica</span>
                )}
              </div>
              <div>
                <p className="font-bold text-slate-800">{closing.treasurerName}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">TESOUREIRO FINANCEIRO EBD</p>
                <p className="text-[9px] text-slate-400 mt-1 font-mono">{formatDateTime(closing.closedAt)}</p>
              </div>
            </div>

            {/* Dirigente Approver Column */}
            <div className="space-y-3 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" /> Visto / Aprovação Geral
              </span>
              <div className="w-48 h-16 border-b border-slate-400 flex flex-col items-center justify-center p-1 bg-slate-50/50 rounded">
                {closing.status === 'APROVADO' ? (
                  <div className="flex flex-col items-center">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-extrabold text-[10px] tracking-wide uppercase">Visto Eletrônico</span>
                    <span className="text-[9px] text-slate-500 font-mono mt-1">Status: Apoiado e Registrado</span>
                  </div>
                ) : (
                  <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold text-[10px] tracking-wide uppercase">Aguardando Visto</span>
                )}
              </div>
              <div>
                <p className="font-bold text-slate-800">Pr. Carlos Mendes</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">DIRIGENTE / SUPERINTENDENTE EBD</p>
                {closing.dirigenteApprovedAt && (
                  <p className="text-[9px] text-slate-400 mt-1 font-mono">{formatDateTime(closing.dirigenteApprovedAt)}</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono italic">
            Ata de Fechamento emitida via sistema EBD - Folha Oficial Eletrônica - Hash: {closing.id}.
          </div>

        </div>

        {/* Footer actions no print */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors bg-slate-200/60"
          >
            Fechar Ata
          </button>
          
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm transition-all hover:shadow active:scale-95"
            id="print-ata-btn"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Ata Financeira
          </button>
        </div>

      </div>
    </div>
  );
}
