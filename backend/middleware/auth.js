import { admin } from '../utils/supabase.js';
export async function auth(req,res,next){
 try { const token=req.headers.authorization?.replace(/^Bearer\s+/i,''); if(!token) return res.status(401).json({error:'يلزم تسجيل الدخول'}); const {data:{user},error}=await admin.auth.getUser(token); if(error||!user) return res.status(401).json({error:'جلسة غير صالحة'}); const {data:profile}=await admin.from('profiles').select('*').eq('id',user.id).single(); req.user={...user,role:profile?.role||'buyer',profile}; req.token=token; next(); } catch(e){ next(e); }
}
export function optionalAuth(req,res,next){ return req.headers.authorization?auth(req,res,next):next(); }
