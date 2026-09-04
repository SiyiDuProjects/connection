import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import {
  extractResumeText,
  ResumeTextError
} from '../lib/resume-text.ts';

const LONG_RESUME_TEXT = [
  'Alex Chen is a software engineer with experience building TypeScript applications and APIs.',
  'Education includes computer science, distributed systems, databases, and product engineering.',
  'Projects include reliable web services, accessible interfaces, testing, and cloud deployment.'
].join(' ');

test('extracts and cleans TXT resumes', async () => {
  const file = new File([LONG_RESUME_TEXT.replaceAll(' ', '  ')], 'resume.txt', {
    type: 'text/plain'
  });
  const text = await extractResumeText(file);
  assert.match(text, /software engineer/);
  assert.doesNotMatch(text, / {2}/);
});

test('extracts raw text from DOCX resumes', async () => {
  const file = new File([await createDocx(LONG_RESUME_TEXT)], 'resume.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  const text = await extractResumeText(file);
  assert.match(text, /distributed systems/);
  assert.match(text, /cloud deployment/);
});

test('extracts selectable text from PDF resumes', async () => {
  const file = new File([createPdf(LONG_RESUME_TEXT)], 'resume.pdf', {
    type: 'application/pdf'
  });
  const text = await extractResumeText(file);
  assert.match(text, /TypeScript applications/);
  assert.match(text, /computer science/);
});

test('identifies PDFs without a readable text layer', async () => {
  const file = new File([createPdf('')], 'scan.pdf', { type: 'application/pdf' });
  await assert.rejects(
    extractResumeText(file),
    (error) => error instanceof ResumeTextError && error.code === 'noTextLayer'
  );
});

test('rejects unsupported and oversized files', async () => {
  await assert.rejects(
    extractResumeText(new File([LONG_RESUME_TEXT], 'resume.doc')),
    (error) => error instanceof ResumeTextError && error.code === 'unsupported'
  );
  await assert.rejects(
    extractResumeText(new File([new Uint8Array((10 * 1024 * 1024) + 1)], 'resume.pdf')),
    (error) => error instanceof ResumeTextError && error.code === 'tooLarge'
  );
});

async function createDocx(text) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  );
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body>` +
      '</w:document>'
  );
  return zip.generateAsync({ type: 'uint8array' });
}

function createPdf(text) {
  const escapedText = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  const stream = text
    ? `BT\n/F1 10 Tf\n40 740 Td\n(${escapedText}) Tj\nET`
    : '40 700 300 40 re S';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  const chunks = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`));
  }

  const xrefOffset = Buffer.concat(chunks).length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  ].join('');
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
