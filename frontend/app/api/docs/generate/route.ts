import { NextRequest, NextResponse } from 'next/server';
import { Packer, Paragraph, TextRun, Table } from 'docx';
import { FEATURE_DOCS, type FeatureDoc } from '@/lib/featureDocs';
import { h2, p, divider, techTable, pageShell } from '@/lib/docxBuilders';

// ─── Document builder ─────────────────────────────────────────────────────────

function buildDoc(feature: FeatureDoc) {
  const body: (Paragraph | Table)[] = [
    // Title block
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: feature.title, bold: true, size: 48, font: 'Arial', color: '1F3864' })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: feature.subtitle, size: 24, font: 'Arial', color: '2E75B6', italics: true })],
    }),
    divider(),

    h2('Genel Bakış'),
    p(feature.overview),
    new Paragraph({ spacing: { after: 240 }, children: [] }),

    h2('Nasıl Çalışır?'),
    ...feature.howItWorks.map((step, i) =>
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 22, font: 'Arial', color: '2E75B6' }),
          new TextRun({ text: step, size: 22, font: 'Arial' }),
        ],
      })
    ),
    new Paragraph({ spacing: { after: 240 }, children: [] }),

    h2('Kullanılan Teknolojiler'),
    techTable(feature.tech),
    new Paragraph({ spacing: { after: 240 }, children: [] }),
  ];

  if (feature.endpoints?.length) {
    body.push(h2("API Endpoint'leri"));
    for (const ep of feature.endpoints) {
      body.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${ep.method} `, bold: true, size: 22, font: 'Courier New', color: ep.method === 'GET' ? '2E75B6' : ep.method === 'POST' ? '2E8B57' : 'CC4400' }),
            new TextRun({ text: ep.path, size: 22, font: 'Courier New', color: '333333' }),
          ],
        }),
        p(ep.desc, { color: '555555', italics: true })
      );
    }
    body.push(new Paragraph({ spacing: { after: 240 }, children: [] }));
  }

  if (feature.files?.length) {
    body.push(h2('İlgili Dosyalar'));
    for (const f of feature.files) {
      body.push(new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: f.path, size: 20, font: 'Courier New', color: '2E75B6' }),
          new TextRun({ text: ` — ${f.desc}`, size: 22, font: 'Arial', color: '555555' }),
        ],
      }));
    }
    body.push(new Paragraph({ spacing: { after: 240 }, children: [] }));
  }

  body.push(h2('Öne Çıkan Özellikler'));
  for (const hl of feature.highlights) {
    body.push(new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      spacing: { after: 80 },
      children: [new TextRun({ text: hl, size: 22, font: 'Arial' })],
    }));
  }

  return pageShell(feature.title, body);
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const featureKey = searchParams.get('feature'); // 'all' or a specific key

  const keys = featureKey === 'all' || !featureKey
    ? Object.keys(FEATURE_DOCS)
    : featureKey.split(',').map(k => k.trim());

  const missing = keys.filter(k => !FEATURE_DOCS[k]);
  if (missing.length) {
    return NextResponse.json({ error: `Bilinmeyen feature: ${missing.join(', ')}` }, { status: 400 });
  }

  if (keys.length === 1) {
    // Single doc — return as-is
    const key = keys[0];
    const doc = buildDoc(FEATURE_DOCS[key]);
    const buffer = await Packer.toBuffer(doc);
    const filename = `devpulse-${key}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // Multiple docs — zip them
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const key of keys) {
    const doc = buildDoc(FEATURE_DOCS[key]);
    const buffer = await Packer.toBuffer(doc);
    zip.file(`${key}.docx`, buffer);
  }
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="devpulse-docs.zip"',
    },
  });
}
