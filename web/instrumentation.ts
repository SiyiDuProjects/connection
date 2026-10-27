export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startContactsMaintenance } = await import('./lib/contacts/runtime');
    startContactsMaintenance();
  }
}
