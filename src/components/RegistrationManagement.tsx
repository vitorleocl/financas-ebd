/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Person, User } from '../types';
import { Users, UserPlus, Search, Phone, Calendar, UserCheck, ShieldAlert, CheckCircle, GraduationCap } from 'lucide-react';

interface RegistrationManagementProps {
  people: Person[];
  currentUser: User | null;
  onAddPerson: (data: {
    name: string;
    type: 'ALUNO' | 'VISITANTE';
    phone?: string;
    classGroup?: string;
  }) => void;
}

export default function RegistrationManagement({
  people,
  currentUser,
  onAddPerson
}: RegistrationManagementProps) {
  const [activeSegment, setActiveSegment] = useState<'ALUNO' | 'VISITANTE'>('ALUNO');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState<'ALUNO' | 'VISITANTE'>('ALUNO');
  const [phone, setPhone] = useState('');
  const [classGroup, setClassGroup] = useState('Adultos');
  
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const isSecretaryOrAdmin = currentUser?.role === 'TESOUREIRO' || currentUser?.role === 'MASTER';

  // Filters list
  const filteredPeople = people.filter(p => {
    if (p.type !== activeSegment) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(q);
      const phoneMatch = (p.phone || '').includes(q);
      const classMatch = (p.classGroup || '').toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !classMatch) return false;
    }
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    if (!name.trim()) {
      setFormError('Por favor informe o nome completo do cadastrável.');
      return;
    }

    onAddPerson({
      name,
      type,
      phone,
      classGroup: type === 'ALUNO' ? classGroup : 'Visita EBD'
    });

    setFormSuccess(true);
    setName('');
    setPhone('');

    setTimeout(() => {
      setFormSuccess(false);
      setShowAddForm(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Selection row & Search search */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4 no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Toggle between ALUNO & VISITANTE */}
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveSegment('ALUNO')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSegment === 'ALUNO'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-250 cursor-pointer'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Alunos Matriculados
          </button>
          
          <button
            onClick={() => setActiveSegment('VISITANTE')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSegment === 'VISITANTE'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-250 cursor-pointer'
            }`}
          >
            <Users className="w-4 h-4" />
            Visitantes Dominical
          </button>
        </div>

        {/* Input search */}
        <div className="flex flex-1 max-w-md items-center relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filtrar listagem de ${activeSegment === 'ALUNO' ? 'alunos' : 'visitantes'}...`}
            className="w-full text-xs font-semibold pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Create button */}
        {isSecretaryOrAdmin ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
            id="register-btn"
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar {activeSegment === 'ALUNO' ? 'Aluno' : 'Visitante'}
          </button>
        ) : (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            Apenas Secretaria
          </span>
        )}
      </div>

      {/* Main Grid: Data table and Insertion drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Renders list (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5 text-slate-800">
            <h4 className="font-extrabold text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              Relação Oficial de Cadastros ({filteredPeople.length})
            </h4>
            <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              {activeSegment}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 uppercase tracking-wider">
                  <th className="p-3">Nome Completo</th>
                  <th className="p-3">Classe/Grupo</th>
                  <th className="p-3">Contato / Telefone</th>
                  <th className="p-3 text-right">Data Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-105">
                {filteredPeople.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-400 italic">
                      Nenhum registro correspondente a esta categoria.
                    </td>
                  </tr>
                ) : (
                  filteredPeople.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 hover:text-slate-950 transition-colors">
                      <td className="p-3 font-bold text-slate-900 flex items-center gap-2 py-4">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-250 flex items-center justify-center font-mono text-[10px] text-slate-600 shrink-0 uppercase">
                          {p.name.substring(0, 2)}
                        </div>
                        <span>{p.name}</span>
                      </td>
                      <td className="p-3 text-indigo-700">
                        <span className="font-bold bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                          {p.classGroup || 'EBD'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {p.phone || 'Sem Telefone'}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-400 font-mono">
                        <span className="flex items-center justify-end gap-1 font-medium">
                          <Calendar className="w-3 h-3" />
                          {formatDate(p.registeredAt)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Creation drawer widget (opens on trigger) */}
        {showAddForm && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-slide-in flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-4">
                <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5 font-sans">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  Novo Cadastro
                </span>
                
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Voltar
                </button>
              </div>

              {formSuccess && (
                <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex items-start gap-1.5 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-[11px]">Salvo com sucesso!</span>
                    <span className="text-[9px]">O registro foi cadastrado e arquivado em auditoria.</span>
                  </div>
                </div>
              )}

              {formError && (
                <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-start gap-1.5 text-xs font-semibold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
                
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Categoria do Cadastro *</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setType('ALUNO');
                        setActiveSegment('ALUNO');
                      }}
                      className={`py-1.5 font-bold rounded-lg text-center ${
                        type === 'ALUNO' ? 'bg-slate-900 text-white' : 'text-slate-500'
                      }`}
                    >
                      Aluno
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setType('VISITANTE');
                        setActiveSegment('VISITANTE');
                      }}
                      className={`py-1.5 font-bold rounded-lg text-center ${
                        type === 'VISITANTE' ? 'bg-slate-900 text-white' : 'text-slate-500'
                      }`}
                    >
                      Visitante
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João Ferreira Albuquerque"
                    className="block w-full border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {type === 'ALUNO' && (
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase tracking-wide block">Classe EBD designada</label>
                    <select
                      value={classGroup}
                      onChange={(e) => setClassGroup(e.target.value)}
                      className="block w-full border border-slate-200 bg-white rounded-xl p-2.5 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Adultos">Classe Adultos</option>
                      <option value="Jovens">Classe Jovens (Família)</option>
                      <option value="Adolescentes">Classe Adolescentes</option>
                      <option value="Primários (Crianças)">Classe Primários (Crianças)</option>
                      <option value="Maternal">Classe Maternal/Berçário</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Número de Telefone (Opcional)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: (11) 98765-4321"
                    className="block w-full border border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 bg-indigo-600 hover:bg-slate-900 border border-indigo-500 text-white rounded-xl py-2.5 font-bold shadow transition-all cursor-pointer"
                >
                  Confirmar Cadastro Oficial
                </button>

              </form>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
