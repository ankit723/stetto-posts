"use client"

import * as React from "react"
import { User, Menu, X } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "../ui/theme-toggle"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "../ui/button"
import Image from "next/image"
import light_logo from "@/public/light_logo.png"
import dark_logo from "@/public/dark_logo.png"
import { useState } from "react"

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleProfileClick = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      router.push(`/account`)
    } else {
      router.push('/auth/login')
    }
  }

  const navLinks = [
    { href: "/collections", label: "Collections" },
    { href: "/watermarks", label: "Watermarks" }
  ]

  return (
    <header className="bg-background border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <Image 
                src={light_logo} 
                alt="Stetto Posts Logo" 
                className="dark:block hidden" 
                width={120} 
                height={40}
                priority
              />
              <Image 
                src={dark_logo} 
                alt="Stetto Posts Logo" 
                className="block dark:hidden" 
                width={120} 
                height={40}
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 ${
                  pathname.startsWith(link.href)
                    ? 'text-primary border-b-2 border-primary pb-1'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleProfileClick}
              className="flex items-center space-x-2 rounded-md"
            >
              <User className="h-4 w-4" />
              <span className="text-sm">Account</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    pathname.startsWith(link.href)
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleProfileClick()
                  setIsMobileMenuOpen(false)
                }}
                className="w-full justify-start px-3 py-2 text-sm font-medium"
              >
                <User className="h-4 w-4 mr-2" />
                Account
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}