/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BoxId, Category, TransactionType } from '../types';
import SignaturePad from './SignaturePad';
import { 
  PlusCircle, AlertCircle, Calendar, DollarSign, PenTool, LayoutGrid, CheckCircle, 
  Camera, Upload, Trash2, Image as ImageIcon, Loader2
} from 'lucide-react';

interface TransactionFormProps {
  categories: Category[];
  onSubmit: (data: {
    type: TransactionType;
    boxId: BoxId;
    amount: number;
    date: string;
    categoryId: string;
    description: string;
    signature: string;
    attachment?: string;
  }) => void;
  currentUser: { name: string; role: string } | null;
  onNavigateToDashboard?: () => void;
}

// Client-side image compression to ensure attachments stay lightweight (< 80KB) and safe for Firestore
const compressImageFile = (file: File | Blob, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(e.target?.result as string || '');
        }
      };
      img.onerror = () => {
        resolve(e.target?.result as string || '');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

export default function TransactionForm({ categories, onSubmit, currentUser, onNavigateToDashboard }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('ENTRADA');
  const [boxId, setBoxId] = useState<BoxId>('CAIXA_5_EBD');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [signature, setSignature] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  // Filter categories by movement type
  const filteredCategories = categories.filter(cat => cat.type === type);

  const [attachment, setAttachment] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Automatically select first category of list when list updates
  useEffect(() => {
    if (filteredCategories.length > 0) {
      setCategoryId(filteredCategories[0].id);
    } else {
      setCategoryId('');
    }
  }, [type, categories]);

  // Clean up webcam on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // File change handler with lightweight compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('O arquivo de comprovante deve ter no máximo 10MB.');
        return;
      }
      setIsProcessingFile(true);
      try {
        const compressedDataUrl = await compressImageFile(file);
        setAttachment(compressedDataUrl);
      } catch (err) {
        console.error("Erro ao comprimir anexo:", err);
      } finally {
        setIsProcessingFile(false);
      }
    }
  };

  // Start webcam
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Prefer back camera on mobile
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setCameraError('Não foi possível acessar a câmera do dispositivo. Verifique as permissões.');
      setIsCameraActive(false);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Capture photo from webcam with compression
  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setAttachment(dataUrl);
        stopCamera();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate Value
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Por favor, informe um valor financeiro válido maior que zero.');
      return;
    }

    // Validate Category
    if (!categoryId) {
      setError('Por favor, selecione uma categoria válida.');
      return;
    }

    // Validate Signature
    if (!signature) {
      setError('A assinatura digital do responsável é obrigatória para concluir a transação.');
      return;
    }

    // Process submission
    onSubmit({
      type,
      boxId,
      amount: numAmount,
      date,
      categoryId,
      description,
      signature,
      attachment: attachment || undefined
    });

    setSuccess(true);
    
    // Clear form fields
    setAmount('');
    setDescription('');
    setSignature(null);
    setAttachment(null);
    stopCamera();

    // Auto fadeout success badge after 6s
    setTimeout(() => {
      setSuccess(false);
    }, 6000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
        <PlusCircle className="w-5 h-5 text-indigo-600" />
        <h3 className="font-extrabold text-slate-800 tracking-tight text-base">Nova Movimentação Financeira</h3>
      </div>

      {success && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slide-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Lançamento cadastrado com sucesso!</p>
              <p className="text-xs text-emerald-700">A movimentação foi salva e está listada em <strong>"Lançamentos Pendentes de Visto Eletrônico"</strong> no Dashboard.</p>
            </div>
          </div>
          {onNavigateToDashboard && (
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
            >
              Ir para o Dashboard →
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-start gap-2.5 animate-bounce-subtle">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Atenção Necessária</p>
            <p className="text-xs text-amber-700">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector tab-button */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setType('ENTRADA')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              type === 'ENTRADA'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Entradas (Ofertas/Doações)
          </button>
          
          <button
            type="button"
            onClick={() => setType('SAIDA')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              type === 'SAIDA'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Saídas (Despesas/Compras)
          </button>
        </div>

        {/* Amount and Date row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-indigo-500" /> Valor R$ <span className="text-red-500">*</span>
            </label>
            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xs font-medium">BRL</span>
              </div>
              <input
                type="text"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="block w-full pl-11 pr-3 py-2.5 sm:text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Data Operação <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full px-3 py-2.5 sm:text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-semibold"
            />
          </div>
        </div>

        {/* Box selector and Category selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-500" /> Caixa Associado <span className="text-red-500">*</span>
            </label>
            <select
              value={boxId}
              onChange={(e) => setBoxId(e.target.value as BoxId)}
              className="block w-full px-3 py-2.5 sm:text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-medium"
            >
              <option value="CAIXA_5_EBD">Caixa 01 - 5% EBD</option>
              <option value="CAIXA_LICOES">Caixa 02 - Lições</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-500" /> Categoria <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="block w-full px-3 py-2.5 sm:text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-medium"
            >
              {filteredCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* User context information */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">Responsável Técnico</span>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-800 block">{currentUser?.name || 'Tesoureiro'}</span>
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5 uppercase tracking-wide">
              {currentUser?.role || 'Apoiador'}
            </span>
          </div>
        </div>

        {/* Detailed description */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Descrição detalhada
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Exemplo: Compra de materiais de suporte para a sala preparatória de professores."
            rows={2}
            className="block w-full px-3 py-2.5 sm:text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 placeholder-slate-400"
          />
        </div>

        {/* Comprovante / Anexo (Opcional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-indigo-500" /> Comprovante / Recibo (Opcional)
          </label>
          
          <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-center text-center space-y-3">
            {!attachment && !isCameraActive && (
              <>
                <div className="p-3 bg-white rounded-full shadow-sm border border-slate-100 text-slate-400">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Adicione uma foto do comprovante</p>
                  <p className="text-[10px] text-slate-400 mt-1">Carregue um arquivo de imagem ou utilize a câmera</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-[11px] font-bold cursor-pointer transition-all shadow-sm">
                    <Upload className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Anexar Arquivo / Foto</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange} 
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[11px] font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    Tirar Foto
                  </button>
                </div>
              </>
            )}

            {isCameraActive && (
              <div className="w-full max-w-sm mx-auto space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-200 shadow-inner">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold animate-pulse">
                    CÂMERA ATIVA
                  </div>
                </div>
                
                {cameraError && (
                  <p className="text-[10px] text-red-500 font-medium bg-red-50 border border-red-100 p-2 rounded-lg">{cameraError}</p>
                )}

                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Capturar Foto
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {attachment && (
              <div className="w-full max-w-xs mx-auto p-2 bg-white rounded-xl border border-slate-100 shadow-sm relative group">
                <img 
                  src={attachment} 
                  alt="Comprovante" 
                  className="w-full h-32 object-contain rounded-lg bg-slate-50"
                />
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-500 transition-all shadow-sm cursor-pointer"
                    title="Remover Comprovante"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Imagem Anexada
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="text-[10px] text-red-500 font-semibold hover:underline cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mandatory Signature Canvas drawing box */}
        <div className="pt-2">
          <SignaturePad onChange={setSignature} value={signature} />
        </div>

        {/* Submission button */}
        <button
          type="submit"
          className="w-full mt-4 bg-slate-900 border border-slate-800 text-white rounded-xl py-3 px-4 font-bold text-xs shadow-md transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer"
        >
          Salvar Movimentação e Emitir Recibo
        </button>
      </form>
    </div>
  );
}
