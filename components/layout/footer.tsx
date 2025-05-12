export default function Footer() {
  return (
    <footer className="py-6 px-6 mt-auto border-t bg-background">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Stetto Posts. All rights reserved.
        </p>
        <div className="flex gap-6">
          <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
            Terms
          </a>
          <a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
            Privacy
          </a>
          <a href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}