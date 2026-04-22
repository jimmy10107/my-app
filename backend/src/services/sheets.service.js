import { getSheetsApi } from '../lib/googleSheets.js';
import { env } from '../config/env.js';
import { SCHEMA, SHEETS } from '../config/sheetSchema.js';

function toCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fromCell(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

export class SheetsRepository {
  constructor() {
    this.api = getSheetsApi();
  }

  async ensureSheetHeaders(sheetName, headers) {
    const range = `${sheetName}!1:1`;
    const current = await this.api.spreadsheets.values.get({ spreadsheetId: env.spreadsheetId, range });
    const currentHeaders = current.data.values?.[0] || [];
    if (JSON.stringify(currentHeaders) === JSON.stringify(headers)) return;
    await this.api.spreadsheets.values.update({
      spreadsheetId: env.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  async setupWorkbook() {
    const requests = Object.values(SHEETS).map((title) => ({ addSheet: { properties: { title } } }));
    try {
      await this.api.spreadsheets.batchUpdate({
        spreadsheetId: env.spreadsheetId,
        requestBody: { requests },
      });
    } catch (error) {
      if (!String(error.message).includes('already exists')) {
        // ignore only duplicate sheet errors
      }
    }
    for (const [sheetName, headers] of Object.entries(SCHEMA)) {
      await this.ensureSheetHeaders(sheetName, headers);
    }
  }

  async readAll(sheetName) {
    const headers = SCHEMA[sheetName];
    const range = `${sheetName}!A2:ZZ`;
    const response = await this.api.spreadsheets.values.get({ spreadsheetId: env.spreadsheetId, range });
    const rows = response.data.values || [];
    return rows.map((row) => Object.fromEntries(headers.map((header, idx) => [header, fromCell(row[idx] ?? '')])));
  }

  async insert(sheetName, record) {
    const headers = SCHEMA[sheetName];
    const row = headers.map((header) => toCell(record[header]));
    await this.api.spreadsheets.values.append({
      spreadsheetId: env.spreadsheetId,
      range: `${sheetName}!A:ZZ`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    return record;
  }

  async findOne(sheetName, predicate) {
    const rows = await this.readAll(sheetName);
    return rows.find(predicate) || null;
  }

  async findMany(sheetName, predicate) {
    const rows = await this.readAll(sheetName);
    return rows.filter(predicate);
  }

  async updateWhere(sheetName, predicate, updater) {
    const headers = SCHEMA[sheetName];
    const rows = await this.readAll(sheetName);
    const updatedRows = rows.map((record) => (predicate(record) ? updater({ ...record }) : record));
    const values = [headers, ...updatedRows.map((record) => headers.map((header) => toCell(record[header])))];
    await this.api.spreadsheets.values.update({
      spreadsheetId: env.spreadsheetId,
      range: `${sheetName}!A1:ZZ`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
    return updatedRows;
  }
}

export const sheetsRepo = new SheetsRepository();
