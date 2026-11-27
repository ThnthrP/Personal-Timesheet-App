import { defineConfig } from 'vitest/config';

// ทดสอบเฉพาะ logic ใน lib/ (ฟังก์ชันล้วน ไม่ต้องใช้เบราว์เซอร์)
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
