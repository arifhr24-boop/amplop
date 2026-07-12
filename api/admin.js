const { createClient } = require('@supabase/supabase-js');

/* Sama dengan SUPABASE_URL di login.html — ini nilai publik, aman ditaruh di kode. */
const SUPABASE_URL = 'https://pmnfsvkthvlvlidhlmes.supabase.co';
const SITE_URL = process.env.SITE_URL || 'https://www.amplop.online/login.html';

/* Daftar email yang boleh memakai endpoint ini. */
const ADMIN_EMAILS = ['arifhr24@gmail.com'];

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur di environment variables Vercel');
  return createClient(SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let admin;
  try { admin = adminClient(); }
  catch (e) { res.status(500).json({ error: e.message }); return; }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) { res.status(401).json({ error: 'Tidak ada token' }); return; }

  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) { res.status(401).json({ error: 'Token tidak valid' }); return; }
  const callerEmail = (callerData.user.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(callerEmail)) { res.status(403).json({ error: 'Akun ini bukan admin' }); return; }

  const body = req.body || {};
  const action = body.action;
  const payload = body.payload || {};

  try {
    if (action === 'list') {
      const { data: usersRes, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw listErr;
      const { data: licenses, error: licErr } = await admin.from('licenses').select('*');
      if (licErr) throw licErr;
      const licMap = new Map((licenses || []).map(l => [l.email.toLowerCase(), l]));
      const users = usersRes.users
        .map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          confirmed_at: u.email_confirmed_at || null,
          last_sign_in_at: u.last_sign_in_at || null,
          licensed: licMap.has((u.email || '').toLowerCase()),
          note: licMap.get((u.email || '').toLowerCase())?.note || ''
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      res.status(200).json({ users });
      return;
    }

    if (action === 'updateEmail') {
      const { id, email } = payload;
      if (!id || !email || !email.includes('@')) throw new Error('id dan email valid wajib diisi');
      const { error } = await admin.auth.admin.updateUserById(id, { email });
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'updatePassword') {
      const { id, password } = payload;
      if (!id || !password || password.length < 6) throw new Error('Password minimal 6 karakter');
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'sendReset') {
      const { email } = payload;
      if (!email) throw new Error('Email wajib diisi');
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'delete') {
      const { id } = payload;
      if (!id) throw new Error('id wajib diisi');
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Aksi tidak dikenali' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Terjadi kesalahan' });
  }
};
