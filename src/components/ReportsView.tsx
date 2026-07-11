/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Transaction, Category, Box } from '../types';
import { FileDown, Printer, Search, Calendar, Landmark, Tag, User, Layers, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ReportsViewProps {
  transactions: Transaction[];
  categories: Category[];
  boxes: Box[];
  onViewTransaction: (tx: Transaction) => void;
}

export default function ReportsView({
  transactions,
  categories,
  boxes,
  onViewTransaction
}: ReportsViewProps) {
  // Filter Fields
  const [filterBox, setFilterBox] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterResponsible, setFilterResponsible] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Extract unique responsible users list for dropdown filter
  const uniqueResponsibles = Array.from(new Set(transactions.map(t => t.responsible)));

  // Filter logic
  const filteredTransactions = transactions.filter(t => {
    // 1. Box Filter
    if (filterBox !== 'ALL' && t.boxId !== filterBox) return false;
    
    // 2. Type Filter
    if (filterType !== 'ALL' && t.type !== filterType) return false;
    
    // 3. Category Filter
    if (filterCategory !== 'ALL' && t.categoryId !== filterCategory) return false;

    // 4. Responsible Filter
    if (filterResponsible !== 'ALL' && t.responsible !== filterResponsible) return false;

    // 5. Date Range Filters
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;

    // 6. Text query search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const descMatch = (t.description || '').toLowerCase().includes(q);
      const respMatch = (t.responsible || '').toLowerCase().includes(q);
      const numMatch = (t.transactionNum || '').toLowerCase().includes(q);
      if (!descMatch && !respMatch && !numMatch) return false;
    }

    return true;
  });

  // Approved only summaries for reporting accuracy
  const reportTransactions = filteredTransactions.filter(t => t.isApproved !== false);

  const totalInflow = reportTransactions
    .filter(t => t.type === 'ENTRADA')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = reportTransactions
    .filter(t => t.type === 'SAIDA')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalInflow - totalOutflow;

  // Compute data for recharts bar chart comparing the two boxes
  const getChartData = () => {
    // We want to calculate the running balance of each box chronologically.
    // Get all approved transactions sorted by date.
    const approvedTxs = [...transactions]
      .filter(t => t.isApproved !== false)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get initial balances
    let ebdBalance = boxes.find(b => b.id === 'CAIXA_5_EBD')?.initialBalance || 0;
    let licoesBalance = boxes.find(b => b.id === 'CAIXA_LICOES')?.initialBalance || 0;

    // Group transactions by date
    const txsByDate: Record<string, Transaction[]> = {};
    approvedTxs.forEach(t => {
      if (!txsByDate[t.date]) {
        txsByDate[t.date] = [];
      }
      txsByDate[t.date].push(t);
    });

    const uniqueDates = Object.keys(txsByDate).sort();

    if (uniqueDates.length === 0) {
      return [
        {
          formattedDate: 'Inicial',
          'Caixa 5% EBD': ebdBalance,
          'Caixa Lições': licoesBalance
        }
      ];
    }

    const dataPoints = uniqueDates.map(date => {
      const dayTxs = txsByDate[date];
      dayTxs.forEach(t => {
        if (t.boxId === 'CAIXA_5_EBD') {
          if (t.type === 'ENTRADA') ebdBalance += t.amount;
          else ebdBalance -= t.amount;
        } else if (t.boxId === 'CAIXA_LICOES') {
          if (t.type === 'ENTRADA') licoesBalance += t.amount;
          else licoesBalance -= t.amount;
        }
      });

      // Format date from "YYYY-MM-DD" to "DD/MM"
      const [year, month, day] = date.split('-');
      const formattedDate = day && month ? `${day}/${month}` : date;

      return {
        date,
        formattedDate,
        'Caixa 5% EBD': Number(ebdBalance.toFixed(2)),
        'Caixa Lições': Number(licoesBalance.toFixed(2))
      };
    });

    // To make sure there is a starting baseline, insert an initial state
    const firstDate = uniqueDates[0];
    const [year, month, day] = firstDate.split('-');
    const prevDay = day ? String(Math.max(1, parseInt(day) - 1)).padStart(2, '0') : '01';
    const initialPoint = {
      date: 'inicial',
      formattedDate: day && month ? `${prevDay}/${month}` : 'Início',
      'Caixa 5% EBD': Number((boxes.find(b => b.id === 'CAIXA_5_EBD')?.initialBalance || 0).toFixed(2)),
      'Caixa Lições': Number((boxes.find(b => b.id === 'CAIXA_LICOES')?.initialBalance || 0).toFixed(2))
    };

    return [initialPoint, ...dataPoints];
  };

  const chartData = getChartData();

  // Handle Export to CSV (Excel formatable)
  const handleExportCSV = () => {
    // CSV Header row
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'Num transacao;Tipo;Caixa;Categoria;Data;Hora;Responsavel;Valor BRL;Descricao;Status\r\n';

    filteredTransactions.forEach(t => {
      const boxName = boxes.find(b => b.id === t.boxId)?.name || '';
      const catName = categories.find(c => c.id === t.categoryId)?.name || '';
      csv += `"${t.transactionNum}";"${t.type}";"${boxName}";"${catName}";"${t.date}";"${t.time}";"${t.responsible}";"${t.amount}";"${(t.description || '').replace(/"/g, '""')}";"${t.isApproved !== false ? 'Aprovado' : 'Pendente'}"\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `EBD_Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Advanced Filters Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4 no-print">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Search className="w-5 h-5 text-indigo-600" />
          <h4 className="font-extrabold text-sm text-slate-800 tracking-tight">Filtros de Auditoria e Relatório</h4>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
          
          <div className="space-y-1">
            <label className="text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5" /> Caixa Associado
            </label>
            <select
              value={filterBox}
              onChange={(e) => setFilterBox(e.target.value)}
              className="block w-full border border-slate-200 rounded-xl bg-white p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Todos os Caixas</option>
              <option value="CAIXA_5_EBD">Caixa Geral (5%)</option>
              <option value="CAIXA_LICOES">Caixa Lições dominicais</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Tipo Lançamento
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block w-full border border-slate-200 rounded-xl bg-white p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Entradas e Saídas</option>
              <option value="ENTRADA">Apenas Entradas</option>
              <option value="SAIDA">Apenas Saídas</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> Categoria
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="block w-full border border-slate-200 rounded-xl bg-white p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Todas as Categorias</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.type === 'ENTRADA' ? 'ENT' : 'SAÍ'})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Responsável Técnico
            </label>
            <select
              value={filterResponsible}
              onChange={(e) => setFilterResponsible(e.target.value)}
              className="block w-full border border-slate-200 rounded-xl bg-white p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Todos os Lançadores</option>
              {uniqueResponsibles.map(resp => (
                <option key={resp} value={resp}>{resp}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full border border-slate-200 rounded-xl p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Data Limite
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full border border-slate-200 rounded-xl p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-slate-500 uppercase tracking-wide">Buscar por descrição / número voucher</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite palavra-chave ou código (Ex: TX-1004)..."
              className="block w-full border border-slate-200 rounded-xl p-2 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

        </div>

        {/* Action Buttons for reports export */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relatório
          </button>
          
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            Exportar para Excel (CSV)
          </button>
        </div>
      </div>

      {/* Structured Reports Balance Sheet (Visible Always, formatted nicely on Print) */}
      <div id="printable-report-area" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
        
        {/* Header printable letterhead */}
        <div className="text-center pb-5 border-b border-dashed border-slate-200">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">ADMINISTRAÇÃO FINANCEIRA DE FINANÇAS EBD</span>
          <h3 className="text-base font-extrabold text-slate-800 tracking-tight">RELATÓRIO FINANCEIRO CONSOLIDADO</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Documento consolidado de auditoria geral contendo transações no período selecionado.
          </p>
        </div>

        {/* Summary figures box layout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wide flex items-center justify-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> Total Entradas (+)
            </span>
            <span className="text-xl font-extrabold text-emerald-600 font-mono tracking-tight mt-1.5 block">
              {formatCurrency(totalInflow)}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wide flex items-center justify-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-red-500" /> Total Despesas (-)
            </span>
            <span className="text-xl font-extrabold text-red-500 font-mono tracking-tight mt-1.5 block">
              {formatCurrency(totalOutflow)}
            </span>
          </div>

          <div className={`rounded-2xl p-4 text-center border ${
            netBalance >= 0 ? 'bg-indigo-50/50 border-indigo-100 text-indigo-900' : 'bg-red-50/50 border-red-100 text-red-900'
          }`}>
            <span className="text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Saldo Líquido do Período
            </span>
            <span className="text-xl font-black font-mono tracking-tight mt-1.5 block">
              {netBalance >= 0 ? '+' : '-'} {formatCurrency(Math.abs(netBalance))}
            </span>
          </div>

        </div>

        {/* Gráfico de Comparação de Caixas (Oculto na impressão para economia de tinta) */}
        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-4 no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Evolução do Saldo dos Caixas</h4>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full uppercase">
              Saldo Acumulado
            </span>
          </div>
          
          <div className="h-72 w-full text-xs font-semibold">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="formattedDate" 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `R$ ${val}`} 
                />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle" 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar 
                  dataKey="Caixa 5% EBD" 
                  fill="#4f46e5" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={50}
                />
                <Bar 
                  dataKey="Caixa Lições" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Main report items table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
            <span>Resultados Filtrados ({filteredTransactions.length} transações)</span>
            <span className="no-print">Clique no voucher para ver a assinatura digital</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-500 uppercase tracking-wider">
                  <th className="p-3">Voucher</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Caixa</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Detalhamento</th>
                  <th className="p-3 text-right">Valor BRL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400 italic">
                      Nenhuma transação atende aos critérios dos filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(t => {
                    const cat = categories.find(c => c.id === t.categoryId);
                    const box = boxes.find(b => b.id === t.boxId);
                    return (
                      <tr 
                        key={t.id} 
                        onClick={() => onViewTransaction(t)}
                        className="hover:bg-slate-50 hover:text-indigo-900 transition-colors cursor-pointer"
                        title="Ver voucher completo"
                      >
                        <td className="p-3 font-mono font-bold text-indigo-950">{t.transactionNum}</td>
                        <td className="p-3 text-slate-500 font-medium">{formatDate(t.date)}</td>
                        <td className="p-3">
                          <span className={`inline-block font-extrabold text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            t.type === 'ENTRADA' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                          }`}>
                            {t.type === 'ENTRADA' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-medium">{box?.name ? box.name.replace('Caixa ', '') : t.boxId}</td>
                        <td className="p-3 text-slate-500">{cat?.name || 'Geral'}</td>
                        <td className="p-3 text-slate-700 font-bold">{t.responsible}</td>
                        <td className="p-3 text-slate-500 text-[11px] truncate max-w-[150px] font-medium" title={t.description}>
                          {t.description || 'Sem descrição.'}
                        </td>
                        <td className={`p-3 text-right font-mono font-black ${
                          t.type === 'ENTRADA' ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {t.type === 'ENTRADA' ? '+' : '-'} {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer print stamp */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 font-mono italic">
          <span>Relatório gerado em {new Date().toLocaleString('pt-BR')}</span>
          <span>EBD Finanças - Registro Administrativo Eletrônico</span>
        </div>

      </div>

    </div>
  );
}
