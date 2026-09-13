import type { PropertyDocument } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import type { Property } from '../types';
import { documentExtractionService } from './documentExtractionService';
import { documentTypeDetectionService } from './documentTypeDetectionService';
import { pdfTextExtractionService } from './pdfTextExtractionService';
import { propertyDataRoomService } from './propertyDataRoomService';

const TESSERACT_MODULE_URL = 'https://esm.sh/tesseract.js@5.1.1';
const PDFJS_VERSION = '4.10.38';
const PDFJS_MODULE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

type OcrWorker = {
  recognize: (image: Blob | HTMLCanvasElement) => Promise<{ data: { text: string; confidence?: number } }>;
  terminate: () => Promise<void>;
};

type TesseractModule = {
  createWorker: (languages: string) => Promise<OcrWorker>;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (input: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (pageNumber: number) => Promise<{
    getViewport: (input: { scale: number }) => { width: number; height: number };
    render: (input: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
  }> }> };
};

export interface BrowserOcrResult {
  text: string;
  queued: number;
  pageCount: number;
  confidence?: number;
}

export const browserOcrService = {
  async process(document: PropertyDocument): Promise<BrowserOcrResult> {
    const source = await resolveSource(document);
    const tesseract = await importTesseract();
    const worker = await tesseract.createWorker('kor+eng');
    try {
      const inputs = document.mimeType === 'application/pdf' ? await renderPdfPages(source) : [source];
      const texts: string[] = [];
      const confidences: number[] = [];
      for (const input of inputs) {
        const result = await worker.recognize(input);
        if (result.data.text?.trim()) texts.push(result.data.text.trim());
        if (typeof result.data.confidence === 'number') confidences.push(result.data.confidence);
      }
      const text = texts.join('\n\n').trim();
      if (!text) {
        await propertyDataRoomService.updateDocumentExtraction(document, { status: 'manual_review', method: 'ocr', pageCount: inputs.length, error: 'OCR에서 읽을 수 있는 텍스트를 찾지 못했습니다.' });
        return { text: '', queued: 0, pageCount: inputs.length };
      }

      const detectedType = document.documentType === 'other'
        ? documentTypeDetectionService.detect(text, document.documentType)
        : document.documentType;
      const extractionDocument = detectedType !== document.documentType
        ? await propertyDataRoomRepository.updateDocument({ ...document, documentType: detectedType, updatedAt: new Date().toISOString() })
        : document;
      const prefills = pdfTextExtractionService.prefill(extractionDocument.documentType, text);
      const fields = Object.entries(prefills).map(([fieldKey, rawValue]) => ({ fieldKey: fieldKey as keyof Property, rawValue }));
      const queued = fields.length ? await documentExtractionService.queueExtractedFields(extractionDocument, fields) : 0;
      const confidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length / 100 : undefined;
      await propertyDataRoomService.updateDocumentExtraction(extractionDocument, {
        status: queued ? 'text_extracted' : 'manual_review', method: 'ocr', pageCount: inputs.length,
        error: queued ? undefined : 'OCR 텍스트는 추출했지만 자동 식별된 필드가 없습니다.',
      });
      return { text, queued, pageCount: inputs.length, confidence };
    } catch (reason) {
      await propertyDataRoomService.updateDocumentExtraction(document, {
        status: 'failed', method: 'ocr', error: reason instanceof Error ? reason.message : 'OCR 처리 실패',
      });
      throw reason;
    } finally {
      await worker.terminate();
    }
  },
};

async function resolveSource(document: PropertyDocument): Promise<Blob> {
  if (document.fileData) return document.fileData;
  if (document.fileUrl) {
    const response = await fetch(document.fileUrl);
    if (!response.ok) throw new Error('OCR 대상 원본 파일을 불러오지 못했습니다.');
    return response.blob();
  }
  throw new Error('OCR 대상 원본 파일을 찾을 수 없습니다.');
}

async function importTesseract(): Promise<TesseractModule> {
  try {
    const moduleUrl = TESSERACT_MODULE_URL;
    return await import(/* @vite-ignore */ moduleUrl) as TesseractModule;
  } catch {
    throw new Error('브라우저 OCR 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  }
}

async function renderPdfPages(file: Blob): Promise<HTMLCanvasElement[]> {
  const moduleUrl = PDFJS_MODULE_URL;
  const pdfjs = await import(/* @vite-ignore */ moduleUrl) as PdfJsModule;
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const canvases: HTMLCanvasElement[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PDF OCR용 Canvas를 생성하지 못했습니다.');
    await page.render({ canvasContext: context, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}
