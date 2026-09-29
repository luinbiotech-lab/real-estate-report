import type { DocumentType } from '../domain/propertyDataRoom/types';

const PDFJS_VERSION = '4.10.38';
const PDFJS_MODULE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

type PdfTextItem = { str?: string; hasEOL?: boolean };

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (input: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<{ items: PdfTextItem[] }> }> }> };
};

export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  hasTextLayer: boolean;
}

export const pdfTextExtractionService = {
  async extract(file: Blob): Promise<PdfTextExtractionResult> {
    if (file.type !== 'application/pdf') throw new Error('PDF 파일만 텍스트 추출할 수 있습니다.');
    const pdfjs = await importPdfJs();
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let current = '';
      for (const item of content.items) {
        const value = item.str?.trim();
        if (value) current += `${current ? ' ' : ''}${value}`;
        if (item.hasEOL && current) { lines.push(current); current = ''; }
      }
      if (current) lines.push(current);
      pages.push(lines.join('\n'));
    }
    const text = pages.join('\n\n').trim();
    return { text, pageCount: pdf.numPages, hasTextLayer: text.length >= 20 };
  },

  prefill(documentType: DocumentType, text: string): Record<string, string> {
    const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    const values: Record<string, string> = {};
    const put = (key: string, patterns: RegExp[], transform?: (value: string) => string) => {
      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match?.[1]) continue;
        values[key] = transform ? transform(match[1].trim()) : match[1].trim();
        break;
      }
    };
    const numberOnly = (value: string) => value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? value.trim();
    const normalizeDate = (value: string) => {
      const match = value.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
      return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : value.trim();
    };
    const line = '([^\\n]{1,120})';

    if (['building_register', 'land_register', 'land_use_plan', 'registry', 'cadastral_map'].includes(documentType)) {
      put('address', [new RegExp(`(?:소재지|대지위치|토지소재|주소)\\s*[:：]?\\s*${line}`, 'i')]);
    }
    if (documentType === 'building_register') {
      put('buildingName', [new RegExp(`(?:건물명|명칭)\\s*[:：]?\\s*${line}`, 'i')]);
      put('mainUse', [new RegExp(`(?:주용도|용도)\\s*[:：]?\\s*${line}`, 'i')]);
      put('structure', [new RegExp(`(?:구조)\\s*[:：]?\\s*${line}`, 'i')]);
      put('basementFloors', [/(?:지하층수|지하층|지하)\s*[:：]?\s*(\d+)/i], numberOnly);
      put('groundFloors', [/(?:지상층수|지상층|지상)\s*[:：]?\s*(\d+)/i], numberOnly);
      put('completionDate', [/(?:사용승인일|사용승인일자|준공일)\s*[:：]?\s*([^\n]{4,30})/i], normalizeDate);
      put('buildingCoverageRate', [/(?:건폐율)\s*[:：]?\s*([\d,.]+)\s*%?/i], numberOnly);
      put('floorAreaRatio', [/(?:용적률)\s*[:：]?\s*([\d,.]+)\s*%?/i], numberOnly);
      put('parkingOfficial', [/(?:주차대수|주차장|주차)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*대?/i], numberOnly);
      put('totalFloorAreaSqm', [/(?:연면적)\s*[:：]?\s*([\d,.]+)\s*(?:㎡|m2|m²)?/i], numberOnly);
    }
    if (documentType === 'land_register' || documentType === 'cadastral_map') {
      put('landAreaSqm', [/(?:면적|대지면적|토지면적)\s*[:：]?\s*([\d,.]+)\s*(?:㎡|m2|m²)?/i], numberOnly);
    }
    if (documentType === 'land_use_plan') {
      put('zoning', [new RegExp(`(?:용도지역|지역·지구|지역지구)\\s*[:：]?\\s*${line}`, 'i')]);
    }
    if (documentType === 'registry') {
      put('buildingName', [new RegExp(`(?:건물명|건물의 명칭|명칭)\\s*[:：]?\\s*${line}`, 'i')]);
    }
    if (documentType === 'lease_status') {
      put('deposit', [/(?:보증금)\s*[:：]?\s*([\d,.]+)\s*(?:원|만원|억원)?/i], numberOnly);
      put('monthlyRent', [/(?:월세|차임)\s*[:：]?\s*([\d,.]+)\s*(?:원|만원)?/i], numberOnly);
      put('occupancyStatus', [new RegExp(`(?:임대현황|명도상태|점유현황)\\s*[:：]?\\s*${line}`, 'i')]);
    }
    if (documentType === 'appraisal') {
      put('salePrice', [/(?:평가금액|감정평가액|평가액)\s*[:：]?\s*([\d,.]+)\s*(?:원)?/i], numberOnly);
      put('landAreaSqm', [/(?:대지면적|토지면적)\s*[:：]?\s*([\d,.]+)\s*(?:㎡|m2|m²)?/i], numberOnly);
      put('totalFloorAreaSqm', [/(?:연면적)\s*[:：]?\s*([\d,.]+)\s*(?:㎡|m2|m²)?/i], numberOnly);
    }
    return values;
  },
};

async function importPdfJs(): Promise<PdfJsModule> {
  try {
    const moduleUrl = PDFJS_MODULE_URL;
    const pdfjs = await import(/* @vite-ignore */ moduleUrl) as PdfJsModule;
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return pdfjs;
  } catch {
    throw new Error('PDF 텍스트 추출 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  }
}
