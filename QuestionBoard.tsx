import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Type, 
  Link as LinkIcon, 
  Divide, 
  ImageIcon, 
  ListOrdered, 
  MousePointerClick, 
  MessageSquare, 
  TextCursorInput, 
  Palette, 
  Eye, 
  Trash2, 
  Heading, 
  X, 
  Type as TypeIcon, 
  Edit3, 
  Heart, 
  AlertTriangle, 
  Pencil,
  Copy,
  Globe,
  FileDown,
  Check,
  Share2
} from "lucide-react";
import { Block, BlockType, DragItem, QuestionType, WorksheetData, GroupBlock, QuestionBlock, TextBlock } from "./types";
import { createBlock, decodeState, duplicateBlockHelper, encodeState, downloadFile } from "./helpers";
import { ThemeContext } from "./ThemeContext";
import { ThemeStyle, TooltipButton, SimpleMarkdown, EmbedRenderer } from "./components/UIComponents";
import { EditorBlockWrapper } from "./components/EditorBlockWrapper";
import { MultipleChoicePlayer, OpenAnswerPlayer, ClozeTextPlayer, ClozeDropdownPlayer, DragInlinePlayer } from "./components/PlayerComponents";

// Helper to convert number to Roman numeral
const toRoman = (num: number) => {
  const roman: {[key: string]: number} = { m: 1000, cm: 900, d: 500, cd: 400, c: 100, xc: 90, l: 50, xl: 40, x: 10, ix: 9, v: 5, iv: 4, i: 1 };
  let str = '';
  for (const i of Object.keys(roman)) {
    const q = Math.floor(num / roman[i]);
    num -= q * roman[i];
    str += i.repeat(q);
  }
  return str;
}

// Robust Recursive Remove
const removeBlockRecursive = (blocks: Block[], id: string): Block[] => {
  return blocks
    .filter(b => b.id !== id)
    .map(b => {
      if (b.type === 'group') {
        return { ...b, children: removeBlockRecursive((b as GroupBlock).children, id) } as GroupBlock;
      }
      return b;
    });
};

// Recursive helper to find a block (for duplication/moving)
const findBlock = (blocks: Block[], id: string): Block | null => {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === 'group') {
      const found = findBlock((b as GroupBlock).children, id);
      if (found) return found;
    }
  }
  return null;
};

// Recursive helper to insert a block
const insertBlockAt = (blocks: Block[], parentId: string | undefined, index: number, block: Block): Block[] => {
  if (!parentId) {
    const newBlocks = [...blocks];
    const safeIndex = Math.max(0, Math.min(index, newBlocks.length));
    newBlocks.splice(safeIndex, 0, block);
    return newBlocks;
  }

  return blocks.map(b => {
    if (b.id === parentId && b.type === 'group') {
      const group = b as GroupBlock;
      const newChildren = [...group.children];
      const safeIndex = Math.max(0, Math.min(index, newChildren.length));
      newChildren.splice(safeIndex, 0, block);
      return { ...group, children: newChildren };
    }
    if (b.type === 'group') {
       const group = b as GroupBlock;
       return { ...group, children: insertBlockAt(group.children, parentId, index, block) };
    }
    return b;
  });
};

