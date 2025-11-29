import React, { useState, useEffect, useRef } from "react";
import { Link as LinkIcon, ChevronDown } from "lucide-react";
import { BlockType, QuestionType, DragItem } from "../types";
import { createDragPreview } from "../helpers";

// Helper to mix colors (simple linear interpolation for RGB)
const colorMix = (color1: string, color2: string, weight: number) => {
  const hexToRgb = (hex: string) => {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Standard colors map for fallback
  const standardColors: {[key:string]: string} = { white: "#ffffff", black: "#000000" };
  const c1 = standardColors[color1] || color1;
  const c2 = standardColors[color2] || color2;

  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);

  const w1 = weight / 100;
  const w2 = 1 - w1;

  const r = Math.round(rgb1.r * w1 + rgb2.r * w2);
  const g = Math.round(rgb1.g * w1 + rgb2.g * w2);
  const b = Math.round(rgb1.b * w1 + rgb2.b * w2);

  return rgbToHex(r, g, b);
}

export const ThemeStyle = ({ color }: { color: string }) => {
  // Pre-calculate mixed colors for libraries that don't support CSS color-mix()
  const primary50 = colorMix(color, 'white', 5); // 95% white
  const primary100 = colorMix(color, 'white', 10); // 90% white
  const primary200 = colorMix(color, 'white', 20); // 80% white
  const primary300 = colorMix(color, 'white', 40); // 60% white
  const primary400 = colorMix(color, 'white', 60); // 40% white
  const primary600 = colorMix(color, 'black', 90); // 10% black
  const primary700 = colorMix(color, 'black', 80); // 20% black
  const primary800 = colorMix(color, 'black', 70); // 30% black
  const primary900 = colorMix(color, 'black', 60); // 40% black

  return (
    <style>{`
      :root {
        --primary: ${color};
        --primary-50: ${primary50};
        --primary-100: ${primary100};
        --primary-200: ${primary200};
        --primary-300: ${primary300};
        --primary-400: ${primary400};
        --primary-500: ${color};
        --primary-600: ${primary600};
        --primary-700: ${primary700};
        --primary-800: ${primary800};
        --primary-900: ${primary900};
      }
    `}</style>
  );
};

export const SimpleMarkdown = ({ text }: { text: string }) => {
  if (!text) return null;
  
  // Improved markdown parsing
  let html = text
    // Headers
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-2 mt-4">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-2 mt-3">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mb-1 mt-2">$1</h3>')
    // Bold & Italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 hover:underline">$1</a>')
    // Lists
    .replace(/^\s*-\s(.*)$/gim, '<li class="ml-4 list-disc">$1</li>')
    // Newlines to breaks
    .replace(/\n/g, '<br />');

  return <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
};

interface TooltipButtonProps {
  icon: any;
  label: string;
  onClick: () => void;
  className?: string;
  dragPayload?: { type: BlockType, qType?: QuestionType };
  active?: boolean;
  onDragEnd?: () => void;
  onDragStart?: (type: BlockType) => void;
}

export const TooltipButton = ({ icon: Icon, label, onClick, className = '', dragPayload, active, onDragEnd, onDragStart }: TooltipButtonProps) => {
  const handleDragStart = (e: React.DragEvent) => {
    if (!dragPayload) return;
    
    if (onDragStart) {
        onDragStart(dragPayload.type);
    }

    const dragData: DragItem = { 
      type: 'new-block', 
      payload: dragPayload 
    };
    e.dataTransfer.setData("dragData", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "all"; 
    
    // Create custom ghost image
    const ghost = createDragPreview(label);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  return (
    <div className="group relative flex items-center justify-center font-sans flex-shrink-0">
      <button 
        onClick={onClick}
        draggable={!!dragPayload}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        className={`p-2.5 rounded-xl transition-all ${active ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'} cursor-grab active:cursor-grabbing ${className}`}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </button>
      <div className="absolute bottom-full mb-3 hidden group-hover:block px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded shadow-xl whitespace-nowrap z-[100] pointer-events-none left-1/2 -translate-x-1/2 transform">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  )
}

export const useInputStyle = () => {
  return `bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-800 shadow-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-200)] outline-none transition-all`;
}

export const CustomSelect = ({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block align-middle mx-1 font-sans">
      <button 
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-800 shadow-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-200)] hover:bg-slate-50 outline-none transition-all text-base min-w-[120px]`}
      >
        <span className={`truncate max-w-[150px] ${!value ? 'text-slate-400' : ''}`}>{value || "Select..."}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[150px] bg-white border border-slate-200 rounded-lg shadow-xl z-[100] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 origin-top-left">
           {options.map((opt: string) => (
             <div 
                key={opt} 
                className={`px-3 py-2 text-slate-700 cursor-pointer text-sm transition-colors ${value === opt ? 'bg-[var(--primary-50)] text-[var(--primary-700)] font-medium' : 'hover:bg-slate-50'}`}
                onClick={() => { onChange(opt); setOpen(false); }}
             >
                {opt}
             </div>
           ))}
        </div>
      )}
    </div>
  )
}

export const EmbedRenderer = ({ url, title }: { url: string, title?: string }) => {
  const getEmbedUrl = (input: string) => {
     try {
        const u = new URL(input);
        if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
           const v = u.searchParams.get('v') || u.pathname.split('/').pop();
           return `https://www.youtube.com/embed/${v}`;
        }
        if (u.hostname.includes('vimeo.com')) {
           const v = u.pathname.split('/').pop();
           return `https://player.vimeo.com/video/${v}`;
        }
        return input;
     } catch { return input; }
  };

  const validUrl = getEmbedUrl(url);
  
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
       {validUrl.startsWith('http') ? (
          <iframe 
             src={validUrl} 
             title={title || "Embed"} 
             className="w-full aspect-video" 
             allowFullScreen 
             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
       ) : (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
             <LinkIcon size={32} className="opacity-20"/>
             <p>Invalid or empty URL</p>
          </div>
       )}
       {title && <div className="p-3 bg-white border-t border-slate-100 font-medium text-sm text-slate-700">{title}</div>}
    </div>
  );
};