import type { TranslationKey } from './i18n';

export const RESUME_FILE_ACCEPT = '.pdf,.docx,.txt,.md';

const MAX_RESUME_FILE_BYTES = 10 * 1024 * 1024;
const MIN_READABLE_CHARACTERS = 80;

export type ResumeTextErrorCode =
  | 'unsupported'
  | 'tooLarge'
  | 'noTextLayer'
  | 'tooShort'
  | 'unreadable';

export class ResumeTextError extends Error {
  code: ResumeTextErrorCode;

  constructor(code: ResumeTextErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = 'ResumeTextError';
    this.code = code;
  }
}

export function getResumeTextErrorCode(error: unknown): ResumeTextErrorCode {
  return error instanceof ResumeTextError ? error.code : 'unreadable';
}

const RESUME_ERROR_KEYS = {
  unsupported: 'resume.unsupported',
  tooLarge: 'resume.tooLarge',
  noTextLayer: 'resume.noTextLayer',
  tooShort: 'resume.tooShort',
  unreadable: 'resume.unreadable'
} satisfies Record<ResumeTextErrorCode, TranslationKey>;

export function getResumeTextErrorKey(error: unknown) {
  return RESUME_ERROR_KEYS[getResumeTextErrorCode(error)];
}

export async function extractResumeText(file: File) {
  if (file.size > MAX_RESUME_FILE_BYTES) {
    throw new ResumeTextError('tooLarge');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  let rawText = '';

  try {
    if (extension === 'txt' || extension === 'md') {
      rawText = await file.text();
    } else if (extension === 'docx') {
      rawText = await extractDocxText(file);
    } else if (extension === 'pdf') {
      rawText = await extractPdfText(file);
    } else {
      throw new ResumeTextError('unsupported');
    }
  } catch (error) {
    if (error instanceof ResumeTextError) throw error;
    throw new ResumeTextError('unreadable', error);
  }

  const text = cleanExtractedText(rawText);
  if (text.length < MIN_READABLE_CHARACTERS) {
    throw new ResumeTextError(extension === 'pdf' ? 'noTextLayer' : 'tooShort');
  }

  return text;
}

async function extractDocxText(file: File) {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const input = typeof window === 'undefined'
    ? { buffer: Buffer.from(arrayBuffer) }
    : { arrayBuffer };
  const result = await mammoth.extractRawText(input);
  return result.value;
}

async function extractPdfText(file: File) {
  const pdfjs = typeof window === 'undefined'
    ? await import('pdfjs-dist/legacy/build/pdf.mjs')
    : await import('pdfjs-dist');

  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  });

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = '';

      for (const item of content.items) {
        if (!('str' in item)) continue;
        pageText += item.str;
        pageText += item.hasEOL ? '\n' : ' ';
      }

      pages.push(pageText.trim());
      page.cleanup();
    }

    return pages.filter(Boolean).join('\n\n');
  } finally {
    await loadingTask.destroy();
  }
}

function cleanExtractedText(value: string) {
  return value
    .replace(/\u0000/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
