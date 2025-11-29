import React, { useState, useRef } from "react";
import { 
  GripVertical, 
  ImageIcon, 
  FileText, 
  CheckSquare, 
  HelpCircle, 
  Copy, 
  Trash2, 
  X, 
  Type, 
  Video, 
  Info, 
  Plus 
} from "lucide-react";
import { Block, DragItem, QuestionBlock, GroupBlock, TextBlock, BlockType } from "../types";
import { EmbedRenderer } from "./UIComponents";

interface EditorBlockWrapperProps {
  block: Block;
  index: number;
  parentId?: string;
  label?: string;
  updateBlock: (id: string, parentId: string | undefined, newData: Block) => void;
  removeBlock: (id: string, parentId: string | undefined) => void;
  duplicateBlock: (block: Block, parentId?: string) => void;
  handleDrop: (e: React.DragEvent, targetId?: string, targetParentId?: string, targetIndex?: number) => void;
  dragTarget?: { id: string, pos: 'top' | 'bottom' | 'inside' } | null;
  setDragTarget?: (t: { id: string, pos: 'top' | 'bottom' | 'inside' } | null) => void;
  onDragEnd: () => void;
  isDraggingItem: boolean;
  depth?: number;
  getNumbering?: (depth: number, index: number) => string;
  draggedType: BlockType | null;
  onBlockDragStart: (type: BlockType) => void;
}

