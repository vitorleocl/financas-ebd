import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { UserPlus, Trash2, Edit3, Shield, UserCheck, Check, X, ShieldAlert, RefreshCw, Loader2 } from 'lucide-react';

interface UsersManagementProps {
  users: (User & { passwordHash?: string })[];
  currentUser: User;
  onUpdateUsersList: (updatedUsers: (User & { passwordHash?: string })[]) => void;
  onLogAudit: (action: string, details: string) => void;
  simulationRole: UserRole | null;
  onSelectSimulationRole: (role: UserRole | null) => void;
  onForceSync?: () => Promise<void>;
}

export default function UsersManagement({ 
  users, 
  currentUser, 
  onUpdateUsersList, 
  onLogAudit,
  simulationRole,
  onSelectSimulationRole,
  onForceSync
}: UsersManagementProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('VISITANTE');
  
  // Local syncing states
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  const handleForceSyncClick = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      if (onForceSync) {
        await onForceSync();
        setSyncSuccess("Sincronização realizada com sucesso! Os usuários mais recentes foram carregados.");
        onLogAudit(
          'Forçar Sincronização',
          `Sincronizou manualmente os usuários e estados a partir do Google Firestore.`
        );
        setTimeout(() => setSyncSuccess(null), 5000);
      }
    } catch (err: any) {
      console.error(err);
      setSyncError("Erro ao sincronizar dados do Firestore: " + (err.message || err));
    } finally {
      setSyncing(false);
    }
  };
  
  // Adding user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('VISITANTE');
  const [formError, setFormError] = useState<string | null>(null);

  // Start editing a user
  const handleStartEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingUserId(null);
  };

  // Save edit
  const handleSaveEdit = (userId: string) => {
    if (!editName.trim()) return;

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const previousRole = targetUser.role;

    const updated = users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          name: editName.trim(),
          role: editRole,
          avatarColor: editRole === 'MASTER' ? 'bg-indigo-900' : editRole === 'TESOUREIRO' ? 'bg-blue-600' : editRole === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500'
        };
      }
      return u;
    });

    onUpdateUsersList(updated);
    onLogAudit(
      'Ajuste de Usuário',
      `Modificou o usuário ${targetUser.username}: Nome de "${targetUser.name}" para "${editName}", Cargo de "${previousRole}" para "${editRole}".`
    );
    setEditingUserId(null);
  };

  // Delete user from synced list
  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser.id) {
      alert("Você não pode deletar si mesmo!");
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    if (window.confirm(`Tem certeza que deseja remover o usuário ${targetUser.name} (${targetUser.username})?`)) {
      const filtered = users.filter(u => u.id !== userId);
      onUpdateUsersList(filtered);
      onLogAudit(
        'Remoção de Usuário',
        `Removeu o perfil de acesso do usuário ${targetUser.name} (${targetUser.username}) do sistema.`
      );
    }
  };

  // Add new user configuration
  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const emailClean = newEmail.trim().toLowerCase();
    const nameClean = newName.trim();

    if (!nameClean || !emailClean) {
      setFormError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (users.some(u => u && u.username && u.username.toLowerCase() === emailClean)) {
      setFormError("Este e-mail já está configurado no sistema.");
      return;
    }

    const newUser: User & { passwordHash?: string } = {
      id: `fb-invite-${Date.now()}`,
      name: nameClean,
      username: emailClean,
      role: newRole,
      avatarColor: newRole === 'MASTER' ? 'bg-indigo-900' : newRole === 'TESOUREIRO' ? 'bg-blue-600' : newRole === 'DIRIGENTE' ? 'bg-emerald-600' : 'bg-slate-500'
    };

    const updated = [newUser, ...users];
    onUpdateUsersList(updated);
    onLogAudit(
      'Pré-cadastro de Usuário',
      `Cadastrou e reservou o perfil de ${nameClean} (${emailClean}) com cargo de ${newRole}.`
    );

    // Reset form
    setNewName('');
    setNewEmail('');
    setNewRole('VISITANTE');
    setShowAddForm(false);
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'MASTER':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'TESOUREIRO':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DIRIGENTE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden font-sans p-6 sm:p-8 space-y-6 animate-fade-in" id="users-mgmt-view">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 pb-5 gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-805 tracking-tight flex items-center gap-2">
            <Shield className="w-5.5 h-5.5 text-indigo-600" />
            Controle de Usuários Firebase
          </h3>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Gerencie cargos, permissões e nomes dos colaboradores da EBD vinculados ao Firebase.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={syncing}
            onClick={handleForceSyncClick}
            className={`rounded-xl py-2.5 px-4 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer ${
              syncing 
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100'
            }`}
          >
            {syncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Forçar Sincronização
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-indigo-600 text-white rounded-xl py-2.5 px-4 font-bold text-xs shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer"
          >
            {showAddForm ? (
              <>
                <X className="w-3.5 h-3.5" />
                Cancelar
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                Pré-Cadastrar Usuário
              </>
            )}
          </button>
        </div>
      </div>

      {syncSuccess && (
        <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-3.5 rounded-2xl border border-emerald-100 flex items-center gap-2 animate-fade-in" id="sync-success-banner">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncSuccess}</span>
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 text-red-800 text-xs font-bold p-3.5 rounded-2xl border border-red-100 flex items-center gap-2 animate-fade-in" id="sync-error-banner">
          <X className="w-4 h-4 text-red-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-xs text-slate-600 space-y-1">
        <span className="font-extrabold text-slate-700 block">💡 Dica de Integração Google / Firebase</span>
        <p>
          Qualquer colaborador que fizer o primeiro acesso via **Entrar com o Google** ou realizar cadastro com e-mail será **adicionado a esta lista automaticamente** com perfil inicial de <span className="font-bold text-slate-700">VISITANTE</span>. 
          Como administrador, você não precisa pré-cadastrá-los; basta localizá-los na tabela abaixo após o primeiro login para atualizar seus cargos ou gerenciar seus acessos!
        </p>
      </div>

      {/* Add User Form overlay/card */}
      {showAddForm && (
        <form onSubmit={handleAddUserSubmit} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 animate-slide-up">
          <div className="flex gap-2 items-center text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            <UserPlus className="w-4.5 h-4.5 text-indigo-600" />
            <span>Configurar Acesso Antecipado Firebase</span>
          </div>

          {formError && (
            <div className="bg-red-50 text-red-800 text-xs font-bold p-3 rounded-lg border border-red-100">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nome Completo</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Amanda Bezerra"
                className="block w-full border border-slate-250 bg-white rounded-xl p-2.5 text-xs text-slate-800 font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">E-mail Firebase</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ex: amanda@dominio.com"
                className="block w-full border border-slate-250 bg-white rounded-xl p-2.5 text-xs text-slate-800 font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Cargo no Sistema</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="block w-full border border-slate-250 bg-white rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="VISITANTE">Visitante (Sem Permissão de Leitura ou Gravação)</option>
                <option value="TESOUREIRO">Tesoureiro (Saldos & Fechamento)</option>
                <option value="DIRIGENTE">Dirigente (Vistos & Auditoria Geral)</option>
                <option value="MASTER">Master (Controle Administrativo Total)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Salvar Configuração de Perfil
            </button>
          </div>
        </form>
      )}

      {/* Users table/card listings */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        
        {/* DESKTOP VIEW: Hidden on mobile, shown on md screens and up */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Usuário / E-mail</th>
                <th className="px-6 py-4">Cargo Atual</th>
                <th className="px-6 py-4">Status de Sincronia</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-xs font-semibold text-slate-800">
              
              {/* Force Master User to be represented first if they log in */}
              <tr className="bg-purple-50/20 font-bold">
                <td className="px-6 py-4 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center border border-purple-200">
                    VL
                  </span>
                  <div>
                    <div className="text-[11px] font-black">{currentUser.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{currentUser.username}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-0.5 text-[9px] font-black tracking-wider uppercase border rounded-md ${getRoleBadgeColor('MASTER')}`}>
                    MASTER
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Sessão Ativa
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500">Alternar Cargo:</span>
                    <select
                      value={simulationRole || 'MASTER'}
                      onChange={(e) => {
                        const val = e.target.value;
                        onSelectSimulationRole(val === 'MASTER' ? null : val as UserRole);
                      }}
                      className="border border-slate-200 rounded-lg p-1 text-[10px] bg-white font-bold outline-none text-slate-700 cursor-pointer"
                    >
                      <option value="MASTER">MASTER</option>
                      <option value="TESOUREIRO">TESOUREIRO</option>
                      <option value="DIRIGENTE">DIRIGENTE</option>
                      <option value="VISITANTE">VISITANTE</option>
                    </select>
                  </div>
                </td>
              </tr>

              {users
                .filter(u => u && u.username && currentUser && currentUser.username && u.username.toLowerCase() !== currentUser.username.toLowerCase())
                .map(u => {
                  const isEditing = editingUserId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="space-y-1.5 max-w-xs">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Nome de exibição</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 block w-full bg-white font-semibold outline-none"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full ${u.avatarColor || 'bg-indigo-50'} text-slate-700 font-black text-xs flex items-center justify-center`}>
                              {(u.name || 'Membro').substring(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="text-[11px] font-bold text-slate-700">{u.name}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{u.username}</div>
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="space-y-1.5 w-44">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-bold">Cargo</label>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as UserRole)}
                              className="border border-slate-200 rounded-lg p-1 px-1.5 text-xs text-slate-800 w-full bg-white font-bold outline-none"
                            >
                              <option value="TESOUREIRO">TESOUREIRO</option>
                              <option value="DIRIGENTE">DIRIGENTE</option>
                              <option value="MASTER">MASTER</option>
                              <option value="VISITANTE">VISITANTE</option>
                            </select>
                          </div>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 text-[9px] font-black tracking-wider uppercase border rounded-md ${getRoleBadgeColor(u.role)}`}>
                            {u.role}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {u.id.startsWith('fb-invite-') ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Convite Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Acesso Vinculado
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(u.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Confirmar alteração"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 text-slate-450 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Descartar mudanças"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(u)}
                                className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Ajustar perfil / cargo"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Remover acesso"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {users.filter(u => u && u.username && currentUser && currentUser.username && u.username.toLowerCase() !== currentUser.username.toLowerCase()).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                    Nenhum outro usuário configurado. Clique em &ldquo;Pré-Cadastrar Usuário&rdquo; para convidar novos colaboradores da EBD.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW: Shown on small screens, hidden on md and up */}
        <div className="block md:hidden bg-slate-50/50 p-4 space-y-4">
          
          {/* Active Master Session Card */}
          <div className="bg-purple-50/10 border border-purple-200/40 rounded-2xl p-4 space-y-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center border border-purple-200 shrink-0">
                  VL
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-800 truncate">{currentUser.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{currentUser.username}</div>
                </div>
              </div>
              <span className={`inline-flex px-2 py-0.5 text-[8px] font-black tracking-wider uppercase border rounded-md shrink-0 ${getRoleBadgeColor('MASTER')}`}>
                MASTER
              </span>
            </div>
            
            <div className="pt-2 border-t border-purple-100/30 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sessão Ativa (Você)
              </span>
              
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Simular:</span>
                <select
                  value={simulationRole || 'MASTER'}
                  onChange={(e) => {
                    const val = e.target.value;
                    onSelectSimulationRole(val === 'MASTER' ? null : val as UserRole);
                  }}
                  className="border border-slate-200 rounded-lg p-1 text-[10px] bg-white font-bold outline-none text-slate-700 cursor-pointer"
                >
                  <option value="MASTER">MASTER</option>
                  <option value="TESOUREIRO">TESOUREIRO</option>
                  <option value="DIRIGENTE">DIRIGENTE</option>
                  <option value="VISITANTE">VISITANTE</option>
                </select>
              </div>
            </div>
          </div>

          {/* List of other users as cards */}
          {users
            .filter(u => u && u.username && currentUser && currentUser.username && u.username.toLowerCase() !== currentUser.username.toLowerCase())
            .map(u => {
              const isEditing = editingUserId === u.id;

              return (
                <div key={u.id} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm transition-all hover:border-slate-200">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-bold">Nome de exibição</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="border border-slate-200 rounded-xl p-2 text-xs text-slate-800 block w-full bg-slate-50 font-semibold outline-none"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-bold">Cargo</label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="border border-slate-200 rounded-xl p-2 text-xs text-slate-800 w-full bg-slate-50 font-bold outline-none"
                        >
                          <option value="TESOUREIRO">TESOUREIRO</option>
                          <option value="DIRIGENTE">DIRIGENTE</option>
                          <option value="MASTER">MASTER</option>
                          <option value="VISITANTE">VISITANTE</option>
                        </select>
                      </div>

                      <div className="flex gap-2 pt-1 justify-end">
                        <button
                          onClick={() => handleSaveEdit(u.id)}
                          className="flex items-center gap-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-[10px]"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-8 h-8 rounded-full ${u.avatarColor || 'bg-indigo-50'} text-slate-700 font-black text-xs flex items-center justify-center shrink-0`}>
                            {(u.name || 'Membro').substring(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{u.name}</div>
                            <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{u.username}</div>
                          </div>
                        </div>
                        
                        <span className={`inline-flex px-1.5 py-0.5 text-[8px] font-black tracking-wider uppercase border rounded-md shrink-0 ${getRoleBadgeColor(u.role)}`}>
                          {u.role}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                        {u.id.startsWith('fb-invite-') ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Convite Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Acesso Vinculado
                          </span>
                        )}

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleStartEdit(u)}
                            className="flex items-center gap-1 py-1 px-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-lg text-[10px] border border-indigo-100 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="flex items-center gap-1 py-1 px-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg text-[10px] border border-red-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Excluir
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

          {users.filter(u => u && u.username && currentUser && currentUser.username && u.username.toLowerCase() !== currentUser.username.toLowerCase()).length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-400 italic text-xs">
              Nenhum outro usuário configurado. Clique em &ldquo;Pré-Cadastrar Usuário&rdquo; para convidar novos colaboradores da EBD.
            </div>
          )}

        </div>

      </div>

      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-xs text-indigo-850">
        <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold block mb-0.5">Segurança & Auditoria</span>
          <span>Como Administrador Master, qualquer mudança de cargo ou ajuste efetuado reflete instantaneamente nos próximos logins do Firebase, e todas as ações ficam registradas no diário de auditoria imutável.</span>
        </div>
      </div>
    </div>
  );
}
