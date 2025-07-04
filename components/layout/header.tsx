"use client"

import * as React from "react"
import { User } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "../ui/theme-toggle"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "../ui/button"
import Image from "next/image"
import light_logo from "@/public/light_logo.png"
import dark_logo from "@/public/dark_logo.png"

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleProfileClick = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      router.push(`/account`)
    } else {
      router.push('/auth/login')
    }
  }

  return (
    <header className="bg-background border-b px-10">
      <div className="container mx-auto py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl">
            <Image src={light_logo} alt="logo" className="dark:block hidden h-20" width={100} height={100} />  {/* //show in dark mode */}
            <Image src={dark_logo} alt="logo" className="block dark:hidden h-20" width={100} height={100} />  {/* //show in light mode */}
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              href="/collections" 
              className={`text-sm ${pathname.startsWith('/collections') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Collections
            </Link>
            <Link 
              href="/watermarks" 
              className={`text-sm ${pathname.startsWith('/watermarks') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Watermarks
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button className="flex items-center justify-center rounded-full w-9 h-9 border" onClick={() => handleProfileClick()}>
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}