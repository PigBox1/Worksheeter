import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { 
  Plus, 
  Trash2, 
  Type, 
  Link as LinkIcon, 
  Divide, 
  ListOrdered, 
  MessageSquare,
  MousePointerClick,
  TextCursorInput,
  Heading,
  Image as ImageIcon,
  Download,
  Palette,
  Type as TypeIcon,
  FileText,
  Info,
  Check,
  X,
  Eye,
  Edit3,
  Share2,
  Video,
  GripVertical,
  Pencil,
  HelpCircle,
  ChevronDown,
  CheckSquare
} from "lucide-react";

// --- Types & Interfaces ---

type BlockType = 'text' | 'divider' | 'embed' | 'group' | 'question';
type QuestionType = 'multiple-choice' | 'open-answer' | 'cloze-text' | 'cloze-dropdown' | 'drag-inline';

interface BaseBlock {
  id: string;
  type: BlockType;
}

interface TextBlock extends BaseBlock {
  type: 'text';
  content: string;
}

interface DividerBlock extends BaseBlock {
  type: 'divider';
}

interface EmbedBlock extends BaseBlock {
  type: 'embed';
  url: string;
  title?: string;
}

interface QuestionBlock extends BaseBlock {
  type: 'question';
  qType: QuestionType;
  prompt: string; // Acts as Title for complex questions
  listItems?: string[]; // For multi-line cloze/drag questions
  image?: string | null; // URL
  description?: string | null;
  // For MC
  options?: string[];
  multiSelect?: boolean;
  correctAnswer?: string | string[]; 
}

interface GroupBlock extends BaseBlock {
  type: 'group';
  title?: string;
  children: (QuestionBlock | TextBlock)[]; 
}

type Block = TextBlock | DividerBlock | EmbedBlock | QuestionBlock | GroupBlock;

interface DesignSettings {
  accentColor: string; // Hex code
  font: 'sans' | 'serif' | 'mono';
}

interface WorksheetData {
  title: string;
  description: string;
  blocks: Block[];
  design?: DesignSettings;
}

interface DragItem {
  id?: string;
  index?: number;
  parentId?: string;
  type: 'block' | 'new-block';
  payload?: { type: BlockType, qType?: QuestionType };
}

// --- Context ---

const ThemeContext = React.createContext<DesignSettings>({
  accentColor: '#6366f1', // Default Indigo-500
  font: 'sans'
});

// --- Helpers ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const createBlock = (type: BlockType, qType?: QuestionType): Block => {
  const id = generateId();
  if (type === 'question') {
    const isComplex = qType === 'cloze-text' || qType === 'cloze-dropdown' || qType === 'drag-inline';
    
    return { 
      id, 
      type: 'question', 
      qType: qType!, 
      prompt: isComplex ? 'Complete the sentences:' : 'New Question', 
      listItems: qType === 'cloze-text' ? ['The capital of France is [Paris].'] : 
                 qType === 'cloze-dropdown' ? ['The sky is [blue|green|red].'] : 
                 qType === 'drag-inline' ? ['The [cat] sat on the [mat].'] : undefined,
      options: qType === 'multiple-choice' ? ['Option 1', 'Option 2'] : undefined 
    };
  } else if (type === 'text') {
    return { id, type: 'text', content: 'Write some **markdown** text here...' };
  } else if (type === 'group') {
    return { id, type: 'group', title: 'Question Group', children: [] };
  } else if (type === 'embed') {
    return { id, type: 'embed', url: '' };
  } else {
    return { id, type: 'divider' };
  }
};

const encodeState = (data: WorksheetData) => {
  try {
    return btoa(JSON.stringify(data));
  } catch (e) {
    console.error("Failed to encode", e);
    return "";
  }
};

