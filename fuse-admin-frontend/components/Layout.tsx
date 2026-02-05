import { ReactNode } from 'react'
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  )
}