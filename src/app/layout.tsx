import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Đại Nội Ký · Khởi một kiếp người', description: 'Chọn một con đường, viết một cuộc đời giữa chốn cung đình Đại Khánh.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
