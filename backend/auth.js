const { createClient } = require('@supabase/supabase-js');

function registerAuth(app, config, supabase) {
  app.post('/api/auth/login', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || password.length > 1024) {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }
    try {
      // Keep password sessions separate from the privileged database client.
      const authClient = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await authClient.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session || data.user?.app_metadata?.role !== 'teacher') {
        return res.status(401).json({ error: 'Incorrect email or password, or this account is not a teacher.' });
      }
      return res.json({ accessToken: data.session.access_token, email: data.user.email });
    } catch {
      return res.status(503).json({ error: 'Sign-in is unavailable. Please try again.' });
    }
  });

  app.use('/api', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
      if (data.user.app_metadata?.role !== 'teacher') return res.status(403).json({ error: 'Teacher access is required.' });
      next();
    } catch {
      return res.status(503).json({ error: 'Unable to verify your session. Please try again.' });
    }
  });
}

module.exports = { registerAuth };