const decodeState = (hash: string): WorksheetData | null => {
  try {
    const json = atob(hash.replace("#data=", ""));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
};

// --- CSS Variable Generator ---
const ThemeStyle = ({ color }: { color: string }) => {
  return (
    <style>{`
      :root {
        --primary: ${color};
        --primary-50: color-mix(in srgb, var(--primary), white 95%);
        --primary-100: color-mix(in srgb, var(--primary), white 90%);
        --primary-200: color-mix(in srgb, var(--primary), white 80%);
        --primary-300: color-mix(in srgb, var(--primary), white 60%);
        --primary-400: color-mix(in srgb, var(--primary), white 40%);
        --primary-500: var(--primary);
        --primary-600: color-mix(in srgb, var(--primary), black 10%);
        --primary-700: color-mix(in srgb, var(--primary), black 20%);
        --primary-800: color-mix(in srgb, var(--primary), black 30%);
        --primary-900: color-mix(in srgb, var(--primary), black 40%);
      }
    `}</style>
  );
};

// --- Components ---

const SimpleMarkdown = ({ text }: { text: string }) => {
  if (!text) return null;
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-2">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-2">$1</h2>')
    .replace(/\n/g, '<br />');

  return <div className="prose prose-slate max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: html }} />;
};

interface TooltipButtonProps {
  icon: any;
  label: string;
  onClick: () => void;
  className?: string;
  dragPayload?: { type: BlockType, qType?: QuestionType };
  active?: boolean;
}

const TooltipButton = ({ icon: Icon, label, onClick, className = '', dragPayload, active }: TooltipButtonProps) => {
  const handleDragStart = (e: React.DragEvent) => {
    if (!dragPayload) return;
    const dragData: DragItem = { 
      type: 'new-block', 
      payload: dragPayload 
    };
    e.dataTransfer.setData("dragData", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "all"; 
  };

  return (
    <div className="group relative flex items-center justify-center font-sans">
      <button 
        onClick={onClick}
        draggable={!!dragPayload}
        onDragStart={handleDragStart}
        className={`p-2.5 rounded-xl transition-all ${active ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'} cursor-grab active:cursor-grabbing ${className}`}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </button>
      <div className="absolute bottom-full mb-2 hidden group-hover:block px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded shadow-xl whitespace-nowrap z-[60] pointer-events-none left-1/2 -translate-x-1/2">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  )
}

// --- Player Components ---

const useInputStyle = () => {
  return `bg-white border border-slate-300 rounded-md px-2 py-1 text-slate-800 shadow-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-200)] outline-none transition-all`;
}

// Custom Select Component for Dropdown Cloze
const CustomSelect = ({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) => {
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

const MultipleChoicePlayer = ({ block, onChange, value }: { block: QuestionBlock, onChange: (val: any) => void, value: any }) => {
  const isMulti = block.multiSelect;
  const isSelected = (opt: string) => {
    if (isMulti) {
        return Array.isArray(value) && value.includes(opt);
    }
    return value === opt;
  };

  const handleChange = (opt: string) => {
    if (isMulti) {
        const current = Array.isArray(value) ? value : [];
        if (current.includes(opt)) {
            onChange(current.filter((o: string) => o !== opt));
        } else {
            onChange([...current, opt]);
        }
    } else {
        onChange(opt);
    }
  };

  return (
    <div className="flex flex-col gap-3 mt-3">
      {block.options?.map((opt, idx) => {
        const selected = isSelected(opt);
        return (
            <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected ? `bg-[var(--primary-50)] border-[var(--primary-300)] ring-1 ring-[var(--primary-300)]` : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
            <div className={`w-5 h-5 ${isMulti ? 'rounded-md' : 'rounded-full'} border flex items-center justify-center ${selected ? `border-[var(--primary)] bg-[var(--primary)] text-white` : 'border-slate-300'}`}>
                {selected && (isMulti ? <Check size={14} strokeWidth={3} /> : <div className={`w-2.5 h-2.5 rounded-full bg-white`} />)}
            </div>
            <input 
                type={isMulti ? "checkbox" : "radio"}
                name={block.id} 
                value={opt} 
                checked={selected} 
                onChange={() => handleChange(opt)} 
                className="hidden" 
            />
            <span className="text-slate-700">{opt}</span>
            </label>
        );
      })}
    </div>
  );
};

const OpenAnswerPlayer = ({ onChange, value }: { onChange: (val: any) => void, value: any }) => {
  const inputStyle = useInputStyle();
  return (
    <textarea 
      className={`w-full mt-3 min-h-[100px] ${inputStyle} p-3`}
      placeholder="Type your answer here..."
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

const ClozeTextPlayer = ({ block, onChange, value }: { block: QuestionBlock, onChange: (val: any) => void, value: any }) => {
  const inputStyle = useInputStyle();
  const currentAnswers = value || {};

  return (
    <div className="flex flex-col gap-4">
      {block.listItems?.map((line, lineIdx) => {
        const parts = line.split(/\[(.*?)\]/g);
        return (
          <div key={lineIdx} className="leading-9 text-lg text-slate-800">
            {parts.map((part, index) => {
              if (index % 2 === 0) return <span key={index}>{part}</span>;
              const gapKey = `${lineIdx}-${Math.floor(index / 2)}`;
              return (
                <input
                  key={index}
                  type="text"
                  className={`mx-1 min-w-[120px] max-w-[200px] text-center inline-block ${inputStyle}`}
                  value={currentAnswers[gapKey] || ''}
                  onChange={(e) => onChange({ ...currentAnswers, [gapKey]: e.target.value })}
                />
              );
            })}
          </div>
        )
      })}
    </div>
  );
};

const ClozeDropdownPlayer = ({ block, onChange, value }: { block: QuestionBlock, onChange: (val: any) => void, value: any }) => {
  const currentAnswers = value || {};

  return (
    <div className="flex flex-col gap-4">
      {block.listItems?.map((line, lineIdx) => {
        const parts = line.split(/\[(.*?)\]/g);
        return (
          <div key={lineIdx} className="leading-9 text-lg text-slate-800">
             {parts.map((part, index) => {
              if (index % 2 === 0) return <span key={index}>{part}</span>;
              const options = part.split('|');
              const gapKey = `${lineIdx}-${Math.floor(index / 2)}`;
              return (
                <CustomSelect
                  key={index}
                  options={options}
                  value={currentAnswers[gapKey] || ''}
                  onChange={(val) => onChange({ ...currentAnswers, [gapKey]: val })}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const DragInlinePlayer = ({ block, onChange, value }: { block: QuestionBlock, onChange: (val: any) => void, value: any }) => {
  const currentAnswers = value || {};
  
  // Aggregate word bank from all lines
  const availableWords = React.useMemo(() => {
    const allWords: string[] = [];
    block.listItems?.forEach(line => {
      const parts = line.split(/\[(.*?)\]/g);
      parts.forEach((p, i) => { if (i % 2 !== 0) allWords.push(p); });
    });

    const counts: Record<string, number> = {};
    allWords.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    
    // Decrement counts for used answers
    Object.values(currentAnswers).forEach((ans: any) => {
      if (typeof ans === 'string' && counts[ans]) counts[ans]--;
    });

    const bank: string[] = [];
    Object.entries(counts).forEach(([word, count]) => {
      for (let i = 0; i < count; i++) bank.push(word);
    });
    return bank.sort(); 
  }, [block.listItems, currentAnswers]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {block.listItems?.map((line, lineIdx) => {
            const parts = line.split(/\[(.*?)\]/g);
            return (
              <div key={lineIdx} className="leading-loose text-lg text-slate-800">
                {parts.map((part, index) => {
                  if (index % 2 === 0) return <span key={index}>{part}</span>;
                  const gapKey = `${lineIdx}-${Math.floor(index / 2)}`;
                  const filledWord = currentAnswers[gapKey];
                  return (
                    <span
                      key={index}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); onChange({ ...currentAnswers, [gapKey]: e.dataTransfer.getData("text/plain") }); }}
                      onClick={() => { const n = {...currentAnswers}; delete n[gapKey]; onChange(n); }}
                      className={`inline-flex items-center justify-center mx-1 px-3 py-1 min-w-[100px] rounded-md border transition-all align-middle cursor-pointer 
                        ${filledWord ? `bg-[var(--primary-100)] border-[var(--primary)] text-[var(--primary-900)] font-bold border-solid shadow-sm` : 'bg-white border-slate-300 border-dashed text-slate-400'}`}
                    >
                      {filledWord || "Drop here"}
                    </span>
                  );
                })}
              </div>
            )
        })}
      </div>

      {/* Word Bank Styled like Input */}
      {availableWords.length > 0 ? (
        <div className="p-4 bg-white border border-slate-200 rounded-md shadow-sm flex flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase w-full mb-1">Word Bank</span>
          {availableWords.map((word, i) => (
             <div key={i} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", word)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 shadow-sm rounded-md cursor-grab active:cursor-grabbing hover:shadow-md hover:border-[var(--primary-300)] text-slate-700 font-medium">
               {word}
             </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-400 text-sm italic">All words used</div>
      )}
    </div>
  );
};

// --- Embed Renderer ---
const EmbedRenderer = ({ url, title }: { url: string, title?: string }) => {
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


// --- Editor Block ---

interface EditorBlockWrapperProps {
  block: Block;
  index: number;
  parentId?: string;
  label?: string;
  updateBlock: (id: string, parentId: string | undefined, newData: Block) => void;
  removeBlock: (id: string, parentId: string | undefined) => void;
  handleDrop: (e: React.DragEvent, targetId?: string, targetParentId?: string, targetIndex?: number) => void;
  dragTarget?: { id: string, pos: 'top' | 'bottom' } | null;
  setDragTarget?: (t: { id: string, pos: 'top' | 'bottom' } | null) => void;
}

const EditorBlockWrapper = ({ block, index, parentId, label, updateBlock, removeBlock, handleDrop, dragTarget, setDragTarget }: EditorBlockWrapperProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const onBadgeDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const dragData: DragItem = { id: block.id, index, parentId, type: 'block' };
    e.dataTransfer.setData("dragData", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "move";
    
    // Use the whole wrapper as drag image
    if (wrapperRef.current) {
      e.dataTransfer.setDragImage(wrapperRef.current, 0, 0);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (setDragTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const isTop = e.clientY < rect.top + rect.height / 2;
      setDragTarget({ id: block.id, pos: isTop ? 'top' : 'bottom' });
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
     if (setDragTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragTarget(null);
     }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (setDragTarget) setDragTarget(null);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const isTop = e.clientY < rect.top + rect.height / 2;
    handleDrop(e, undefined, parentId, isTop ? index : index + 1);
  };

  // Determine if we need to show helpers for cloze/drag
  const showHelper = block.type === 'question' && ['cloze-text', 'cloze-dropdown', 'drag-inline'].includes((block as QuestionBlock).qType);

  return (
    <div 
      ref={wrapperRef}
      className={`group relative flex transition-all duration-200 px-0 py-3 border-b border-slate-100 last:border-0 ${isFocused ? `bg-[var(--primary-50)]/30 -mx-4 px-4 rounded-xl` : ''}`}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false); }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drop Indicator */}
      {dragTarget?.id === block.id && (
         <div className={`absolute left-0 right-0 h-1 bg-blue-500 rounded-full pointer-events-none z-50 ${dragTarget.pos === 'top' ? '-top-0.5' : '-bottom-0.5'}`}></div>
      )}

      {/* Left Sidebar: Generic Drag Tab */}
      <div className="w-12 flex flex-col items-center pt-2 flex-shrink-0 relative font-sans">
         <div className="relative group/menu w-full flex flex-col items-center justify-center z-[50] gap-2">
            
            {/* Unified Drag Handle */}
            <div 
              draggable
              onDragStart={onBadgeDragStart}
              className="cursor-grab active:cursor-grabbing flex items-center justify-center text-slate-300 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
            >
              <GripVertical size={20} />
            </div>

            {/* Hover Menu on the Drag Handle */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover/menu:flex gap-1 p-1 bg-slate-800 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap z-[100]">
                {block.type === 'question' && (
                  <>
                    <button title="Toggle Image" onClick={() => updateBlock(block.id, parentId, { ...(block as QuestionBlock), image: (block as QuestionBlock).image === undefined ? '' : undefined })} className={`p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white ${(block as QuestionBlock).image !== undefined ? 'text-blue-400' : ''}`}>
                      <ImageIcon size={14} />
                    </button>
                    <button title="Toggle Description" onClick={() => updateBlock(block.id, parentId, { ...(block as QuestionBlock), description: (block as QuestionBlock).description === undefined ? '' : undefined })} className={`p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white ${(block as QuestionBlock).description !== undefined ? 'text-blue-400' : ''}`}>
                      <FileText size={14} />
                    </button>
                    
                    {/* Multi-Select Toggle for MC */}
                    {(block as QuestionBlock).qType === 'multiple-choice' && (
                       <button title="Toggle Multiple Answer" onClick={() => updateBlock(block.id, parentId, { ...(block as QuestionBlock), multiSelect: !(block as QuestionBlock).multiSelect })} className={`p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white ${(block as QuestionBlock).multiSelect ? 'text-blue-400' : ''}`}>
                         <CheckSquare size={14} />
                       </button>
                    )}

                    {/* Syntax Info for Complex */}
                    {showHelper && (
                        <div className="relative group/helper">
                           <button className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white"><HelpCircle size={14} /></button>
                           <div className="absolute left-full top-0 ml-2 w-64 p-3 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl hidden group-hover/helper:block z-[110]">
                              <p className="font-bold text-white mb-1">Syntax Guide:</p>
                              <ul className="list-disc list-inside space-y-1">
                                 <li>Text gap: <code>[answer]</code></li>
                                 <li>Dropdown: <code>[correct|wrong1]</code></li>
                              </ul>
                           </div>
                        </div>
                    )}

                    <div className="w-px bg-slate-600 mx-0.5"></div>
                  </>
                )}
                <button title="Delete" onClick={() => removeBlock(block.id, parentId)} className="p-1.5 rounded hover:bg-red-900/50 text-red-400 hover:text-red-300">
                    <Trash2 size={14} />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 pl-2 relative">
        {block.type === 'text' && (
          <div className="flex gap-2">
            <div className="mt-1"><Type size={14} className="text-slate-300"/></div>
            <textarea
              className="w-full resize-none outline-none text-slate-700 bg-transparent placeholder-slate-300 font-normal"
              placeholder="Type text..."
              value={block.content}
              rows={Math.max(1, block.content.split('\n').length)}
              onChange={(e) => updateBlock(block.id, parentId, { ...block, content: e.target.value })}
            />
          </div>
        )}

        {block.type === 'embed' && (
          <div>
             <div className="flex items-center gap-2 mb-2">
                <div className="bg-slate-100 p-1 rounded text-slate-400"><Video size={14}/></div>
                <input 
                  className="bg-transparent font-medium outline-none text-slate-800 placeholder-slate-300 w-full"
                  placeholder="Video/Embed Title"
                  value={block.title || ''}
                  onChange={(e) => updateBlock(block.id, parentId, { ...block, title: e.target.value })}
                />
             </div>
             <input 
                type="text" 
                className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm mb-2 focus:border-[var(--primary)] outline-none"
                placeholder="Paste YouTube, Vimeo or other URL..."
                value={block.url}
                onChange={(e) => updateBlock(block.id, parentId, { ...block, url: e.target.value })}
             />
             {block.url && <EmbedRenderer url={block.url} />}
          </div>
        )}

        {block.type === 'question' && (
          <div className="flex flex-col-reverse md:flex-row gap-6">
            <div className="flex-1 space-y-3">
               
               {/* Question Prompt / Title */}
               <div className="flex gap-2">
                  <textarea
                      className="flex-1 text-lg font-medium outline-none placeholder-slate-300 resize-none bg-transparent"
                      placeholder="Question Prompt..."
                      value={block.prompt}
                      onChange={(e) => updateBlock(block.id, parentId, { ...block, prompt: e.target.value })}
                      rows={Math.max(1, block.prompt.length / 60)}
                  />
               </div>
               
               {/* Description moved below prompt */}
               {(block as QuestionBlock).description !== undefined && (
                  <div className="bg-slate-50 p-2 rounded-lg flex items-start gap-2 border border-slate-100 focus-within:border-[var(--primary-300)] transition-colors">
                     <Info size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                     <textarea 
                        className="w-full text-sm text-slate-600 bg-transparent outline-none resize-none placeholder-slate-400"
                        placeholder="Context / Description..."
                        value={(block as QuestionBlock).description || ''}
                        onChange={(e) => updateBlock(block.id, parentId, { ...block, description: e.target.value })}
                        rows={1}
                        style={{ minHeight: '1.5em' }}
                        onInput={(e) => { (e.target as HTMLTextAreaElement).style.height = 'auto'; (e.target as HTMLTextAreaElement).style.height = (e.target as HTMLTextAreaElement).scrollHeight + 'px'; }}
                     />
                  </div>
               )}

               {/* Image URL Input */}
               {(block as QuestionBlock).image !== undefined && !(block as QuestionBlock).image && (
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                     <ImageIcon size={16} className="text-slate-400"/>
                     <input 
                        className="bg-transparent text-sm w-full outline-none placeholder-slate-400"
                        placeholder="Paste Image URL..."
                        value={(block as QuestionBlock).image || ''}
                        onChange={(e) => updateBlock(block.id, parentId, { ...block, image: e.target.value })}
                     />
                  </div>
               )}

               {/* Inputs */}
               {block.qType === 'multiple-choice' && (
                  <div className="space-y-2 pl-1">
                     <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Options</span>
                     </div>
                     {block.options?.map((opt: string, optIdx: number) => (
                     <div key={optIdx} className="flex items-center gap-2">
                        <div className={`w-4 h-4 ${(block as QuestionBlock).multiSelect ? 'rounded-md' : 'rounded-full'} border border-slate-300 flex-shrink-0`} />
                        <input 
                           className={`flex-1 text-sm p-1 border-b border-transparent hover:border-slate-200 focus:border-[var(--primary-300)] outline-none bg-transparent`}
                           value={opt}
                           onChange={(e) => {
                              const newOpts = [...(block.options || [])];
                              newOpts[optIdx] = e.target.value;
                              updateBlock(block.id, parentId, { ...block, options: newOpts });
                           }}
                        />
                        <button onClick={() => updateBlock(block.id, parentId, { ...block, options: block.options?.filter((_, i) => i !== optIdx) })} className="text-slate-300 hover:text-red-400"><X size={14} /></button>
                     </div>
                     ))}
                     <button onClick={() => updateBlock(block.id, parentId, { ...block, options: [...(block.options || []), `Option ${(block.options?.length || 0) + 1}`] })} className={`text-xs text-[var(--primary)] font-medium hover:underline flex items-center gap-1 mt-2`}>
                       <Plus size={12} /> Add Option
                     </button>
                  </div>
               )}

               {/* List Builder for Complex Questions */}
               {['cloze-text', 'cloze-dropdown', 'drag-inline'].includes(block.qType) && (
                   <div className="space-y-3 pl-1">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">Sentences</div>
                      {block.listItems?.map((item: string, itemIdx: number) => (
                         <div key={itemIdx} className="flex items-start gap-2">
                            <span className="text-slate-300 mt-2 text-xs">{itemIdx + 1}.</span>
                            <textarea 
                                className="flex-1 text-sm p-2 bg-slate-50 border border-slate-200 rounded focus:border-[var(--primary-300)] outline-none resize-none font-medium text-slate-700"
                                value={item}
                                rows={Math.max(1, item.length / 50)}
                                onChange={(e) => {
                                   const newItems = [...(block.listItems || [])];
                                   newItems[itemIdx] = e.target.value;
                                   updateBlock(block.id, parentId, { ...block, listItems: newItems });
                                }}
                            />
                            <button onClick={() => updateBlock(block.id, parentId, { ...block, listItems: block.listItems?.filter((_, i) => i !== itemIdx) })} className="text-slate-300 hover:text-red-400 mt-2"><X size={14} /></button>
                         </div>
                      ))}
                      <button onClick={() => updateBlock(block.id, parentId, { ...block, listItems: [...(block.listItems || []), 'New sentence with [answer]...'] })} className={`text-xs text-[var(--primary)] font-medium hover:underline flex items-center gap-1 mt-2`}>
                        <Plus size={12} /> Add Sentence
                      </button>
                   </div>
               )}

            </div>

            {/* Image Preview */}
            {(block as QuestionBlock).image && (
               <div className="w-full md:w-1/4 max-w-[200px] flex-shrink-0">
                  <div className="relative group/img rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                     <img src={(block as QuestionBlock).image!} className="w-full h-auto object-cover" alt="Question" />
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center p-2">
                        <input className="w-full bg-white text-xs p-1 rounded outline-none" value={(block as QuestionBlock).image || ''} onChange={(e) => updateBlock(block.id, parentId, { ...block, image: e.target.value })} placeholder="Image URL" onClick={(e) => e.stopPropagation()} />
                     </div>
                  </div>
               </div>
            )}
          </div>
        )}

        {block.type === 'group' && (
          <div 
            className={`bg-[var(--primary-50)]/30 rounded-xl p-6 border border-dashed border-[var(--primary-200)] min-h-[150px] relative transition-colors`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add(`bg-[var(--primary-100)]/50`); e.dataTransfer.dropEffect = "move"; }}
            onDragLeave={(e) => { e.currentTarget.classList.remove(`bg-[var(--primary-100)]/50`); }}
            onDrop={(e) => { e.currentTarget.classList.remove(`bg-[var(--primary-100)]/50`); const dataStr = e.dataTransfer.getData("dragData"); if(!dataStr) return; const dragItem: DragItem = JSON.parse(dataStr); if (dragItem.id === block.id) return; handleDrop(e, undefined, block.id, (block as GroupBlock).children.length); }}
          >
             <div className="mb-6 flex gap-2 items-center">
                <Heading size={18} className="text-[var(--primary)] opacity-50"/>
                <input className={`w-full bg-transparent font-bold text-lg text-[var(--primary-900)] outline-none placeholder-[var(--primary-300)]`} placeholder="Group Title..." value={block.title || ''} onChange={(e) => updateBlock(block.id, parentId, { ...block, title: e.target.value })} />
             </div>
             <div className={`space-y-0`}>
                {block.children.map((child, childIdx) => {
                   const childLabel = label ? `${label}${String.fromCharCode(97 + childIdx)}` : undefined;
                   return <EditorBlockWrapper key={child.id} block={child} index={childIdx} parentId={block.id} label={childLabel} updateBlock={updateBlock} removeBlock={removeBlock} handleDrop={handleDrop} />
                })}
             </div>
             {block.children.length === 0 && <div className={`text-center py-8 text-[var(--primary-300)] text-sm border-2 border-dashed border-[var(--primary-100)] rounded-lg`}>Drag questions here</div>}
          </div>
        )}
      </div>
    </div>
  );
};

const QuestionBoard = () => {
  const [data, setData] = useState<WorksheetData>({
    title: "Untitled Worksheet",
    description: "Fill out the questions below.",
    blocks: [],
    design: { accentColor: '#6366f1', font: 'sans' }
  });
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [dragTarget, setDragTarget] = useState<{id: string, pos: 'top'|'bottom'} | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#data=")) {
      const decoded = decodeState(hash);
      if (decoded) {
        setData(decoded);
        setMode('preview');
      }
    }
  }, []);

  const saveToUrl = () => {
    const hash = encodeState(data);
    window.location.hash = `data=${hash}`;
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied to clipboard!");
  };

  const updateBlock = useCallback((id: string, parentId: string | undefined, newData: Block) => {
    setData(prev => {
      const newBlocks = [...prev.blocks];
      if (!parentId) {
        const idx = newBlocks.findIndex(b => b.id === id);
        if (idx !== -1) newBlocks[idx] = newData;
      } else {
        const parentIdx = newBlocks.findIndex(b => b.id === parentId);
        if (parentIdx !== -1) {
          const parent = { ...newBlocks[parentIdx] } as GroupBlock;
          const childIdx = parent.children.findIndex(b => b.id === id);
          if (childIdx !== -1) {
            const newChildren = [...parent.children];
            newChildren[childIdx] = newData as (QuestionBlock | TextBlock);
            parent.children = newChildren;
            newBlocks[parentIdx] = parent;
          }
        }
      }
      return { ...prev, blocks: newBlocks };
    });
  }, []);

  const removeBlock = useCallback((id: string, parentId: string | undefined) => {
    setData(prev => {
      let newBlocks = [...prev.blocks];
      if (!parentId) {
        newBlocks = newBlocks.filter(b => b.id !== id);
      } else {
        const parentIdx = newBlocks.findIndex(b => b.id === parentId);
        if (parentIdx !== -1) {
          const parent = { ...newBlocks[parentIdx] } as GroupBlock;
          parent.children = parent.children.filter(b => b.id !== id);
          newBlocks[parentIdx] = parent;
        }
      }
      return { ...prev, blocks: newBlocks };
    });
  }, []);

  const addBlock = useCallback((type: BlockType, qType?: QuestionType) => {
    setData(prev => ({ ...prev, blocks: [...prev.blocks, createBlock(type, qType)] }));
  }, []);

  const handleDragDrop = useCallback((e: React.DragEvent, targetId?: string, targetParentId?: string, targetIndex?: number) => {
    const dataStr = e.dataTransfer.getData("dragData");
    if (!dataStr) return;
    const item: DragItem = JSON.parse(dataStr);

    setData(prev => {
      const newBlocks = [...prev.blocks];
      let movingBlock: Block;
      let originalIndex: number = -1;

      if (item.type === 'new-block') {
         if (!item.payload) return prev;
         movingBlock = createBlock(item.payload.type, item.payload.qType);
      } else {
         if (!item.parentId) {
           originalIndex = newBlocks.findIndex(b => b.id === item.id);
           if (originalIndex === -1) return prev;
           movingBlock = newBlocks[originalIndex];
           newBlocks.splice(originalIndex, 1);
         } else {
           const parentIdx = newBlocks.findIndex(b => b.id === item.parentId);
           if (parentIdx === -1) return prev;
           const parent = newBlocks[parentIdx] as GroupBlock;
           originalIndex = parent.children.findIndex(b => b.id === item.id);
           if (originalIndex === -1) return prev;
           movingBlock = parent.children[originalIndex] as Block;
           parent.children = [...parent.children]; 
           parent.children.splice(originalIndex, 1);
         }
      }

      if (!targetParentId) {
        let insertIdx = targetIndex !== undefined ? targetIndex : newBlocks.length;
        
        // Adjust index if moving within the same list and moving downwards
        if (item.type !== 'new-block' && !item.parentId && originalIndex !== -1 && originalIndex < insertIdx) {
            insertIdx--;
        }

        if (targetId && targetIndex === undefined) {
           const tIdx = newBlocks.findIndex(b => b.id === targetId);
           if (tIdx !== -1) insertIdx = tIdx + 1;
        }
        newBlocks.splice(insertIdx, 0, movingBlock);
      } else {
        const parentIdx = newBlocks.findIndex(b => b.id === targetParentId);
        if (parentIdx !== -1) {
           const parent = { ...newBlocks[parentIdx] } as GroupBlock;
           parent.children = [...parent.children];
           let insertIdx = targetIndex !== undefined ? targetIndex : parent.children.length;

           // Adjust index if moving within the same group and moving downwards
           if (item.type !== 'new-block' && item.parentId === targetParentId && originalIndex !== -1 && originalIndex < insertIdx) {
             insertIdx--;
           }

           if (targetId && targetIndex === undefined) {
              const tIdx = parent.children.findIndex(b => b.id === targetId);
              if (tIdx !== -1) insertIdx = tIdx + 1;
           }
           parent.children.splice(insertIdx, 0, movingBlock as (QuestionBlock | TextBlock));
           newBlocks[parentIdx] = parent;
        }
      }
      return { ...prev, blocks: newBlocks };
    });
  }, []);

  // Compute segments logic with guaranteed first segment for header
  const segments = React.useMemo(() => {
    const segs: Block[][] = [];
    let currentSegment: Block[] = [];
    data.blocks.forEach(block => {
      if (block.type === 'divider') {
        segs.push(currentSegment); // Push even if empty so index exists
        segs.push([block]); 
        currentSegment = [];
      } else {
        currentSegment.push(block);
      }
    });
    segs.push(currentSegment);
    return segs;
  }, [data.blocks]);

  const handleDownloadPDF = async () => {
    setMode('preview');
    setTimeout(async () => {
      const element = document.getElementById('preview-container');
      if (!element) return;
      
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`worksheet-${data.title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    }, 500);
  };

  const presetColors = ['#64748b', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#d946ef', '#ec4899'];
  let questionCounter = 0;

  return (
    <ThemeContext.Provider value={data.design || { accentColor: '#6366f1', font: 'sans' }}>
      <ThemeStyle color={data.design?.accentColor || '#6366f1'} />
      <div className={`min-h-screen pb-40 bg-slate-50 selection:bg-[var(--primary-100)] selection:text-[var(--primary-900)]`}>
        
        {/* Fixed Top Bar */}
        <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-6 shadow-sm font-sans">
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[var(--primary)] rounded-lg flex items-center justify-center text-white font-bold">Q</div>
              <span className="font-bold text-slate-800">Question Board</span>
           </div>
        </div>

        {/* Main Workspace */}
        <div className={`max-w-5xl mx-auto p-4 md:p-12 pt-32 ${data.design?.font === 'serif' ? 'font-serif' : data.design?.font === 'mono' ? 'font-mono' : 'font-sans'}`} id="preview-container">
            
            {/* Mode: Editor */}
            {mode === 'edit' ? (
              <div className="space-y-8">
                 {segments.map((segment, segIdx) => {
                    const isDividerSegment = segment.length === 1 && segment[0].type === 'divider';
                    
                    if (isDividerSegment) {
                       return (
                          <div key={segment[0].id} className="group relative h-10 flex items-center justify-center my-4 cursor-grab"
                             draggable
                             onDragStart={(e) => { e.dataTransfer.setData("dragData", JSON.stringify({ id: segment[0].id, index: 0, type: 'block' })); }}
                             onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                             onDrop={(e) => handleDragDrop(e, undefined, undefined, segments.slice(0, segIdx+1).reduce((acc, s) => acc + s.length, 0) + 1)}
                          >
                             <div className="absolute bg-slate-100 text-slate-400 text-xs px-3 py-1 rounded-full border border-slate-200 flex items-center gap-2 z-10 font-sans">
                                <Divide size={12} /> Page Break
                             </div>
                             <div className="w-full h-px bg-slate-300 border-dashed border-t border-slate-300"></div>
                             <button onClick={() => removeBlock(segment[0].id, undefined)} className="absolute right-0 top-1 p-2 text-slate-400 hover:text-red-500 bg-white rounded-full shadow border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <X size={14}/>
                             </button>
                          </div>
                       )
                    }

                    // Only render empty segments if it's the first one (Title page)
                    if (segment.length === 0 && segIdx !== 0) return null;

                    return (
                       <div key={segIdx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible min-h-[200px] p-8 pb-16 relative">
                          
                          {/* Header Logic: Adjust spacing */}
                          {segIdx === 0 && (
                            <div className={`space-y-4 pt-4 ${segment.length > 0 ? 'mb-12 border-b border-slate-100 pb-10' : ''}`}>
                              <input 
                                className="text-4xl font-bold w-full outline-none placeholder-slate-300 bg-transparent text-slate-900"
                                placeholder="Untitled Worksheet"
                                value={data.title}
                                onChange={(e) => setData({ ...data, title: e.target.value })}
                              />
                              <input 
                                className="text-lg text-slate-500 w-full outline-none placeholder-slate-300 bg-transparent"
                                placeholder="Add a description..."
                                value={data.description}
                                onChange={(e) => setData({ ...data, description: e.target.value })}
                              />
                            </div>
                          )}

                          <div 
                             className={`${segment.length === 0 && segIdx !== 0 ? 'min-h-[100px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-lg bg-slate-50' : ''}`}
                             onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                             onDrop={(e) => handleDragDrop(e, undefined, undefined, undefined)}
                          >
                             {segment.length === 0 && segIdx !== 0 && ( <div className="text-center text-slate-400"><p>Empty Page</p></div> )}
                             {segment.map((block, index) => {
                                const isQuestion = block.type === 'question';
                                const isGroup = block.type === 'group';
                                let label;
                                if (isQuestion || isGroup) {
                                  questionCounter++;
                                  label = questionCounter.toString();
                                }
                                
                                return (
                                  <EditorBlockWrapper 
                                    key={block.id} 
                                    block={block} 
                                    index={index} 
                                    updateBlock={updateBlock} 
                                    removeBlock={removeBlock}
                                    handleDrop={handleDragDrop}
                                    label={label}
                                    dragTarget={dragTarget}
                                    setDragTarget={setDragTarget}
                                  />
                                );
                             })}
                          </div>
                       </div>
                    );
                 })}

                 {/* Empty State when no blocks exist at all */}
                 {data.blocks.length === 0 && segments.length <= 1 && (
                    <div className="text-center p-8 text-slate-400 font-sans">
                       <p>Start by adding questions from below</p>
                    </div>
                 )}
              </div>
            ) : (
               // Mode: Preview
               <div className="space-y-8">
                {segments.map((segment, segIdx) => {
                    if (segment.length === 1 && segment[0].type === 'divider') return <div key={segment[0].id} className="h-px bg-slate-200 w-full my-8 break-before-page"></div>;
                    
                    // Don't render empty pages in preview
                    if (segment.length === 0 && segIdx !== 0) return null;

                    return (
                      <div key={segIdx} className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 md:p-16 space-y-8 relative break-after-page">
                          {segIdx === 0 && (
                             <div className="mb-12 pb-8 border-b border-slate-100">
                                <h1 className="text-4xl font-bold text-slate-900 mb-4 text-left">{data.title}</h1>
                                <p className="text-lg text-slate-500 text-left">{data.description}</p>
                             </div>
                          )}

                          {segment.map((block) => {
                            const renderPreviewBlock = (b: Block, qNum: string) => {
                                if (b.type === 'text') return <SimpleMarkdown text={b.content} />;
                                if (b.type === 'embed') return <EmbedRenderer url={b.url} title={b.title} />;
                                if (b.type === 'question') {
                                  const q = b as QuestionBlock;
                                  return (
                                      <div className="flex gap-4">
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--primary-100)] text-[var(--primary-700)] font-bold flex items-center justify-center text-sm select-none font-sans`}>
                                            {qNum}
                                        </div>
                                        <div className="flex-1">
                                            {/* Question Body - Flex Row for Image Side-by-Side */}
                                            <div className="flex flex-col md:flex-row gap-6">
                                                <div className="flex-1">
                                                    <div className="text-lg font-medium text-slate-900 mb-2">{q.prompt}</div>
                                                    {(q.description && <div className="text-sm text-slate-500 italic mb-4 bg-slate-50 p-2 rounded inline-block">{q.description}</div>)}
                                                    
                                                    {q.qType === 'multiple-choice' && <MultipleChoicePlayer block={q} value={answers[q.id]} onChange={(v) => setAnswers(prev => ({...prev, [q.id]: v}))} />}
                                                    {q.qType === 'open-answer' && <OpenAnswerPlayer value={answers[q.id]} onChange={(v) => setAnswers(prev => ({...prev, [q.id]: v}))} />}
                                                    {q.qType === 'cloze-text' && <ClozeTextPlayer block={q} value={answers[q.id]} onChange={(v) => setAnswers(prev => ({...prev, [q.id]: v}))} />}
                                                    {q.qType === 'cloze-dropdown' && <ClozeDropdownPlayer block={q} value={answers[q.id]} onChange={(v) => setAnswers(prev => ({...prev, [q.id]: v}))} />}
                                                    {q.qType === 'drag-inline' && <DragInlinePlayer block={q} value={answers[q.id]} onChange={(v) => setAnswers(prev => ({...prev, [q.id]: v}))} />}
                                                </div>
                                                
                                                {/* Image on the side */}
                                                {q.image && ( 
                                                    <div className="md:w-1/3 max-w-[300px] flex-shrink-0">
                                                        <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                                                            <img src={q.image} alt="Question Reference" className="w-full h-auto object-cover" />
                                                        </div>
                                                    </div> 
                                                )}
                                            </div>
                                        </div>
                                      </div>
                                  )
                                }
                                return null;
                            }

                            if (block.type === 'group') {
                                questionCounter++;
                                const groupNum = questionCounter;
                                return (
                                  <div key={block.id} className="space-y-6">
                                      {block.title && <h3 className="text-xl font-bold text-slate-800">{block.title}</h3>}
                                      <div className="space-y-6 ml-0">
                                        {block.children.map((child, cIdx) => (
                                            <div key={child.id}>
                                              {renderPreviewBlock(child, `${groupNum}${String.fromCharCode(97 + cIdx)}`)}
                                            </div>
                                        ))}
                                      </div>
                                  </div>
                                )
                            }
                            if (block.type === 'question') {
                                questionCounter++;
                                return <div key={block.id}>{renderPreviewBlock(block, questionCounter.toString())}</div>
                            }
                            return <div key={block.id}>{renderPreviewBlock(block, '')}</div>
                          })}
                      </div>
                    );
                })}
               </div>
            )}
        </div>

        {/* Floating Bottom Toolbar (Dock) */}
        {mode === 'edit' && (
           <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 font-sans">
              <div className="bg-white/90 backdrop-blur-md shadow-2xl border border-slate-200/50 p-2 rounded-2xl flex items-center gap-1 md:gap-2">
                 
                 {/* Section 1: Structure */}
                 <div className="flex gap-1 px-1">
                    <TooltipButton icon={Type} label="Text" onClick={() => addBlock('text')} dragPayload={{type: 'text'}} />
                    <TooltipButton icon={Heading} label="Group" onClick={() => addBlock('group')} dragPayload={{type: 'group'}} />
                    <TooltipButton icon={LinkIcon} label="Embed" onClick={() => addBlock('embed')} dragPayload={{type: 'embed'}} />
                    <TooltipButton icon={Divide} label="Break" onClick={() => addBlock('divider')} dragPayload={{type: 'divider'}} />
                 </div>
                 
                 <div className="w-px h-8 bg-slate-200 mx-1"></div>

                 {/* Section 2: Questions */}
                 <div className="flex gap-1 px-1">
                    <TooltipButton icon={ImageIcon} label="Multiple Choice" onClick={() => addBlock('question', 'multiple-choice')} dragPayload={{type: 'question', qType: 'multiple-choice'}} />
                    <TooltipButton icon={TextCursorInput} label="Cloze (Text)" onClick={() => addBlock('question', 'cloze-text')} dragPayload={{type: 'question', qType: 'cloze-text'}} />
                    <TooltipButton icon={ListOrdered} label="Cloze (Drop)" onClick={() => addBlock('question', 'cloze-dropdown')} dragPayload={{type: 'question', qType: 'cloze-dropdown'}} />
                    <TooltipButton icon={MousePointerClick} label="Drag & Drop" onClick={() => addBlock('question', 'drag-inline')} dragPayload={{type: 'question', qType: 'drag-inline'}} />
                    <TooltipButton icon={MessageSquare} label="Open Answer" onClick={() => addBlock('question', 'open-answer')} dragPayload={{type: 'question', qType: 'open-answer'}} />
                 </div>

                 <div className="w-px h-8 bg-slate-200 mx-1"></div>

                 {/* Section 3: Actions */}
                 <div className="flex gap-1 px-1 relative">
                    <TooltipButton icon={Palette} label="Design" active={showSettings} onClick={() => setShowSettings(!showSettings)} />
                    <TooltipButton icon={Eye} label="Preview" onClick={() => setMode('preview')} />
                    
                    {/* Settings Popover */}
                    {showSettings && (
                       <div className="absolute bottom-full right-0 mb-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-5 animate-in fade-in zoom-in-95 origin-bottom-right">
                          <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-slate-800">Design</h3>
                             <button onClick={() => setShowSettings(false)}><X size={16} className="text-slate-400 hover:text-slate-600"/></button>
                          </div>
                          
                          <div className="space-y-6">
                             <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-3 block flex gap-2"><Palette size={12}/> Accent Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {presetColors.map(c => (
                                        <button 
                                            key={c}
                                            onClick={() => setData(prev => ({...prev, design: {...prev.design!, accentColor: c}}))}
                                            className={`w-8 h-8 rounded-full border-2 ${data.design?.accentColor === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'} transition-transform shadow-sm`}
                                            style={{backgroundColor: c}}
                                        />
                                    ))}
                                    {/* Custom Color Button */}
                                    <div className="relative">
                                       <button 
                                          onClick={() => setShowColorPicker(!showColorPicker)}
                                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white ${!presetColors.includes(data.design?.accentColor || '') ? 'border-slate-800' : 'border-slate-200'} hover:border-slate-400 transition-colors shadow-sm`}
                                          style={!presetColors.includes(data.design?.accentColor || '') ? {backgroundColor: data.design?.accentColor} : {}}
                                       >
                                          <Pencil size={12} className={!presetColors.includes(data.design?.accentColor || '') ? 'text-white mix-blend-difference' : 'text-slate-400'}/>
                                       </button>
                                       
                                       {/* Custom Picker Popup */}
                                       {showColorPicker && (
                                          <div className="absolute bottom-full right-0 mb-2 p-3 bg-white shadow-xl border border-slate-200 rounded-xl z-[60] flex flex-col gap-3 w-48 animate-in slide-in-from-bottom-2">
                                              <div className="flex gap-2 items-center">
                                                  <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                                                      <input type="color" className="w-full h-full p-0 border-0 cursor-pointer scale-150" value={data.design?.accentColor} onChange={(e) => setData(prev => ({...prev, design: {...prev.design!, accentColor: e.target.value}}))} />
                                                  </div>
                                                  <input type="text" className="w-full text-xs font-mono border border-slate-200 rounded px-2 py-1 uppercase bg-white text-slate-900" value={data.design?.accentColor} onChange={(e) => setData(prev => ({...prev, design: {...prev.design!, accentColor: e.target.value}}))} />
                                              </div>
                                              <div className="text-xs text-slate-400 text-center">Hex or RGB</div>
                                          </div>
                                       )}
                                    </div>
                                </div>
                             </div>
                             <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-3 block flex gap-2"><TypeIcon size={12}/> Typography</label>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    {['sans', 'serif', 'mono'].map(f => (
                                       <button 
                                          key={f}
                                          onClick={() => setData(prev => ({...prev, design: {...prev.design!, font: f as any}}))}
                                          className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${data.design?.font === f ? `bg-white text-slate-900 shadow-sm` : 'text-slate-500 hover:text-slate-700'}`}
                                       >
                                          {f}
                                       </button>
                                    ))}
                                 </div>
                             </div>
                             <hr className="border-slate-100"/>
                             <p className="text-xs text-center text-slate-400">Settings saved automatically</p>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        {/* Preview Floating Toolbar */}
        {mode === 'preview' && (
           <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 font-sans">
              <div className="bg-white/90 backdrop-blur-md shadow-2xl border border-slate-200/50 p-2 rounded-2xl flex items-center gap-1">
                 <TooltipButton icon={Edit3} label="Edit Worksheet" onClick={() => setMode('edit')} />
                 <TooltipButton icon={Share2} label="Share Link" onClick={saveToUrl} />
                 <TooltipButton icon={Download} label="Download PDF" onClick={handleDownloadPDF} />
              </div>
           </div>
        )}

      </div>
    </ThemeContext.Provider>
  );
};

const App = () => {
  return <QuestionBoard />;
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);