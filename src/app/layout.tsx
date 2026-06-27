import type {Metadata} from 'next';
import '@/lib/sanitize-node-localstorage';
import './globals.css';
import { AuthProvider } from '@/providers/auth-provider';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'EQPMGRshop Central',
  description: 'Shop management for the modern era.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head />
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