export const EditorBlockWrapper = ({ block, index, parentId, label, updateBlock, removeBlock, duplicateBlock, handleDrop, dragTarget, setDragTarget, onDragEnd, isDraggingItem, depth = 0, getNumbering, draggedType, onBlockDragStart }: EditorBlockWrapperProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [draggedOptionIdx, setDraggedOptionIdx] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const onBadgeDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    onBlockDragStart(block.type);
    const dragData: DragItem = { id: block.id, index, parentId, type: 'block' };
    e.dataTransfer.setData("dragData", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "move";
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
      const isTop = e.clientY < rect.top + 20; 
      const isBottom = e.clientY > rect.bottom - 20;
      
      // Limit max indentation to 2 (Root -> Indent 1). So depth 0 can accept inside, depth 1 cannot.
      if (block.type === 'group' && !isTop && !isBottom && e.clientY < rect.top + 80 && depth < 1) {
         setDragTarget({ id: block.id, pos: 'inside' });
      } else {
         setDragTarget({ id: block.id, pos: isTop ? 'top' : 'bottom' });
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (setDragTarget) setDragTarget(null);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const isTop = e.clientY < rect.top + 20;
    const isBottom = e.clientY > rect.bottom - 20;

    if (block.type === 'group' && !isTop && !isBottom && e.clientY < rect.top + 80 && depth < 1) {
        handleDrop(e, undefined, block.id, (block as GroupBlock).children.length);
    } else {
        handleDrop(e, undefined, parentId, isTop ? index : index + 1);
    }
  };

  const handleItemDragStart = (e: React.DragEvent, idx: number) => {
    e.stopPropagation();
    setDraggedOptionIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDrop = (e: React.DragEvent, dropIdx: number, type: 'options' | 'listItems') => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedOptionIdx === null || draggedOptionIdx === dropIdx) return;

    const qBlock = block as QuestionBlock;
    const list = type === 'options' ? [...(qBlock.options || [])] : [...(qBlock.listItems || [])];
    const item = list[draggedOptionIdx];
    list.splice(draggedOptionIdx, 1);
    list.splice(dropIdx, 0, item);

    if (type === 'options') updateBlock(block.id, parentId, { ...qBlock, options: list });
    else updateBlock(block.id, parentId, { ...qBlock, listItems: list });
    
    setDraggedOptionIdx(null);
  };

  const showHelper = block.type === 'question' && ['cloze-text', 'cloze-dropdown', 'drag-inline'].includes((block as QuestionBlock).qType);

  const isGroupBlock = block.type === 'group';
  const isGroupDrag = draggedType === 'group';
  const isDividerDrag = draggedType === 'divider';
  // Max depth allowed is 1 (Root -> Level 1). Level 2 is disabled.
  const isMaxDepth = depth >= 1;
  
  // Constraints: No groups dropping into max depth, no dividers in groups
  const canDropInGroup = !(isGroupDrag && isMaxDepth) && !isDividerDrag;

  return (
    <div 
      ref={wrapperRef}
      className={`group relative flex px-0 py-3 border-b border-slate-100 last:border-0 ${isFocused ? `bg-[var(--primary-50)]/30 -mx-4 px-4 rounded-xl` : ''}`}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false); }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragTarget?.id === block.id && dragTarget.pos !== 'inside' && (
         <div className={`absolute left-0 right-0 h-1 bg-blue-500 rounded-full pointer-events-none z-50 ${dragTarget.pos === 'top' ? '-top-0.5' : '-bottom-0.5'}`}></div>
      )}

      <div className="w-12 flex flex-col items-center pt-2 flex-shrink-0 relative font-sans">
         <div className="relative group/menu w-full flex flex-col items-center justify-center z-[50]">
            
            {/* Drag Handle */}
            <div 
              draggable
              onDragStart={onBadgeDragStart}
              onDragEnd={onDragEnd}
              className={`cursor-grab active:cursor-grabbing flex items-center justify-center text-slate-300 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors w-8 h-8`}
            >
               <GripVertical size={20} />
            </div>

            {/* Hover Menu with Bridge */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover/menu:block pb-2 z-[100]">
              <div className="flex gap-1 p-1 bg-white rounded-lg shadow-xl border border-slate-200 whitespace-nowrap">
                {block.type === 'question' && (
                  <>
                    <button title="Toggle Image" onClick={(e) => { e.stopPropagation(); updateBlock(block.id, parentId, { ...(block as QuestionBlock), image: (block as QuestionBlock).image === undefined ? '' : undefined }); }} className={`p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 ${(block as QuestionBlock).image !== undefined ? 'text-blue-600 bg-blue-50' : ''}`}><ImageIcon size={14} /></button>
                    <button title="Toggle Description" onClick={(e) => { e.stopPropagation(); updateBlock(block.id, parentId, { ...(block as QuestionBlock), description: (block as QuestionBlock).description === undefined ? '' : undefined }); }} className={`p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 ${(block as QuestionBlock).description !== undefined ? 'text-blue-600 bg-blue-50' : ''}`}><FileText size={14} /></button>
                    {(block as QuestionBlock).qType === 'multiple-choice' && (
                       <button title="Toggle Multiple Answer" onClick={(e) => { e.stopPropagation(); updateBlock(block.id, parentId, { ...(block as QuestionBlock), multiSelect: !(block as QuestionBlock).multiSelect }); }} className={`p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 ${(block as QuestionBlock).multiSelect ? 'text-blue-600 bg-blue-50' : ''}`}><CheckSquare size={14} /></button>
                    )}
                    <div className="w-px bg-slate-200 mx-0.5"></div>
                  </>
                )}
                <button title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateBlock(block, parentId); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-900"><Copy size={14} /></button>
                <button title="Delete" onClick={(e) => { e.stopPropagation(); removeBlock(block.id, parentId); }} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><X size={14} /></button>
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white -mt-2"></div>
            </div>

         </div>
      </div>

      <div className="flex-1 pl-2 relative">
        {block.type === 'text' && (
            <div className="flex gap-2"><textarea className="w-full resize-none outline-none text-slate-700 bg-transparent placeholder-slate-300 font-normal" placeholder="Type text..." value={block.content} rows={Math.max(1, block.content.split('\n').length)} onChange={(e) => updateBlock(block.id, parentId, { ...block, content: e.target.value })} /></div>
        )}
        {block.type === 'embed' && (
             <div>
                <div className="flex items-center gap-2 mb-2"><input className="bg-transparent font-medium outline-none text-slate-800 placeholder-slate-300 w-full" placeholder="Video/Embed Title" value={block.title || ''} onChange={(e) => updateBlock(block.id, parentId, { ...block, title: e.target.value })} /></div>
                <input type="text" className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm mb-2 focus:border-[var(--primary)] outline-none" placeholder="Paste YouTube, Vimeo or other URL..." value={block.url} onChange={(e) => updateBlock(block.id, parentId, { ...block, url: e.target.value })} />
                {block.url && <EmbedRenderer url={block.url} />}
             </div>
        )}
        {block.type === 'question' && (
           <div className="flex flex-col-reverse md:flex-row gap-6">
              <div className="flex-1 space-y-3">
                 <div className="flex gap-2"><textarea className="flex-1 text-lg font-medium outline-none placeholder-slate-300 resize-none bg-transparent" placeholder="Question Prompt..." value={block.prompt} onChange={(e) => updateBlock(block.id, parentId, { ...block, prompt: e.target.value })} rows={Math.max(1, block.prompt.length / 60)} /></div>
                 {(block as QuestionBlock).description !== undefined && (<div className="bg-slate-50 p-2 rounded-lg flex items-start gap-2 border border-slate-100 focus-within:border-[var(--primary-300)] transition-colors"><Info size={14} className="text-slate-400 mt-0.5 flex-shrink-0" /><textarea className="w-full text-sm text-slate-600 bg-transparent outline-none resize-none placeholder-slate-400" placeholder="Context / Description..." value={(block as QuestionBlock).description || ''} onChange={(e) => updateBlock(block.id, parentId, { ...block, description: e.target.value })} rows={1} style={{ minHeight: '1.5em' }} onInput={(e) => { (e.target as HTMLTextAreaElement).style.height = 'auto'; (e.target as HTMLTextAreaElement).style.height = (e.target as HTMLTextAreaElement).scrollHeight + 'px'; }} /></div>)}
                 {(block as QuestionBlock).image !== undefined && !(block as QuestionBlock).image && (<div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200"><ImageIcon size={16} className="text-slate-400"/><input className="bg-transparent text-sm w-full outline-none placeholder-slate-400" placeholder="Paste Image URL..." value={(block as QuestionBlock).image || ''} onChange={(e) => updateBlock(block.id, parentId, { ...block, image: e.target.value })} /></div>)}
                 
                 {block.qType === 'multiple-choice' && (
                  <div className="space-y-2 pl-1">
                     <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-400 uppercase">Options</span></div>
                     {block.options?.map((opt: string, optIdx: number) => (
                     <div key={optIdx} className="flex items-center gap-2 group/opt" draggable onDragStart={(e) => handleItemDragStart(e, optIdx)} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => handleItemDrop(e, optIdx, 'options')}>
                        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 opacity-0 group-hover/opt:opacity-100 transition-opacity"><GripVertical size={14} /></div>
                        <div className={`w-4 h-4 ${(block as QuestionBlock).multiSelect ? 'rounded-md' : 'rounded-full'} border border-slate-300 flex-shrink-0`} /><input className={`flex-1 text-sm p-1 border-b border-transparent hover:border-slate-200 focus:border-[var(--primary-300)] outline-none bg-transparent`} value={opt} onChange={(e) => { const newOpts = [...(block.options || [])]; newOpts[optIdx] = e.target.value; updateBlock(block.id, parentId, { ...block, options: newOpts }); }} /><button onClick={() => updateBlock(block.id, parentId, { ...block, options: block.options?.filter((_, i) => i !== optIdx) })} className="text-slate-300 hover:text-red-400"><X size={14} /></button>
                     </div>
                     ))}
                     <button onClick={() => updateBlock(block.id, parentId, { ...block, options: [...(block.options || []), `Option ${(block.options?.length || 0) + 1}`] })} className={`text-xs text-[var(--primary)] font-medium hover:underline flex items-center gap-1 mt-2 pl-6`}><Plus size={12} /> Add Option</button>
                  </div>
                 )}
                 {['cloze-text', 'cloze-dropdown', 'drag-inline'].includes(block.qType) && (
                   <div className="space-y-3 pl-1">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">Sentences</div>
                      {block.listItems?.map((item: string, itemIdx: number) => (
                         <div key={itemIdx} className="flex items-start gap-2 group/list" draggable onDragStart={(e) => handleItemDragStart(e, itemIdx)} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => handleItemDrop(e, itemIdx, 'listItems')}>
                            <div className="mt-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 opacity-0 group-hover/list:opacity-100 transition-opacity"><GripVertical size={14} /></div>
                            <span className="text-slate-300 mt-2 text-xs select-none w-4">{itemIdx + 1}.</span>
                            <textarea className="flex-1 text-sm p-2 bg-slate-50 border border-slate-200 rounded focus:border-[var(--primary-300)] outline-none resize-none font-medium text-slate-700" value={item} rows={Math.max(1, item.length / 50)} onChange={(e) => { const newItems = [...(block.listItems || [])]; newItems[itemIdx] = e.target.value; updateBlock(block.id, parentId, { ...block, listItems: newItems }); }} /><button onClick={() => updateBlock(block.id, parentId, { ...block, listItems: block.listItems?.filter((_, i) => i !== itemIdx) })} className="text-slate-300 hover:text-red-400 mt-2"><X size={14} /></button>
                         </div>
                      ))}
                      <button onClick={() => updateBlock(block.id, parentId, { ...block, listItems: [...(block.listItems || []), 'New sentence with [answer]...'] })} className={`text-xs text-[var(--primary)] font-medium hover:underline flex items-center gap-1 mt-2 pl-9`}><Plus size={12} /> Add Sentence</button>
                   </div>
                 )}
              </div>
              {(block as QuestionBlock).image && (<div className="w-full md:w-1/4 max-w-[200px] flex-shrink-0"><div className="relative group/img rounded-lg overflow-hidden border border-slate-200 bg-slate-50"><img src={(block as QuestionBlock).image!} className="w-full h-auto object-cover" alt="Question" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center p-2"><input className="w-full bg-white text-xs p-1 rounded outline-none" value={(block as QuestionBlock).image || ''} onChange={(e) => updateBlock(block.id, parentId, { ...block, image: e.target.value })} placeholder="Image URL" onClick={(e) => e.stopPropagation()} /></div></div></div>)}
           </div>
        )}
        {block.type === 'group' && (
          <div className={`bg-[var(--primary-50)]/30 rounded-xl p-6 border border-dashed ${dragTarget?.id === block.id && dragTarget.pos === 'inside' ? 'border-[var(--primary)] bg-[var(--primary-100)]/50' : 'border-[var(--primary-200)]'} min-h-[150px] relative`}>
             <div className="mb-6 flex gap-2 items-center">
                {/* Fixed: Use font-medium to match question size, remove bigger text */}
                <input className={`w-full bg-transparent font-medium text-lg text-[var(--primary-900)] outline-none placeholder-[var(--primary-300)]`} placeholder="Group Title..." value={block.title || ''} onChange={(e) => updateBlock(block.id, parentId, { ...block, title: e.target.value })} />
             </div>
             <div className={`space-y-0`}>
                {(block as GroupBlock).children.map((child, childIdx) => {
                   const relevantChildren = (block as GroupBlock).children.slice(0, childIdx + 1).filter(c => c.type === 'question' || c.type === 'group');
                   // Fix numbering: use childIdx logic or passed getNumbering
                   const childLabel = (child.type === 'question' || child.type === 'group') ? getNumbering!(depth + 1, relevantChildren.length - 1) : undefined;

                   return (
                    <EditorBlockWrapper 
                      key={child.id} 
                      block={child} 
                      index={childIdx} 
                      parentId={block.id} 
                      label={childLabel} 
                      updateBlock={updateBlock} 
                      removeBlock={removeBlock} 
                      duplicateBlock={duplicateBlock} 
                      handleDrop={handleDrop} 
                      dragTarget={dragTarget} 
                      setDragTarget={setDragTarget} 
                      onDragEnd={onDragEnd} 
                      isDraggingItem={isDraggingItem}
                      depth={depth + 1}
                      getNumbering={getNumbering}
                      draggedType={draggedType}
                      onBlockDragStart={onBlockDragStart}
                    />
                   )
                })}
             </div>
             
             {/* Drop Zone inside Group */}
             {((block as GroupBlock).children.length === 0 || isDraggingItem) && depth < 1 && (
                 <div 
                    className={`h-16 mt-4 border-2 border-dashed rounded-lg flex items-center justify-center text-xs font-medium transition-all
                        ${!canDropInGroup && isDraggingItem 
                            ? 'border-red-400 bg-red-50 text-red-500 opacity-100 cursor-not-allowed' 
                            : dragTarget?.id === block.id && dragTarget.pos === 'inside'
                            ? 'border-blue-500 bg-blue-50 text-blue-600 opacity-100 scale-[1.02]' 
                            : `border-blue-200 text-blue-300 ${isDraggingItem ? 'opacity-100' : 'opacity-50 hover:opacity-100'} hover:border-blue-400 hover:text-blue-500`
                        }
                    `}
                    onDragOver={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        e.dataTransfer.dropEffect = canDropInGroup ? 'move' : 'none';
                        if (setDragTarget && canDropInGroup) setDragTarget({ id: block.id, pos: 'inside' });
                    }}
                    onDrop={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        if (canDropInGroup) {
                            handleDrop(e, undefined, block.id, (block as GroupBlock).children.length);
                        }
                    }}
                 >
                    { !canDropInGroup && isDraggingItem 
                        ? (isDividerDrag ? "Cannot drop page break in group" : "Max indentation reached") 
                        : "Drag questions here" 
                    }
                 </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};