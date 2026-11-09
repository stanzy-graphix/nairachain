import Link from 'next/link'
import { Card } from './ui'

/** Centered card layout shared by the auth pages. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="font-display font-black text-2xl">
            <span className="text-text">NAIRA</span><span className="text-accent">CHAIN</span>
          </Link>
        </div>
        <Card className="p-8 md:p-9">{children}</Card>
      </div>
    </div>
  )
}
