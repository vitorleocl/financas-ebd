/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuditLog } from '../types';
import { Eye, ShieldAlert, History, Clock, FileWarning, Search, Monitor, Filter } from 'lucide-react';

interface AuditoryViewProps {
  logs: AuditLog[];
}

export default function AuditoryView({ logs }: AuditoryViewProps) {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const optDate = d.toLocaleDateString('pt-BR');
      const optTime = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return { date: optDate, time: optTime };
    } catch {
      return { date: isoStr, time: '' };
    }
  };

  // Extract unique actions for dropdown filtering
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));

  const filteredLogs = logs.filter(log => {
    // 1. Dropdown Action Filter
    if (filterAction !== 'ALL' && log.action !== filterAction) return false;
    
    // 2. Search Text
    if (search.trim()) {
      const q = search.toLowerCase();
      const userMatch = log.userName.toLowerCase().includes(q);
      const roleMatch = log.userRole.toLowerCase().includes(q);
      const detailsMatch = log.details.toLowerCase().includes(q);
      const actMatch = log.action.toLowerCase().includes(q);
      if (!userMatch && !roleMatch && !detailsMatch && !actMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Search and Filters Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4 no-printClient">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <div>
              <h4 className="font-extrabold text-sm text-slate-800 tracking-tight">Rastros de Auditoria Eletrônica</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Histórico imutável de todas as ações administrativas</p>
            </div>
          </div>
          <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-lg p-1 px-2.5 flex items-center gap-1.5 uppercase tracking-wide">
            <ShieldAlert className="w-4 h-4 animation-pulse" />
            Histórico Protegido
          </span>
        </div>

        {/* Input box filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
          
          <div className="space-y-1">
            <label className="text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-indigo-500" /> Buscar nos Registros
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquise por usuário, ação ou detalhe..."
              className="block w-full border border-slate-200 rounded-xl p-2.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-500" /> Tipo de Ação
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="block w-full border border-slate-200 bg-white rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Todas as Ações</option>
              {uniqueActions.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 bg-slate-50 rounded-xl px-4 py-2 flex flex-col justify-center border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Volume Total Monitorado</span>
            <span className="text-lg font-black text-slate-700 font-mono mt-1">{filteredLogs.length} eventos listados</span>
          </div>

        </div>

      </div>

      {/* Audit Log Table visual design */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-semibold">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-3">Data & Hora</th>
                <th className="p-3">Usuário</th>
                <th className="p-3">Cargo RBAC</th>
                <th className="p-3">Ação Executada</th>
                <th className="p-3">IP Endereço</th>
                <th className="p-3">Registros de Mudanças</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 italic">
                    Nenhum vestígio correspondente nos audit logs.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const stamp = formatDateTime(log.timestamp);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors text-slate-700 font-semibold">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                          <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{stamp.date}</span>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-bold">{stamp.time}</span>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{log.userName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider font-mono border ${
                          log.userRole === 'TESOUREIRO' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : log.userRole === 'DIRIGENTE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {log.userRole}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-400 flex items-center gap-1.5 py-4">
                        <Monitor className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{log.ip}</span>
                      </td>
                      <td className="p-3 text-slate-500 font-medium leading-normal max-w-sm">{log.details}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
