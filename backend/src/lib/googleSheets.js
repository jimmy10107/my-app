import { google } from 'googleapis';
import { env } from '../config/env.js';

function authClient() {
  return new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export function getSheetsApi() {
  return google.sheets({ version: 'v4', auth: authClient() });
}
