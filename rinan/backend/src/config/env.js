import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 4001),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  liffChannelId: required('LIFF_CHANNEL_ID'),

  adminPassword: required('ADMIN_PASSWORD'),
  adminJwtSecret: required('ADMIN_JWT_SECRET'),

  visitDeviceSecret: required('VISIT_DEVICE_SECRET'),
};
