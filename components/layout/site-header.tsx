"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { MoonIcon, SunIcon, UserCogIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { CommandPalette } from "@/components/layout/command-palette"
import { NotificationsMenu } from "@/components/layout/notifications-menu"
import { titleForPath } from "@/components/layout/navigation"
import { ROLES, type Role } from "@/lib/data/types"

export function SiteHeader() {
  const pathname = usePathname()
  const { viewer, setRole, setSeat, queries: { designers: DESIGNERS, managers } } = useDashboard()
  const role = ROLES.find((item) => item.id === viewer.role)!
  const title = titleForPath(pathname)

  return (
    <header className="bg-background/95 sticky top-0 z-40 flex h-12 shrink-0 items-center border-b backdrop-blur">
      <div className="flex w-full min-w-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {pathname !== "/" && (
              <>
                <BreadcrumbItem className="hidden sm:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link href="/">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:list-item" />
              </>
            )}
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate font-medium">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CommandPalette />
          <NotificationsMenu />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label={`View as ${role.label}`}
              >
                <UserCogIcon />
                <span className="hidden lg:inline">{role.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <span className="block">View as</span>
                <span className="text-muted-foreground mt-1 block text-xs font-normal">
                  {role.scope}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={viewer.role}
                onValueChange={(value) => setRole(value as Role)}
              >
                {ROLES.map((item) => (
                  <DropdownMenuRadioItem key={item.id} value={item.id}>
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      <span className="text-muted-foreground text-xs">{item.scope}</span>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>

              {viewer.role === "designer" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Seat</DropdownMenuLabel>
                  <div className="max-h-56 overflow-y-auto">
                    <DropdownMenuRadioGroup
                      value={viewer.designerId}
                      onValueChange={(value) => setSeat("designerId", value)}
                    >
                      {DESIGNERS.map((designer) => (
                        <DropdownMenuRadioItem key={designer.id} value={designer.id}>
                          {designer.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </div>
                </>
              )}

              {viewer.role === "manager" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Seat</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={viewer.managerId}
                    onValueChange={(value) => setSeat("managerId", value)}
                  >
                    {managers.map((manager) => (
                      <DropdownMenuRadioItem key={manager.id} value={manager.id}>
                        {manager.name}
                        <span className="text-muted-foreground ml-auto text-xs">
                          {manager.title}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark"

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="block dark:hidden" />
    </Button>
  )
}
