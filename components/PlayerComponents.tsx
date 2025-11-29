import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { QuestionBlock } from "../types";
import { useInputStyle, CustomSelect } from "./UIComponents";

export const MultipleChoicePlayer = ({ block, onChange, value }: { block: QuestionBlock, onChange: (val: any) => void, value: any }) => {
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

export const OpenAnswerPlayer = ({ onChange, value }: { onChange: (val: any) => void, value: any }) => {
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

export const ClozeTextPlayer = ({ block, onChange, value }: { block: QuestionBlock, onChange: (val: any) => void, value: any }) => {
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

export const ClozeDropdownPlayer = ({ block, onChange, value }: { block: QuestionBlock, onChange: (val: any) => void, value: any }) => {
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

export const DragInlinePlayer = ({ block, onChange, value }: { block: QuestionBlock, onChange: (val: any) => void, value: any }) => {
  const currentAnswers = value || {};
  
  // Aggregate word bank from all lines
  const availableWords = useMemo(() => {
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