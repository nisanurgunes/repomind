import { NextRequest, NextResponse } from 'next/server';
import { Packer, Paragraph, Table, TextRun } from 'docx';
import { h2, p, divider, techTable, pageShell } from '@/lib/docxBuilders';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api';

interface ProjectDocFeature { title: string; description: string; }
interface ProjectDocEndpoint { method: string; path: string; desc: string; }
interface ProjectDocResponse {
  tagline: string;
  overview: string;
  tech_stack: [string, string][];
  features: ProjectDocFeature[];
  endpoints: ProjectDocEndpoint[];
  highlights: string[];
  repo: { full_name: string; description: string | null; language: string | null; stars: number };
}

function buildProjectDoc(data: ProjectDocResponse) {
  const body: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: data.repo.full_name, bold: true, size: 48, font: 'Arial', color: '1F3864' })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: data.tagline, size: 24, font: 'Arial', color: '2E75B6', italics: true })],
    }),
    divider(),

    h2('Genel Bakış'),
    p(data.overview),
    new Paragraph({ spacing: { after: 240 }, children: [] }),

    h2('Teknoloji Yığını'),
    techTable(data.tech_stack),
    new Paragraph({ spacing: { after: 240 }, children: [] }),

    h2('Özellikler'),
    ...data.features.flatMap(f => [
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: f.title, bold: true, size: 22, font: 'Arial', color: '1F3864' })],
      }),
      p(f.description),
    ]),
    new Paragraph({ spacing: { after: 240 }, children: [] }),
  ];

  if (data.endpoints?.length) {
    body.push(h2("API Endpoint'leri"));
    for (const ep of data.endpoints) {
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

  body.push(h2('Öne Çıkanlar'));
  for (const hl of data.highlights) {
    body.push(new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      spacing: { after: 80 },
      children: [new TextRun({ text: hl, size: 22, font: 'Arial' })],
    }));
  }

  return pageShell(`${data.repo.full_name} — Proje Sunumu`, body);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get('owner');
  const name = searchParams.get('name');
  const authHeader = req.headers.get('authorization');

  if (!owner || !name) {
    return NextResponse.json({ error: "owner ve name parametreleri gerekli." }, { status: 400 });
  }
  if (!authHeader) {
    return NextResponse.json({ detail: "Giriş yapmalısınız." }, { status: 401 });
  }

  const backendRes = await fetch(`${BASE}/repos/${owner}/${name}/project-doc`, {
    headers: { Authorization: authHeader },
  });
  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({ detail: 'Doküman oluşturulamadı.' }));
    return NextResponse.json(err, { status: backendRes.status });
  }

  const data: ProjectDocResponse = await backendRes.json();
  const doc = buildProjectDoc(data);
  const buffer = await Packer.toBuffer(doc);
  const filename = `${owner}-${name}-proje-sunumu.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
