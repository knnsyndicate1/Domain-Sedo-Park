import { Inter } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Domain Register + Sedo Listing',
  description: 'Automate domain registration and Sedo listing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AntdRegistry>
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </AntdRegistry>
      </body>
    </html>
  )
} 