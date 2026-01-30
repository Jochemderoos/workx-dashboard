// Development helper to bypass authentication
// This creates a fake user session for local development

export const DEV_USER = {
  id: 'cml0qgqo30000wnsgvhetzudq',
  email: 'admin@workxadvocaten.nl',
  name: 'Admin Workx',
  role: 'ADMIN'
}

export async function getDevSession() {
  return {
    user: DEV_USER
  }
}
