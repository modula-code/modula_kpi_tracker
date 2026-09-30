"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { navigationForRole } from "@/components/layout/navigation"

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { viewer } = useDashboard()
  const groups = navigationForRole(viewer.role)

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  function navigate(url: string) {
    setOpen(false)
    router.push(url)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
      >
        <SearchIcon />
        <span className="hidden md:inline">Search</span>
        <kbd className="text-muted-foreground hidden font-mono text-xs lg:inline">⌘K</kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Dashboard navigation"
        description="Search the screens available to your role."
        className="rounded-2xl! sm:max-w-lg"
      >
        <Command loop>
          <CommandInput placeholder="Search screens…" autoFocus />
          <CommandList>
            <CommandEmpty>No matching screen.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem key={item.url} value={item.title} onSelect={() => navigate(item.url)}>
                      <Icon />
                      <span>{item.title}</span>
                      {item.badge && (
                        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
