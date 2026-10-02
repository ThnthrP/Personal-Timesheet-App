import axios from 'axios';

/**
 * แปลง error จาก API เป็นข้อความสำหรับผู้ใช้
 * NestJS คืน message เป็น string (เช่น 400/401/403) หรือ array (จาก ValidationPipe)
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Can't reach the server. Check your connection and try again.";
    const msg = (err.response.data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(msg) && msg.length > 0) return msg[0];
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}
