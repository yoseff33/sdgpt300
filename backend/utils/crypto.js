import crypto from 'node:crypto';
const key=()=>Buffer.from(process.env.NATIONAL_ID_ENCRYPTION_KEY||'','base64');
export function encryptNationalId(value){ if(!value)return null; if(key().length!==32)throw new Error('NATIONAL_ID_ENCRYPTION_KEY يجب أن يكون مفتاح base64 بطول 32 بايت'); const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv),body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]); return [iv,cipher.getAuthTag(),body].map(x=>x.toString('base64url')).join('.'); }
