import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'NairaChain — Nigeria\'s P2P Crypto Exchange',
  description: 'Buy & sell Bitcoin, USDT, Ethereum for Naira. Escrow-protected P2P trading.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
