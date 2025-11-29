import React, { useState, useEffect, useMemo } from "react";
import { 
  Upload, 
  FileText, 
  Heart,
  AlertCircle
} from "lucide-react";
import { Block, WorksheetData, GroupBlock, QuestionBlock } from "../types";
import { decodeState } from "../helpers";
import { ThemeContext } from "../ThemeContext";
import { ThemeStyle, SimpleMarkdown, EmbedRenderer } from "./UIComponents";
import { MultipleChoicePlayer, OpenAnswerPlayer, ClozeTextPlayer, ClozeDropdownPlayer, DragInlinePlayer } from "./PlayerComponents";

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

export const Answer = () => {
  const [data, setData] = useState<WorksheetData | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#data=")) {
      const decoded = decodeState(hash);
      if (decoded) {
        setData(decoded);
      } else {
          // Only show error if hash exists but is invalid, not on clean load (upload mode)
          if (hash.length > 6) setError("Invalid worksheet link.");
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const json = JSON.parse(ev.target?.result as string);
              if (json.blocks) { // Basic validation
                  setData(json);
                  setError(null);
              } else {
                  setError("Invalid worksheet file format.");
              }
          } catch (err) {
              setError("Failed to parse file.");
          }
      };
      reader.readAsText(file);
  };

  const segments = useMemo(() => {
    if (!data) return [];
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
  }, [data]);

  const getNumbering = (depth: number, index: number) => {
     if (depth === 0) return `${index + 1}.`;
     if (depth === 1) return `${String.fromCharCode(97 + index)}.`;
     if (depth >= 2) return `${toRoman(index + 1)}.`;
     return '';
  }

  let questionCounter = 0;

  if (!data) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText size={32} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Load Worksheet</h1>
                <p className="text-slate-500 mb-8">Upload a <code>.wks</code> (JSON) file to start answering.</p>
                
                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 justify-center">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-3 text-slate-400" />
                        <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    </div>
                    <input type="file" className="hidden" accept=".json,.wks" onChange={handleFileUpload} />
                </label>
            </div>
            <footer className="mt-12 text-slate-400 text-xs flex items-center gap-1">
                made with <Heart size={10} className="text-red-500 fill-red-500" /> by daniel
            </footer>
        </div>
      )
  }

  return (
    <ThemeContext.Provider value={data.design || { accentColor: '#6366f1', font: 'sans' }}>
      <ThemeStyle color={data.design?.accentColor || '#6366f1'} />
      <div className={`min-h-screen pb-40 bg-slate-50 selection:bg-[var(--primary-100)] selection:text-[var(--primary-900)] flex flex-col items-center`}>
        
        <div className="w-full max-w-5xl px-4 md:px-12 pt-12 pb-12">
            <div className="space-y-8">
                {segments.map((segment, segIdx) => {
                    if (segment.length === 1 && segment[0].type === 'divider') return <div key={segment[0].id} className="h-px bg-slate-200 w-full my-8 break-before-page"></div>;
                    if (segment.length === 0 && segIdx !== 0) return null;

                    return (
                      <div key={segIdx} className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 md:p-16 space-y-8 relative break-after-page animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                  questionCounter++; 
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
      </div>
    </ThemeContext.Provider>
  );
};