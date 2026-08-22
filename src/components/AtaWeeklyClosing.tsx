/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { X, Printer, ShieldCheck, Signature, UserCheck, FileDown, Loader2 } from 'lucide-react';
import { WeeklyClosing, Transaction } from '../types';
import { exportWeeklyClosingToPDF } from '../lib/pdfExport';

interface AtaWeeklyClosingProps {
  closing: WeeklyClosing;
  transactions: Transaction[];
  onClose: () => void;
}

export default function AtaWeeklyClosing({ closing, transactions, onClose }: AtaWeeklyClosingProps) {
  const [isExportingPDF, setIsExportingPDF] = useState(false);

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

  const handleDownloadPDF = async () => {
    try {
      setIsExportingPDF(true);
      await exportWeeklyClosingToPDF(closing, transactions);
    } catch (err) {
      console.error('Erro ao gerar relatório em PDF com jsPDF:', err);
      alert('Erro ao exportar PDF. Por favor tente novamente ou use a opção de impressão.');
    } finally {
      setIsExportingPDF(false);
    }
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
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative flex flex-col my-8 max-h-[90vh]"
      >
        {/* Nav Header */}
        <div className="p-5 text-white flex items-center justify-between bg-slate-900 no-print border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/40">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">Ata de Fechamento Financeiro</h3>
              <p className="text-xs text-indigo-300 font-mono">ID: {closing.closingNum}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Baixar Relatório Oficial em PDF (jsPDF)"
              id="export-pdf-top-btn"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Exportar PDF</span>
                </>
              )}
            </button>

            <button 
              onClick={onClose} 
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-slate-300 hover:text-white"
              title="Fechar"
              id="close-ata-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Body */}
        <div className="p-8 md:p-10 overflow-y-auto flex-1 space-y-6 text-slate-800">
          
          {/* Official Letterhead */}
          <div className="text-center pb-6 border-b-2 border-slate-900 space-y-1">
            <h1 className="text-lg font-black tracking-wider text-slate-900 uppercase">
              IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS EM PERNAMBUCO (IEADALPE)
            </h1>
            <p className="text-sm font-bold text-indigo-900">ESCOLA BÍBLICA DOMINICAL (EBD) • CONGREGAÇÃO JARDIM PAULISTA BAIXO</p>
            <p className="text-xs font-semibold text-slate-600">DEPARTAMENTO DE FINANÇAS E TESOURARIA</p>
          </div>

          {/* Title of Document */}
          <div className="text-center pt-1">
            <h2 className="text-base font-extrabold uppercase text-slate-900 underline underline-offset-4 tracking-wide">
              ATA FINANCEIRA DE APURAÇÃO DE SALDOS ({closing.closingNum})
            </h2>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              Período de Apuração: de <span className="font-bold text-slate-800">{formatDate(closing.startDate)}</span> a <span className="font-bold text-slate-800">{formatDate(closing.endDate)}</span>
            </p>
          </div>

          {/* Legal / Administrative Narrative */}
          <div className="text-xs leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="first-letter:text-2xl first-letter:font-bold first-letter:text-slate-900 first-letter:mr-1">
              Aos {formatDate(closing.closedAt).split('/')[0]} dias do mês de {new Date(closing.closedAt).toLocaleString('pt-BR', { month: 'long' })} de {new Date(closing.closedAt).getFullYear()}, sob a orientação administrativa da diretoria da Escola Bíblica Dominical, reuniu-se a equipe de tesouraria para consolidar os lançamentos financeiros da Escola Bíblica Dominical, apurando os devidos fluxos detalhados a seguir:
            </p>
          </div>

          {/* Financial Summary Table */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Resumo Estatístico do Caixa</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="p-3 font-bold text-slate-700">Indicador Caixa Geral</th>
                    <th className="p-3 text-right font-bold text-slate-700">Valor Computado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  <tr>
                    <td className="p-3 text-slate-700">Saldo Anterior Acumulado</td>
                    <td className="p-3 text-right text-slate-700 font-mono">{formatCurrency(closing.startingBalance)}</td>
                  </tr>
                  <tr className="bg-emerald-50/40">
                    <td className="p-3 text-emerald-800 font-bold">(+) Total Recebido na Semana (Entradas / Ofertas)</td>
                    <td className="p-3 text-right text-emerald-700 font-mono font-bold">+{formatCurrency(closing.totalInflows)}</td>
                  </tr>
                  <tr className="bg-red-50/40">
                    <td className="p-3 text-red-800 font-bold">(-) Total de Despesas Pagas (Saídas / Custos)</td>
                    <td className="p-3 text-right text-red-700 font-mono font-bold">-{formatCurrency(closing.totalOutflows)}</td>
                  </tr>
                  <tr className="bg-indigo-50/50">
                    <td className="p-3 text-slate-900 font-extrabold text-xs">(=) SALDO CONSOLIDADO FINAL</td>
                    <td className="p-3 text-right text-indigo-900 font-mono font-black text-sm">{formatCurrency(closing.endingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit trail list of transactions */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
              Transações Conciliadas no Período ({cycleTransactions.length})
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                    <th className="p-2 border-r border-slate-200">Voucher</th>
                    <th className="p-2 border-r border-slate-200">Tipo / Caixa</th>
                    <th className="p-2 border-r border-slate-200">Data</th>
                    <th className="p-2 border-r border-slate-200">Responsável</th>
                    <th className="p-2 border-r border-slate-200">Descrição</th>
                    <th className="p-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cycleTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 italic font-medium">
                        Nenhuma transação movimentada e aprovada neste período.
                      </td>
                    </tr>
                  ) : (
                    cycleTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 font-medium">
                        <td className="p-2 border-r border-slate-200 font-mono text-slate-700 font-bold">{t.transactionNum}</td>
                        <td className="p-2 border-r border-slate-200">
                          <span className={`inline-block font-bold px-1.5 py-0.5 rounded mr-1 text-[10px] ${
                            t.type === 'ENTRADA' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {t.type === 'ENTRADA' ? 'ENTRADA' : 'SAÍDA'}
                          </span>
                          <span className="text-slate-500 text-[10px]">{t.boxId === 'CAIXA_5_EBD' ? '5% EBD' : 'Lições'}</span>
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono text-slate-600">{formatDate(t.date)}</td>
                        <td className="p-2 border-r border-slate-200 text-slate-700 font-semibold truncate max-w-[100px]" title={t.responsible}>{t.responsible}</td>
                        <td className="p-2 border-r border-slate-200 text-slate-500 text-[10px] truncate max-w-[130px]" title={t.description}>{t.description || '-'}</td>
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
              <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider block">Observações e Parecer da Tesouraria</span>
              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-xl leading-relaxed font-medium">{closing.comments}</p>
            </div>
          )}

          {/* Approval & Signature Blocks */}
          <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-6 text-center text-xs">
            {/* Treasurer Sign Column */}
            <div className="space-y-2.5 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Signature className="w-3.5 h-3.5 text-indigo-600" /> Relator / Tesoureiro Responsável
              </span>
              <div className="w-full max-w-[240px] h-20 border-b-2 border-slate-400 flex items-center justify-center p-1 bg-slate-50/50 rounded-lg">
                {closing.treasurerSignature ? (
                  <img 
                    src={closing.treasurerSignature} 
                    alt="Assinatura Tesoureiro" 
                    className="max-h-16 max-w-full object-contain" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <span className="text-slate-400 italic text-[11px]">Sem Rubrica Digital</span>
                )}
              </div>
              <div>
                <p className="font-bold text-slate-900">{closing.treasurerName}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">TESOURARIA GERAL EBD</p>
                <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{formatDateTime(closing.closedAt)}</p>
              </div>
            </div>

            {/* Dirigente Approver Column */}
            <div className="space-y-2.5 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" /> Visto / Homologação Pastoral
              </span>
              <div className="w-full max-w-[240px] h-20 border-b-2 border-slate-400 flex flex-col items-center justify-center p-1 bg-slate-50/50 rounded-lg">
                {closing.status === 'APROVADO' ? (
                  <div className="flex flex-col items-center">
                    <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-extrabold text-[11px] tracking-wide uppercase">
                      ✓ Visto Eletrônico Homologado
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono mt-1">Status: Conferido e Aprovado</span>
                  </div>
                ) : (
                  <span className="text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 font-bold text-[10px] tracking-wide uppercase">
                    Aguardando Visto da Direção
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-slate-900">Pr. Carlos Mendes</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">DIRIGENTE / SUPERINTENDENTE EBD</p>
                {closing.dirigenteApprovedAt && (
                  <p className="text-[9px] text-slate-400 mt-0.5 font-mono">Visto em: {formatDateTime(closing.dirigenteApprovedAt)}</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono italic">
            Ata Financeira emitida eletronicamente via Sistema EBD Finanças • ID: {closing.id} • Válido para impressão física e arquivo permanente.
          </div>

        </div>

        {/* Footer actions no print */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors bg-slate-100 cursor-pointer"
          >
            Fechar Janela
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            id="print-ata-btn"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Imprimir Direto (Navegador)
          </button>
          
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2 shadow-md shadow-indigo-200 transition-all hover:shadow active:scale-95 cursor-pointer disabled:opacity-50"
            id="export-pdf-bottom-btn"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Exportar Relatório em PDF</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
