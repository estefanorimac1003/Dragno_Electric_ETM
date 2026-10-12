// DXF Export Service with both API call and client-side instant generation fallback

import { generateDxf } from '../cad/dxfGenerator.js';

/**
 * Export current sheet or project to AutoCAD DXF file and trigger browser download
 */
export async function exportSheetToDxf(sheet, projectName = 'DRAGNO ELECTRIC CAD') {
  const filename = `${sheet.title.replace(/\s+/g, '_')}_${Date.now()}.dxf`;

  const payload = {
    sheetConfig: {
      width: sheet.width || 1100,
      height: sheet.height || 750,
      projectName: projectName,
      sheetTitle: sheet.title,
      company: 'DRAGNO ELECTRIC / CONTROLMAX 360',
      date: new Date().toLocaleDateString()
    },
    components: sheet.components || [],
    wires: sheet.wires || [],
    filename
  };

  try {
    // Attempt backend export endpoint
    const response = await fetch('/api/dxf/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const blob = await response.blob();
      triggerDownload(blob, filename);
      return { success: true, mode: 'backend' };
    }
  } catch (err) {
    console.warn('Backend DXF export failed, switching to client-side exporter:', err);
  }

  // Fallback: Generate DXF in browser using the same algorithm
  try {
    const dxfString = generateDxf(payload);
    const blob = new Blob([dxfString], { type: 'application/dxf;charset=utf-8' });
    triggerDownload(blob, filename);
    return { success: true, mode: 'client-offline' };
  } catch (clientErr) {
    console.error('Client-side DXF export failed:', clientErr);
    throw clientErr;
  }
}

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}
