import { Block, BlockType, GroupBlock, QuestionBlock, QuestionType, TextBlock, WorksheetData } from "./types";

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const createBlock = (type: BlockType, qType?: QuestionType): Block => {
  const id = generateId();
  if (type === 'question') {
    let defaultPrompt = "New Question";
    switch (qType) {
        case 'multiple-choice': defaultPrompt = "Select the correct option"; break;
        case 'open-answer': defaultPrompt = "Type your answer below"; break;
        case 'cloze-text': defaultPrompt = "Fill in the missing words"; break;
        case 'cloze-dropdown': defaultPrompt = "Select the correct options"; break;
        case 'drag-inline': defaultPrompt = "Drag and drop the words"; break;
    }

    return { 
      id, 
      type: 'question', 
      qType: qType!, 
      prompt: defaultPrompt, 
      listItems: qType === 'cloze-text' ? ['The capital of France is [Paris].'] : 
                 qType === 'cloze-dropdown' ? ['The sky is [blue|green|red].'] : 
                 qType === 'drag-inline' ? ['The [cat] sat on the [mat].'] : undefined,
      options: qType === 'multiple-choice' ? ['Option 1', 'Option 2'] : undefined 
    };
  } else if (type === 'text') {
    return { id, type: 'text', content: '### Instructions\n\nEnter your text instructions here...' };
  } else if (type === 'group') {
    return { id, type: 'group', title: 'New Group', children: [] };
  } else if (type === 'embed') {
    return { id, type: 'embed', url: '', title: 'Video Resource' };
  } else {
    return { id, type: 'divider' };
  }
};

export const encodeState = (data: WorksheetData) => {
  try {
    return btoa(JSON.stringify(data));
  } catch (e) {
    console.error("Failed to encode", e);
    return "";
  }
};

export const decodeState = (hash: string): WorksheetData | null => {
  try {
    const json = atob(hash.replace("#data=", ""));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
};

export const duplicateBlockHelper = (block: Block): Block => {
  const newId = generateId();
  if (block.type === 'group') {
    return { ...block, id: newId, children: (block as GroupBlock).children.map(duplicateBlockHelper) as (QuestionBlock | TextBlock)[] };
  }
  return { ...block, id: newId };
};

export const createDragPreview = (label: string) => {
  const ghost = document.createElement('div');
  ghost.textContent = label;
  ghost.style.position = 'absolute';
  ghost.style.top = '-1000px';
  ghost.style.background = 'white';
  ghost.style.padding = '10px 16px';
  ghost.style.borderRadius = '8px';
  ghost.style.border = '1px solid #cbd5e1';
  ghost.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
  ghost.style.fontFamily = 'sans-serif';
  ghost.style.fontWeight = '600';
  ghost.style.fontSize = '14px';
  ghost.style.color = '#334155';
  ghost.style.zIndex = '1000';
  document.body.appendChild(ghost);
  return ghost;
};

export const downloadFile = (filename: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};