export const Builder = () => {
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [dragTarget, setDragTarget] = useState<{id: string, pos: 'top'|'bottom'|'inside'} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedType, setDraggedType] = useState<BlockType | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleDragEnd = useCallback(() => {
    setDragTarget(null);
    setIsDragging(false);
    setDraggedType(null);
  }, []);

  const updateBlock = useCallback((id: string, _parentId: string | undefined, newData: Block) => {
    setData(prev => {
      const updateRecursive = (blocks: Block[]): Block[] => {
        return blocks.map(b => {
          if (b.id === id) return newData;
          if (b.type === 'group') {
            return { ...b, children: updateRecursive((b as GroupBlock).children) } as GroupBlock;
          }
          return b;
        });
      };
      return { ...prev, blocks: updateRecursive(prev.blocks) };
    });
  }, []);

  const removeBlock = useCallback((id: string, _parentId: string | undefined) => {
    setData(prev => ({
      ...prev,
      blocks: removeBlockRecursive(prev.blocks, id)
    }));
  }, []);

  const duplicateBlock = useCallback((block: Block, _parentId?: string) => {
    setData(prev => {
      const newBlock = duplicateBlockHelper(block);
      const insertAfterRecursive = (blocks: Block[]): Block[] => {
         const idx = blocks.findIndex(b => b.id === block.id);
         if (idx !== -1) {
            const newArr = [...blocks];
            newArr.splice(idx + 1, 0, newBlock);
            return newArr;
         }
         return blocks.map(b => {
            if (b.type === 'group') {
               return { ...b, children: insertAfterRecursive((b as GroupBlock).children) } as GroupBlock;
            }
            return b;
         });
      };
      return { ...prev, blocks: insertAfterRecursive(prev.blocks) };
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
      let movingBlock: Block;
      let currentBlocks = [...prev.blocks];

      if (item.type === 'new-block') {
         if (!item.payload) return prev;
         movingBlock = createBlock(item.payload.type, item.payload.qType);
      } else {
         const found = findBlock(currentBlocks, item.id!);
         if (!found) return prev;
         movingBlock = found;
         currentBlocks = removeBlockRecursive(currentBlocks, item.id!);
      }

      if (movingBlock.type === 'divider' && targetParentId) return prev;

      let finalIndex = targetIndex;

      if (targetId && finalIndex === undefined) {
         const findIndexInParent = (blocks: Block[], pId: string | undefined): number => {
            if (!pId) {
               return blocks.findIndex(b => b.id === targetId);
            }
            for (const b of blocks) {
               if (b.id === pId && b.type === 'group') {
                  return (b as GroupBlock).children.findIndex(child => child.id === targetId);
               }
               if (b.type === 'group') {
                  const res = findIndexInParent((b as GroupBlock).children, pId);
                  if (res !== -1) return res;
               }
            }
            return -1;
         };
         const idx = findIndexInParent(currentBlocks, targetParentId);
         if (idx !== -1) finalIndex = idx + 1; 
      }
      
      if (finalIndex === undefined) finalIndex = -1; 

      const finalBlocks = insertBlockAt(currentBlocks, targetParentId, finalIndex, movingBlock);
      return { ...prev, blocks: finalBlocks };
    });
    setDragTarget(null);
    setIsDragging(false);
    setDraggedType(null);
  }, []);

  const segments = useMemo(() => {
    const segs: Block[][] = [];
    let currentSegment: Block[] = [];
    data.blocks.forEach(block => {
      if (block.type === 'divider') {
        segs.push(currentSegment);
        segs.push([block]); 
        currentSegment = [];
      } else {
        currentSegment.push(block);
      }
    });
    segs.push(currentSegment);
    return segs;
  }, [data.blocks]);

  const presetColors = ['#64748b', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#d946ef', '#ec4899'];
  
  const getNumbering = (depth: number, index: number) => {
     if (depth === 0) return `${index + 1}.`;
     if (depth === 1) return `${String.fromCharCode(97 + index)}.`;
     if (depth >= 2) return `${toRoman(index + 1)}.`;
     return '';
  }

  let questionCounter = 0;
  let previewQuestionCounter = 0;

  // Publish Actions
  const publishLink = `${window.location.origin}/answer#data=${encodeState(data)}`;
  const handleCopyLink = () => {
      navigator.clipboard.writeText(publishLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };
  const handleDownloadFile = () => {
      downloadFile(`worksheet-${Date.now()}.wks`, JSON.stringify(data), 'application/json');
  };

  return (
    <ThemeContext.Provider value={data.design || { accentColor: '#6366f1', font: 'sans' }}>
      <ThemeStyle color={data.design?.accentColor || '#6366f1'} />
      <div className={`min-h-screen pb-40 bg-slate-50 selection:bg-[var(--primary-100)] selection:text-[var(--primary-900)] flex flex-col items-center`}>
        
        <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-6 shadow-sm font-sans w-full">
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[var(--primary)] rounded-lg flex items-center justify-center text-white font-bold">W</div>
              <span className="font-bold text-slate-800">Worksheeter</span>
           </div>
        </div>

        <div className={`w-full max-w-5xl px-4 md:px-12 pt-32 ${data.design?.font === 'serif' ? 'font-serif' : data.design?.font === 'mono' ? 'font-mono' : 'font-sans'}`} id="preview-container">
            
            {mode === 'edit' ? (
              <div className="space-y-8">
                 {showClearConfirm && (
                   <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans">
                      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                         <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertTriangle size={24} />
                            <h3 className="font-bold text-lg">Clear Worksheet?</h3>
                         </div>
                         <p className="text-slate-600 mb-6">This will remove all questions and reset the worksheet. This action cannot be undone.</p>
                         <div className="flex justify-end gap-3">
                            <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                            <button onClick={() => { setData(prev => ({ ...prev, blocks: [] })); setShowClearConfirm(false); }} className="px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm">Clear All</button>
                         </div>
                      </div>
                   </div>
                 )}

                 {segments.map((segment, segIdx) => {
                    const isDividerSegment = segment.length === 1 && segment[0].type === 'divider';
                    
                    if (isDividerSegment) {
                       return (
                          <div key={segment[0].id} className="relative py-2">
                             <div className="group relative h-10 flex items-center justify-center cursor-grab"
                                draggable
                                onDragStart={(e) => { 
                                   e.dataTransfer.setData("dragData", JSON.stringify({ id: segment[0].id, index: 0, type: 'block' })); 
                                   setIsDragging(true);
                                   setDraggedType('divider');
                                }}
                                onDragEnd={handleDragEnd}
                             >
                                <div className="absolute bg-slate-100 text-slate-400 text-xs px-3 py-1 rounded-full border border-slate-200 flex items-center gap-2 z-10 font-sans group-hover:scale-110 transition-transform">
                                   <Divide size={12} /> Page Break
                                </div>
                                <div className="w-full h-px bg-slate-300 border-dashed border-t border-slate-300"></div>
                                <button onClick={() => removeBlock(segment[0].id, undefined)} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-500 bg-white rounded-full shadow border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                   <X size={14}/>
                                </button>
                             </div>

                             <div 
                                className={`transition-all duration-200 ease-in-out border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-lg flex items-center justify-center text-blue-400 text-sm font-medium ${isDragging ? 'h-24 opacity-100 mt-4' : 'h-0 opacity-0 mt-0 border-0 overflow-hidden'}`}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                onDrop={(e) => {
                                   const globalIndex = data.blocks.findIndex(b => b.id === segment[0].id);
                                   handleDragDrop(e, undefined, undefined, globalIndex + 1);
                                }}
                             >
                                Drop to start new page
                             </div>
                          </div>
                       )
                    }

                    if (segment.length === 0 && segIdx !== 0) return null;

                    return (
                       <div key={segIdx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible min-h-[200px] p-8 pb-16 relative transition-all duration-300">
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
                             onDrop={(e) => {
                                const segmentStartIndex = segments.slice(0, segIdx).reduce((acc, s) => acc + s.length, 0);
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isTop = (e.clientY - rect.top) < (rect.height / 2);
                                
                                if (segment.length > 0) {
                                    if (isTop) {
                                        handleDragDrop(e, undefined, undefined, segmentStartIndex);
                                    } else {
                                        handleDragDrop(e, segment[segment.length-1].id); 
                                    }
                                } else {
                                    handleDragDrop(e, undefined, undefined, segmentStartIndex);
                                }
                             }}
                          >
                             {segment.length === 0 && segIdx !== 0 && ( <div className="text-center text-slate-400"><p>Empty Page</p></div> )}
                             {/* Render Top Level Blocks */}
                             {segment.map((block, _index) => {
                                const isQuestion = block.type === 'question';
                                const isGroup = block.type === 'group';
                                const globalIndex = data.blocks.indexOf(block);
                                let label;
                                if (isQuestion || isGroup) {
                                  questionCounter++;
                                  label = questionCounter.toString();
                                }
                                return (
                                  <EditorBlockWrapper 
                                    key={block.id} 
                                    block={block} 
                                    index={globalIndex} 
                                    updateBlock={updateBlock} 
                                    removeBlock={removeBlock}
                                    duplicateBlock={duplicateBlock}
                                    handleDrop={handleDragDrop}
                                    label={label}
                                    dragTarget={dragTarget}
                                    setDragTarget={setDragTarget}
                                    onDragEnd={handleDragEnd}
                                    isDraggingItem={isDragging}
                                    depth={0}
                                    getNumbering={getNumbering}
                                    draggedType={draggedType}
                                    onBlockDragStart={(t) => { setDraggedType(t); setIsDragging(true); }}
                                  />
                                );
                             })}
                          </div>
                          
                          <div 
                             className={`transition-all duration-200 ease-in-out border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-lg flex items-center justify-center text-blue-400 text-sm font-medium ${isDragging ? 'h-24 opacity-100 mt-4' : 'h-0 opacity-0 mt-0 border-0 overflow-hidden'}`}
                             onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                             onDrop={(e) => {
                                const insertIndex = segments.slice(0, segIdx+1).reduce((acc, s) => acc + s.length, 0);
                                handleDragDrop(e, undefined, undefined, insertIndex);
                             }}
                          >
                             Drop here to append to page
                          </div>
                       </div>
                    );
                 })}

                 {data.blocks.length === 0 && segments.length <= 1 && (
                    <div className="text-center p-8 text-slate-400 font-sans">
                       <p>Start by adding questions from below</p>
                    </div>
                 )}
              </div>
            ) : (
               <div className="space-y-8">
                  {/* Publish Modal */}
                  {showPublishModal && (
                     <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
                           <div className="flex items-center justify-between mb-6">
                              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><Globe size={20} className="text-blue-500"/> Publish Worksheet</h3>
                              <button onClick={() => setShowPublishModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                           </div>
                           
                           <div className="space-y-6">
                              <div>
                                 <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Share Link</label>
                                 <div className="flex gap-2">
                                    <input readOnly value={publishLink} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none" />
                                    <button onClick={handleCopyLink} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2 font-medium">
                                       {copied ? <Check size={16}/> : <Copy size={16}/>}
                                       {copied ? "Copied" : "Copy"}
                                    </button>
                                 </div>
                                 <p className="text-xs text-slate-400 mt-2">Anyone with this link can fill out the worksheet.</p>
                              </div>
                              
                              <div className="relative">
                                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                                 <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">OR</span></div>
                              </div>

                              <div>
                                 <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Download File</label>
                                 <button onClick={handleDownloadFile} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium py-3 rounded-lg transition-colors">
                                    <FileDown size={18} />
                                    Download .wks file
                                 </button>
                                 <p className="text-xs text-slate-400 mt-2">Users can upload this file on the answer page to fill it out.</p>
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                {segments.map((segment, segIdx) => {
                    if (segment.length === 1 && segment[0].type === 'divider') return <div key={segment[0].id} className="h-px bg-slate-200 w-full my-8 break-before-page"></div>;
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
                             const globalIndex = data.blocks.findIndex(b => b.id === block.id);
                             const relevantBlocks = data.blocks.slice(0, globalIndex + 1).filter(b => b.type === 'question' || b.type === 'group');
                             const label = (block.type === 'question' || block.type === 'group') ? getNumbering(0, relevantBlocks.length - 1) : '';
                             
                             const renderPreviewBlock = (b: Block, lbl: string, depth: number): React.ReactNode => {
                                if (b.type === 'text') return <SimpleMarkdown text={b.content} />;
                                if (b.type === 'embed') return <EmbedRenderer url={b.url} title={b.title} />;
                                if (b.type === 'question') {
                                  previewQuestionCounter++; 
                                  
                                  const q = b as any;
                                  return (
                                      <div className="flex gap-4">
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${depth === 0 ? 'bg-[var(--primary-100)] text-[var(--primary-700)]' : 'bg-slate-100 text-slate-600'} font-bold flex items-center justify-center text-sm select-none font-sans`}>
                                            {lbl.replace('.','')}
                                        </div>
                                        <div className="flex-1">
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
                                                {q.image && <div className="md:w-1/3 max-w-[300px] flex-shrink-0"><img src={q.image} className="w-full rounded-lg border" /></div>}
                                            </div>
                                        </div>
                                      </div>
                                  )
                                }
                                if (b.type === 'group') {
                                   const g = b as GroupBlock;
                                   return (
                                      <div className="flex gap-4">
                                         <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${depth === 0 ? 'bg-[var(--primary-100)] text-[var(--primary-700)]' : 'bg-slate-100 text-slate-600'} font-bold flex items-center justify-center text-sm select-none font-sans`}>
                                            {lbl.replace('.','')}
                                         </div>
                                         <div className="flex-1 space-y-6">
                                            {g.title && <h3 className="text-xl font-medium text-slate-800 mb-2">{g.title}</h3>}
                                            <div className="space-y-6 ml-2 md:ml-0">
                                                {g.children.map((child, cIdx) => {
                                                const relevantChildren = g.children.slice(0, cIdx + 1).filter(c => c.type === 'question' || c.type === 'group');
                                                const childLabel = (child.type === 'question' || child.type === 'group') ? getNumbering(depth + 1, relevantChildren.length - 1) : '';
                                                return <div key={child.id}>{renderPreviewBlock(child, childLabel, depth + 1)}</div>
                                                })}
                                            </div>
                                         </div>
                                      </div>
                                   )
                                }
                                return null;
                             };

                             return <div key={block.id}>{renderPreviewBlock(block, label, 0)}</div>
                          })}
                      </div>
                    );
                })}
            </div>
        </div>

        <footer className="fixed bottom-0 left-0 w-full text-center text-slate-400 text-xs py-2 bg-slate-50/80 backdrop-blur-sm border-t border-slate-200 z-40 flex items-center justify-center gap-1 font-sans">
           made with <Heart size={10} className="text-red-500 fill-red-500" /> (and gemini) by daniel
        </footer>

        {mode === 'edit' && (
           <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 font-sans w-[95%] md:w-auto max-w-full">
              <div className="bg-white shadow-2xl border border-slate-200/50 p-2 rounded-2xl flex flex-wrap justify-center items-center gap-1 md:gap-2">
                 <div className="flex gap-1 px-1 flex-shrink-0">
                    <TooltipButton icon={Type} label="Text" onClick={() => addBlock('text')} dragPayload={{type: 'text'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                    <TooltipButton icon={Heading} label="Group" onClick={() => addBlock('group')} dragPayload={{type: 'group'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                    <TooltipButton icon={LinkIcon} label="Embed" onClick={() => addBlock('embed')} dragPayload={{type: 'embed'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                    <TooltipButton icon={Divide} label="Break" onClick={() => addBlock('divider')} dragPayload={{type: 'divider'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                 </div>
                 <div className="w-px h-8 bg-slate-200 mx-1 flex-shrink-0 hidden md:block"></div>
                 <div className="flex gap-1 px-1 flex-shrink-0">
                    <TooltipButton icon={ImageIcon} label="Multiple Choice" onClick={() => addBlock('question', 'multiple-choice')} dragPayload={{type: 'question', qType: 'multiple-choice'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                    <TooltipButton icon={TextCursorInput} label="Cloze (Text)" onClick={() => addBlock('question', 'cloze-text')} dragPayload={{type: 'question', qType: 'cloze-text'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                    <TooltipButton icon={ListOrdered} label="Cloze (Drop)" onClick={() => addBlock('question', 'cloze-dropdown')} dragPayload={{type: 'question', qType: 'cloze-dropdown'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                    <TooltipButton icon={MousePointerClick} label="Drag & Drop" onClick={() => addBlock('question', 'drag-inline')} dragPayload={{type: 'question', qType: 'drag-inline'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                    <TooltipButton icon={MessageSquare} label="Open Answer" onClick={() => addBlock('question', 'open-answer')} dragPayload={{type: 'question', qType: 'open-answer'}} onDragEnd={handleDragEnd} onDragStart={(t) => { setDraggedType(t); setIsDragging(true); }} />
                 </div>
                 <div className="w-px h-8 bg-slate-200 mx-1 flex-shrink-0 hidden md:block"></div>
                 <div className="flex gap-1 px-1 relative flex-shrink-0">
                    <TooltipButton icon={Palette} label="Design" active={showSettings} onClick={() => setShowSettings(!showSettings)} />
                    <TooltipButton icon={Eye} label="Preview" onClick={() => setMode('preview')} />
                    <TooltipButton icon={Trash2} label="Clear All" onClick={() => setShowClearConfirm(true)} />
                    {showSettings && (
                       <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:absolute md:bottom-full md:left-auto md:right-0 md:translate-x-0 mb-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-5 animate-in fade-in zoom-in-95 origin-bottom-right z-[60]">
                          <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800">Design</h3><button onClick={() => setShowSettings(false)}><X size={16} className="text-slate-400 hover:text-slate-600"/></button></div>
                          <div className="space-y-6">
                             <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-3 block flex gap-2"><Palette size={12}/> Accent Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {presetColors.map(c => (
                                        <button key={c} onClick={() => setData(prev => ({...prev, design: {...prev.design!, accentColor: c}}))} className={`w-8 h-8 rounded-full border-2 ${data.design?.accentColor === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'} transition-transform shadow-sm`} style={{backgroundColor: c}} />
                                    ))}
                                    <div className="relative">
                                       <button onClick={() => setShowColorPicker(!showColorPicker)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white ${!presetColors.includes(data.design?.accentColor || '') ? 'border-slate-800' : 'border-slate-200'} hover:border-slate-400 transition-colors shadow-sm`} style={!presetColors.includes(data.design?.accentColor || '') ? {backgroundColor: data.design?.accentColor} : {}}>
                                          <Pencil size={12} className={!presetColors.includes(data.design?.accentColor || '') ? 'text-white mix-blend-difference' : 'text-slate-400'}/>
                                       </button>
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
                                       <button key={f} onClick={() => setData(prev => ({...prev, design: {...prev.design!, font: f as any}}))} className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${data.design?.font === f ? `bg-white text-slate-900 shadow-sm` : 'text-slate-500 hover:text-slate-700'}`}>{f}</button>
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

        {mode === 'preview' && (
           <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 font-sans w-[95%] md:w-auto max-w-full">
              <div className="bg-white shadow-2xl border border-slate-200/50 p-2 rounded-2xl flex flex-wrap justify-center items-center gap-1">
                 <TooltipButton icon={Edit3} label="Edit Worksheet" onClick={() => setMode('edit')} />
                 <TooltipButton icon={Share2} label="Publish" onClick={() => setShowPublishModal(true)} />
              </div>
           </div>
        )}

      </div>
    </ThemeContext.Provider>
  );
};