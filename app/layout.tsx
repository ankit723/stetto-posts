import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from "@/providers/theme-provider";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Stetto Posts - Easy Photo Watermarking Tool',
  description: 'Protect your digital images with Stetto Posts. Add customizable text and image watermarks to your photos quickly and securely.',
  keywords: ['photo watermark', 'image protection', 'watermarking tool', 'copyright protection', 'digital watermark'],
  authors: [{ name: 'Stetto Posts Team' }],
  creator: 'Stetto Posts',
  publisher: 'Stetto Posts',
  openGraph: {
    title: 'Stetto Posts - Easy Photo Watermarking Tool',
    description: 'Protect your digital images with Stetto Posts. Add customizable text and image watermarks to your photos quickly and securely.',
    url: 'https://stettoposts.com',
    siteName: 'Stetto Posts',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Stetto Posts - Protect Your Digital Images',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stetto Posts - Easy Photo Watermarking Tool',
    description: 'Protect your digital images with Stetto Posts. Add customizable text and image watermarks to your photos quickly and securely.',
    images: ['/twitter-image.jpg'],
  },
  metadataBase: new URL('https://stettoposts.com'),
}

// JSON-LD structured data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Stetto Posts',
  description: 'Protect your digital images with Stetto Posts. Add customizable text and image watermarks to your photos quickly and securely.',
  applicationCategory: 'Photography',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  screenshot: '/app-screenshot.jpg',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
        >
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1 container mx-auto max-w-7xl">
                {children}
                <Toaster />
              </main>
              <Footer />
            </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
