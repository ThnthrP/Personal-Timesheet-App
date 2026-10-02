import type { Metadata } from 'next';
import { Inter, Noto_Sans_Thai } from 'next/font/google';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import './globals.css';
import { Providers } from './providers';

// ปิดการ inject CSS อัตโนมัติของ FontAwesome (import styles.css ด้านบนแทน)
// ไม่อย่างนั้นไอคอนจะขึ้นขนาดใหญ่แวบหนึ่งตอนโหลดหน้า
config.autoAddCss = false;

// Inter = ฟอนต์เดียวกับ prototype, Noto Sans Thai = ใช้แสดงอักษรไทย (Inter ไม่มีอักษรไทย)
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const notoThai = Noto_Sans_Thai({ variable: '--font-noto-thai', subsets: ['thai'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Personal Timesheet App — Construction Timesheet Approval Workflow',
  description: 'Construction timesheet and payroll approval workflow',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
