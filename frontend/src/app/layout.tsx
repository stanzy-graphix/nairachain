import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'NairaChain — Nigeria\'s P2P Crypto Exchange',
  description: 'Buy & sell Bitcoin, USDT, Ethereum for Naira. Escrow-protected P2P trading.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#161D2E', color: '#E8EDF5', border: '1px solid #1E2D47', fontFamily: 'DM Mono, monospace', fontSize: '13px' },
          success: { iconTheme: { primary: '#00D4AA', secondary: '#000' } },
          error: { iconTheme: { primary: '#FF4D6D', secondary: '#fff' } },
        }} />
        {children}
      </body>
    </html>
  )
}
