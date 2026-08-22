/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, Paintbrush, Undo2, Check, Sparkles } from 'lucide-react';

interface SignaturePadProps {
  onChange: (signatureBase64: string | null) => void;
  value: string | null;
  label?: string;
  required?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export default function SignaturePad({
  onChange,
  value,
  label = 'Assinatura Digital',
  required = true
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [selectedColor, setSelectedColor] = useState<string>('#1e3a8a'); // Deep Blue ink default
  const [selectedWidth, setSelectedWidth] = useState<number>(2.5);
  
  // Keep track of stroke history for undo functionality and re-rendering on canvas resize
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Point[]>([]);

  // Function to redraw all strokes onto the canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed strokes
    strokesRef.current.forEach(stroke => {
      if (stroke.points.length === 0) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        // Single tap dot
        const p = stroke.points[0];
        ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      } else {
        // Smooth bezier curve drawing
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
          const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
        }
        const lastIdx = stroke.points.length - 1;
        ctx.lineTo(stroke.points[lastIdx].x, stroke.points[lastIdx].y);
        ctx.stroke();
      }
    });

    // Draw active stroke
    if (currentStrokeRef.current.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = selectedWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (currentStrokeRef.current.length === 1) {
        const p = currentStrokeRef.current[0];
        ctx.arc(p.x, p.y, selectedWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = selectedColor;
        ctx.fill();
      } else {
        ctx.moveTo(currentStrokeRef.current[0].x, currentStrokeRef.current[0].y);
        for (let i = 1; i < currentStrokeRef.current.length - 1; i++) {
          const midX = (currentStrokeRef.current[i].x + currentStrokeRef.current[i + 1].x) / 2;
          const midY = (currentStrokeRef.current[i].y + currentStrokeRef.current[i + 1].y) / 2;
          ctx.quadraticCurveTo(currentStrokeRef.current[i].x, currentStrokeRef.current[i].y, midX, midY);
        }
        const lastIdx = currentStrokeRef.current.length - 1;
        ctx.lineTo(currentStrokeRef.current[lastIdx].x, currentStrokeRef.current[lastIdx].y);
        ctx.stroke();
      }
    }
  }, [selectedColor, selectedWidth]);

  // Adjust canvas dimensions and scale for High-DPI screens without clearing strokes
  const updateCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set internal canvas resolution
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      redrawCanvas();
    }
  }, [redrawCanvas]);

  // Setup ResizeObserver for responsive touch canvas resizing
  useEffect(() => {
    updateCanvasDimensions();

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasDimensions();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateCanvasDimensions]);

  // If external value is cleared, reset canvas
  useEffect(() => {
    if (!value && strokesRef.current.length > 0) {
      strokesRef.current = [];
      currentStrokeRef.current = [];
      setIsEmpty(true);
      redrawCanvas();
    }
  }, [value, redrawCanvas]);

  // Coordinate calculation relative to canvas display rect
  const getPointerCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Pointer Down (Finger / Stylus / Mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Capture pointer to track smoothly even if dragging slightly outside canvas
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const point = getPointerCoords(e);
    setIsDrawing(true);
    setIsEmpty(false);

    currentStrokeRef.current = [point];
    redrawCanvas();
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const point = getPointerCoords(e);
    currentStrokeRef.current.push(point);
    redrawCanvas();
  };

  // Pointer Up / Cancel
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if already released
    }

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push({
        points: [...currentStrokeRef.current],
        color: selectedColor,
        width: selectedWidth
      });
      currentStrokeRef.current = [];
      redrawCanvas();

      // Export base64
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        onChange(dataUrl);
      }
    }
  };

  // Clear Canvas
  const handleClear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setIsEmpty(true);
    redrawCanvas();
    onChange(null);
  };

  // Undo Last Stroke
  const handleUndo = () => {
    if (strokesRef.current.length > 0) {
      strokesRef.current.pop();
      if (strokesRef.current.length === 0) {
        setIsEmpty(true);
        onChange(null);
      } else {
        const canvas = canvasRef.current;
        if (canvas) {
          redrawCanvas();
          onChange(canvas.toDataURL('image/png'));
        }
      }
      redrawCanvas();
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Paintbrush className="w-3.5 h-3.5 text-indigo-600" />
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {!isEmpty && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check className="w-3 h-3" /> Gravada
            </span>
          )}
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-2">
          {/* Ink color selection */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedColor('#1e3a8a')}
              className={`w-5 h-5 rounded-md transition-all ${
                selectedColor === '#1e3a8a' ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#1e3a8a' }}
              title="Tinta Azul Escuro"
            />
            <button
              type="button"
              onClick={() => setSelectedColor('#0f172a')}
              className={`w-5 h-5 rounded-md transition-all ${
                selectedColor === '#0f172a' ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#0f172a' }}
              title="Tinta Preta Oficial"
            />
          </div>

          {/* Stroke Width Toggle */}
          <button
            type="button"
            onClick={() => setSelectedWidth(w => (w === 2.5 ? 4.0 : 2.5))}
            className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors"
            title="Alternar espessura da caneta"
          >
            {selectedWidth === 2.5 ? 'Traço Fino' : 'Traço Médio'}
          </button>

          {/* Undo button */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={isEmpty}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-semibold py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title="Desfazer último traço"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desfazer</span>
          </button>

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty && !value}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-bold py-1 px-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title="Limpar assinatura"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        </div>
      </div>

      {/* Canvas Drawing Surface */}
      <div 
        ref={containerRef}
        className="relative w-full h-44 rounded-2xl border-2 border-dashed border-slate-300 bg-white hover:border-indigo-400 focus-within:border-indigo-600 transition-all overflow-hidden shadow-inner cursor-crosshair select-none"
        style={{ touchAction: 'none' }}
      >
        {/* Subtle Signature Base Line */}
        <div className="absolute left-8 right-8 bottom-10 border-b border-slate-200 pointer-events-none flex items-center justify-between">
          <span className="text-[9px] text-slate-300 font-mono select-none">✕ Assine acima desta linha</span>
          <span className="text-[9px] text-slate-300 font-mono select-none">IEADALPE EBD</span>
        </div>

        <canvas
          id="signature-touch-canvas"
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block"
          style={{ touchAction: 'none' }}
        />

        {/* Empty State Instructions Overlay */}
        {isEmpty && !value && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 p-4">
            <Sparkles className="w-5 h-5 text-indigo-400/80 mb-1.5 animate-pulse" />
            <p className="text-xs font-bold text-slate-600 text-center">Desenhe sua rubrica / assinatura digital</p>
            <p className="text-[10px] text-slate-400 text-center mt-0.5">
              Compatível com telas de toque (touch), smartphone, tablet, caneta stylus ou mouse
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
        <span>Toque e deslize na área pontilhada para assinar</span>
        <span className="font-mono">Certificação Criptográfica de Imagem</span>
      </div>
    </div>
  );
}
