// Ortak docx görsel stil yardımcıları — hem DevPulse'ın kendi feature
// dokümanları (app/api/docs/generate) hem de kullanıcı projeleri için
// üretilen proje sunumu dokümanı (app/api/docs/project) bunu kullanır.

import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat,
} from 'docx';

export const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } as const;
export const borders = { top: border, bottom: border, left: border, right: border };
export const hBorder = { style: BorderStyle.SINGLE, size: 1, color: '4F81BD' } as const;
export const hBorders = { top: hBorder, bottom: hBorder, left: hBorder, right: hBorder };

export const h2 = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color: '2E75B6' })],
  });

export const p = (text: string, opts: Record<string, unknown> = {}) =>
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, font: 'Arial', ...(opts as object) })],
  });

export const divider = () =>
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
    spacing: { after: 160 },
    children: [],
  });

export const twoColTable = (headers: [string, string], rows: [string, string][]) =>
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3000, 6360],
    rows: [
      new TableRow({
        children: headers.map((text, i) =>
          new TableCell({
            borders: hBorders, width: { size: i === 0 ? 3000 : 6360, type: WidthType.DXA },
            shading: { fill: '2E75B6', type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: 'FFFFFF' })] })],
          })
        ),
      }),
      ...rows.map(([a, b], i) =>
        new TableRow({
          children: [a, b].map((text, colIdx) =>
            new TableCell({
              borders, width: { size: colIdx === 0 ? 3000 : 6360, type: WidthType.DXA },
              shading: { fill: i % 2 === 0 ? 'EBF3FB' : 'FFFFFF', type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, bold: colIdx === 0, size: 22, font: 'Arial' })] })],
            })
          ),
        })
      ),
    ],
  });

export const techTable = (rows: [string, string][]) => twoColTable(['Katman', 'Teknoloji / Detay'], rows);

// Standart sayfa iskeleti: başlık, marj, header/footer, bullet numaralandırma.
export function pageShell(docTitle: string, body: (Paragraph | Table)[]): Document {
  return new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2E75B6', space: 1 } },
            children: [
              new TextRun({ text: 'RepoMind — Teknik Dokümantasyon', size: 18, font: 'Arial', color: '666666' }),
              new TextRun({ text: `\t${docTitle}`, size: 18, font: 'Arial', color: '2E75B6' }),
            ],
            tabStops: [{ type: 'right' as const, position: 8640 }],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Sayfa ', size: 18, font: 'Arial', color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: '999999' }),
            ],
          })],
        }),
      },
      children: body,
    }],
  });
}
