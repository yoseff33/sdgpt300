import { admin } from '../utils/supabase.js';

export async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(
      /^Bearer\s+/i,
      ''
    );

    if (!token) {
      return res.status(401).json({
        error: 'يلزم تسجيل الدخول'
      });
    }

    const {
      data: { user },
      error
    } = await admin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'جلسة غير صالحة'
      });
    }

    const {
      data: profile,
      error: profileError
    } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        error: 'ملف الحساب غير موجود'
      });
    }

    if (profile.account_status === 'banned') {
      return res.status(403).json({
        error: 'الحساب محظور',
        reason: profile.suspension_reason
      });
    }

    if (profile.account_status === 'suspended') {
      const suspensionExpired =
        profile.suspended_until &&
        new Date(profile.suspended_until) <= new Date();

      if (!suspensionExpired) {
        return res.status(403).json({
          error: 'الحساب معلّق مؤقتًا',
          reason: profile.suspension_reason,
          suspended_until: profile.suspended_until
        });
      }

      await admin
        .from('profiles')
        .update({
          account_status: 'active',
          suspension_reason: null,
          suspended_until: null
        })
        .eq('id', user.id);

      profile.account_status = 'active';
      profile.suspension_reason = null;
      profile.suspended_until = null;
    }

    req.user = {
      ...user,
      role: profile.role || 'user',
      profile
    };

    req.token = token;

    return next();
  } catch (error) {
    return next(error);
  }
}

export function optionalAuth(req, res, next) {
  if (req.headers.authorization) {
    return auth(req, res, next);
  }

  return next();
}
