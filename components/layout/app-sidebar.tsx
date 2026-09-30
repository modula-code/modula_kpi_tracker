"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/layout/nav-user";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { navigationForRole } from "@/components/layout/navigation";

export function AppSidebar({
  account,
  ...props
}: React.ComponentProps<typeof Sidebar> & { account?: string }) {
  const { queries: { designerById, managerById } } = useDashboard();
  const pathname = usePathname();
  const { viewer } = useDashboard();

  const seat =
    viewer.role === "designer"
      ? designerById(viewer.designerId)
      : viewer.role === "manager"
        ? managerById(viewer.managerId)
        : null;

  const role =
    viewer.role === "designer"
      ? "Designer"
      : viewer.role === "manager"
        ? (managerById(viewer.managerId)?.title ?? "EC Manager")
        : "Design Head · full access";

  const user = {
    name: seat?.name ?? account ?? "Admin",
    email: role,
    account: account ?? "",
    avatar: "",
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/">
                <img
                  src="/modula_jsw.svg"
                  alt="Modula JSW"
                  className="h-8 w-auto shrink-0"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navigationForRole(viewer.role).map(({ label, items }) => {
          return (
            <SidebarGroup key={label}>
              <SidebarGroupLabel>{label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={
                          item.url === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.url)
                        }
                      >
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.badge && (
                        <SidebarMenuBadge className="tabular-nums">
                          {item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
