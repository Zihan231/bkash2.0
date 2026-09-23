import type { SocialSubmission } from '@/lib/social-store';

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function slug(value: string) {
  return value.normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'submission';
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function screenshotFileName(submission: SocialSubmission, index?: number) {
  const ext = EXTENSIONS[submission.screenshot.type] ?? 'png';
  const prefix = index === undefined ? '' : `${String(index + 1).padStart(3, '0')}_`;
  return `${prefix}${slug(submission.name)}_${submission.id.slice(0, 8)}.${ext}`;
}

// Text cells: quote, and neutralise leading = + - @ so spreadsheet apps don't run them as formulas.
function textCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Phone cells: written as ="01712345678" so Excel keeps the leading zero.
function phoneCell(value: string) {
  return /^\d+$/.test(value) ? `"=""${value}"""` : textCell(value);
}

export function buildCsv(submissions: SocialSubmission[]) {
  const header = ['#', 'Submission ID', 'Name', 'College', 'Contact Number', 'bKash Number', "Friend's bKash Number", 'Screenshot File', 'Original File Name', 'Submitted At'];
  const rows = submissions.map((s, i) => [
    String(i + 1),
    textCell(s.id),
    textCell(s.name),
    textCell(s.college),
    phoneCell(s.contactNumber),
    phoneCell(s.bkashNumber),
    phoneCell(s.friendBkashNumber),
    textCell(`screenshots/${screenshotFileName(s, i)}`),
    textCell(s.screenshotName),
    textCell(formatDateTime(s.createdAt)),
  ]);
  // BOM so Excel opens the file as UTF-8 (Bangla names etc.).
  return '﻿' + [header.map(textCell), ...rows].map((r) => r.join(',')).join('\r\n');
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportStamp() {
  return formatDateTime(new Date().toISOString()).replace(/[ :]/g, '-');
}

export function downloadCsv(submissions: SocialSubmission[]) {
  downloadBlob(new Blob([buildCsv(submissions)], { type: 'text/csv;charset=utf-8' }), `social-submissions_${exportStamp()}.csv`);
}

export async function downloadZip(submissions: SocialSubmission[]) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('submissions.csv', buildCsv(submissions));
  const folder = zip.folder('screenshots');
  submissions.forEach((s, i) => folder?.file(screenshotFileName(s, i), s.screenshot));
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `social-submissions_${exportStamp()}.zip`);
}
