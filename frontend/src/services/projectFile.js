// A design file is the sheets, the pieces on them, and the custom symbols they use.

import { getStoredCustomSymbols, hiddenLibraryTypes, replaceHiddenLibraryTypes, saveCustomSymbol } from '../cad/symbolStore';

export const PROJECT_FILE_FORMAT = 'dragno-electric-project';
const PROJECT_STORAGE_KEY = 'dragno_project_v1';

export function buildProjectFile(project, activeSheetId, symbols = {}) {
  return {
    format: PROJECT_FILE_FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    activeSheetId,
    project: {
      id: project.id,
      name: project.name,
      company: project.company,
      designer: project.designer,
      sheets: project.sheets || []
    },
    symbols,
    libraryHidden: hiddenLibraryTypes()
  };
}

export function parseProjectFile(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('El archivo está vacío.');
  }
  const source = data.format === PROJECT_FILE_FORMAT ? data.project : (Array.isArray(data.sheets) ? data : null);
  if (!source || !Array.isArray(source.sheets) || source.sheets.length === 0) {
    throw new Error('Ese archivo no es un plano de Dragno Electric.');
  }
  const sheets = source.sheets.map(sheet => ({
    ...sheet,
    components: Array.isArray(sheet.components) ? sheet.components : [],
    wires: Array.isArray(sheet.wires) ? sheet.wires : []
  }));
  const project = { ...source, sheets };
  const activeSheetId = sheets.some(sheet => sheet.id === data.activeSheetId)
    ? data.activeSheetId
    : sheets[0].id;
  const symbols = data.symbols && typeof data.symbols === 'object' ? data.symbols : {};
  const libraryHidden = Array.isArray(data.libraryHidden) ? data.libraryHidden : null;
  return { project, activeSheetId, symbols, libraryHidden };
}

export function installProjectSymbols(symbols) {
  Object.values(symbols || {}).forEach(def => {
    if (def && def.type) saveCustomSymbol(def);
  });
}

export function installLibraryHidden(list) {
  if (!Array.isArray(list)) return;
  replaceHiddenLibraryTypes(list);
}

export function recallProject() {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return null;
    return parseProjectFile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function rememberProject(project, activeSheetId) {
  const file = buildProjectFile(project, activeSheetId, getStoredCustomSymbols());
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(file));
  return file;
}

function fileNameFor(project) {
  const base = String(project?.name || 'plano')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .trim()
    .replace(/\s+/g, '_') || 'plano';
  return `${base}.dragno.json`;
}

export function downloadProjectFile(project, activeSheetId) {
  const file = rememberProject(project, activeSheetId);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const filename = fileNameFor(project);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export async function readProjectFile(file) {
  const text = await file.text();
  return parseProjectFile(JSON.parse(text));
}
