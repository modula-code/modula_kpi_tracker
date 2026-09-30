import type { LucideIcon } from "lucide-react"
import {
  BadgeCheckIcon,
  ClipboardCheckIcon,
  DatabaseIcon,
  HandshakeIcon,
  LayersIcon,
  LayoutDashboardIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"

import type { Role } from "@/lib/data/types"

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  badge?: string
  roles?: Role[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
      { title: "Designer Scorecard", url: "/scorecard", icon: BadgeCheckIcon },
    ],
  },
  {
    label: "Modules",
    items: [
      { title: "Sales & Conversion", url: "/modules/sales", icon: LayersIcon, badge: "40%" },
      {
        title: "Execution & Accuracy",
        url: "/modules/execution",
        icon: ClipboardCheckIcon,
        badge: "35%",
      },
      {
        title: "Referrals & Advocacy",
        url: "/modules/referrals",
        icon: HandshakeIcon,
        badge: "15%",
      },
      {
        title: "Architect Referrals",
        url: "/modules/circle",
        icon: SparklesIcon,
        badge: "10%",
      },
    ],
  },
  {
    label: "Rollups",
    items: [
      {
        title: "EC Rollup",
        url: "/rollup/ec",
        icon: UsersIcon,
        roles: ["manager", "head"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Target Setting",
        url: "/admin/targets",
        icon: SlidersHorizontalIcon,
        roles: ["manager", "head"],
      },
      {
        title: "Data Entry",
        url: "/admin/data",
        icon: DatabaseIcon,
        roles: ["head"],
      },
    ],
  },
]

export function navigationForRole(role: Role) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length)
}

export function titleForPath(pathname: string) {
  return (
    NAV_GROUPS.flatMap((group) => group.items).find((item) => item.url === pathname)?.title ??
    "Dashboard"
  )
}
