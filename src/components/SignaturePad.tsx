/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Paintbrush } from 'lucide-react';

interface SignaturePadProps {
  onChange: (signatureBase64: string | null) => void;
  value: string | null;
}

export default function SignaturePad({ onChange, value }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Initialize canvas with clear background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Adjust canvas resolution for high-DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e3a8a'; // deep blue ink
      ctx.lineWidth = 2.5;
    }
  }, []);

  // Redraw if the parent passes a value (such as when clearing)
  useEffect(() => {
    if (!value) {
      clearCanvas();
    }
  }, [value]);

  const getCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Check if touch or mouse event
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e.nativeEvent);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Propagate the signature to parent
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange(null);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Paintbrush className="w-3.5 h-3.5 text-blue-600" />
          Assinatura Digital <span className="text-red-500">*</span>
        </label>
        
        <button
          type="button"
          onClick={clearCanvas}
          disabled={isEmpty && !value}
          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium py-1 px-2 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Eraser className="w-3.5 h-3.5" />
          Limpar Quadro
        </button>
      </div>

      <div className="relative border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-slate-50 hover:bg-slate-100/55 transition-colors cursor-crosshair">
        <canvas
          id="signature-canvas"
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-40 touch-none block"
        />
        
        {isEmpty && !value && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-400">
            <span className="text-sm font-medium">Assine aqui seu nome</span>
            <span className="text-xs text-center mt-1 px-4">Utilize o mouse, tela de toque ou caneta digital</span>
          </div>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-gray-500 italic">
        A assinatura é integrada criptograficamente ao comprovante em formato de imagem imutável.
      </p>
    </div>
  );
}
