
export type BlockType = 'text' | 'divider' | 'embed' | 'group' | 'question';
export type QuestionType = 'multiple-choice' | 'open-answer' | 'cloze-text' | 'cloze-dropdown' | 'drag-inline';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  content: string;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface EmbedBlock extends BaseBlock {
  type: 'embed';
  url: string;
  title?: string;
}

export interface QuestionBlock extends BaseBlock {
  type: 'question';
  qType: QuestionType;
  prompt: string;
  listItems?: string[]; 
  image?: string | null; 
  description?: string | null;
  options?: string[];
  multiSelect?: boolean;
  correctAnswer?: string | string[]; 
}

export interface GroupBlock extends BaseBlock {
  type: 'group';
  title?: string;
  children: Block[]; // Allow any block type for nesting
}

export type Block = TextBlock | DividerBlock | EmbedBlock | QuestionBlock | GroupBlock;

export interface DesignSettings {
  accentColor: string; 
  font: 'sans' | 'serif' | 'mono';
}

export interface WorksheetData {
  title: string;
  description: string;
  blocks: Block[];
  design?: DesignSettings;
}

export interface DragItem {
  id?: string;
  index?: number;
  parentId?: string;
  type: 'block' | 'new-block';
  payload?: { type: BlockType, qType?: QuestionType };
}
