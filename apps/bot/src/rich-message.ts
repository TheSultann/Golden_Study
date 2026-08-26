export type RichText =
  | string
  | {
      type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler'
        | 'code' | 'marked' | 'subscript' | 'superscript'
        | 'url' | 'mention' | 'hashtag' | 'bot_command' | 'email_address'
        | 'phone_number' | 'custom_emoji';
      text?: RichText;
      url?: string;
      username?: string;
      custom_emoji_id?: string;
      alternative_text?: string;
    }
  | RichText[];

export type InputRichBlock =
  | { type: 'paragraph'; text: RichText }
  | { type: 'heading'; text: RichText; size: number }
  | { type: 'divider' }
  | { type: 'footer'; text: RichText }
  | { type: 'pre'; text: RichText; language?: string }
  | { type: 'blockquote'; blocks: InputRichBlock[]; credit?: RichText }
  | { type: 'pullquote'; text: RichText; credit?: RichText }
  | { type: 'details'; summary: RichText; blocks: InputRichBlock[]; is_open?: boolean }
  | { type: 'list'; items: InputRichBlockListItem[] }
  | { type: 'slideshow'; blocks: InputRichBlock[]; caption?: RichBlockCaption }
  | { type: 'table'; cells: RichBlockTableCell[][]; is_bordered?: boolean; is_striped?: boolean; caption?: RichText };

export interface RichBlockTableCell {
  text?: RichText;
  is_header?: boolean;
  colspan?: number;
  rowspan?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
}

export interface InputRichBlockListItem {
  blocks: InputRichBlock[];
  has_checkbox?: boolean;
  is_checked?: boolean;
}

export interface RichBlockCaption {
  text: RichText;
  credit?: RichText;
}

export function bold(t: RichText): RichText {
  return { type: 'bold', text: t };
}

export function italic(t: RichText): RichText {
  return { type: 'italic', text: t };
}

export function spoiler(t: RichText): RichText {
  return { type: 'spoiler', text: t };
}

export function header(text: RichText, size: number = 4): InputRichBlock {
  return { type: 'heading', text, size };
}

export function divider(): InputRichBlock {
  return { type: 'divider' };
}

export function paragraph(text: RichText): InputRichBlock {
  return { type: 'paragraph', text };
}

export function slideshow(blocks: InputRichBlock[]): InputRichBlock {
  return { type: 'slideshow', blocks };
}

export function tbl(cells: RichBlockTableCell[][], opts?: { bordered?: boolean; striped?: boolean }): InputRichBlock {
  return { type: 'table', cells, is_bordered: opts?.bordered ?? true, is_striped: opts?.striped ?? true };
}

export function details(summary: RichText, blocks: InputRichBlock[], is_open = false): InputRichBlock {
  return { type: 'details', summary, blocks, is_open };
}

export function footer(text: RichText): InputRichBlock {
  return { type: 'footer', text };
}

export function list(items: InputRichBlockListItem[]): InputRichBlock {
  return { type: 'list', items };
}
