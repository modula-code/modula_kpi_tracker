"use client"

import * as React from "react"
import { useActionState } from "react"
import { InboxIcon, LoaderCircleIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  addAuditTicket,
  addCircleMember,
  addManager,
  assignEcManager,
  deleteAdminRecord,
  type AdminFormState,
} from "@/app/actions/admin-data"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/layout/page-header"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { formatCurrency, formatDate } from "@/lib/format"
import { ECS } from "@/lib/data/seed"
import { ERROR_TYPES, TICKET_STAGES, type AdminData } from "@/lib/data/types"

const TABS = ["managers", "tickets", "circle"] as const
const today = () => new Date().toISOString().slice(0, 10)
const ecName = (id: string) => ECS.find((ec) => ec.id === id)?.name ?? "—"

/** Superadmin entry for everything Odoo doesn't supply. */
export function DataEntry({ data, tab }: { data: AdminData; tab?: string }) {
  const { queries } = useDashboard()
  const designerName = (id: string) => queries.designerById(id)?.name ?? id

  return (
    <>
      <PageHeader
        title="Data Entry"
        description="Add the records Odoo doesn't hold: managers and which Experience Centres they own, audit tickets for Execution & Accuracy, and Circle partners for Architect Referrals. Changes apply to every dashboard immediately."
      />

      <Tabs
        defaultValue={TABS.includes(tab as (typeof TABS)[number]) ? tab : "managers"}
        className="px-4 lg:px-6"
      >
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="managers">Managers & ECs</TabsTrigger>
          <TabsTrigger value="tickets">
            Audit tickets <Badge variant="secondary">{data.auditTickets.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="circle">
            Circle partners <Badge variant="secondary">{data.circleMembers.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="managers" className="mt-4 grid gap-4 xl:grid-cols-2">
          <ManagersCard data={data} />
          <EcMappingCard data={data} />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <Card>
            <CardHeader>
              <SectionCardTitle>Audit tickets</SectionCardTitle>
              <CardDescription>Feeds FTR, error frequency and cycle time on Execution & Accuracy.</CardDescription>
              <CardAction>
                <AddDialog title="Add audit ticket" action={addAuditTicket} wide>
                  <TicketFields />
                </AddDialog>
              </CardAction>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.auditTickets.length ? (
                <Table className="min-w-[56rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Designer</TableHead>
                      <TableHead>EC</TableHead>
                      <TableHead>Raised</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...data.auditTickets].reverse().map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.projectName}</TableCell>
                        <TableCell>{designerName(t.designerId)}</TableCell>
                        <TableCell className="max-w-48 truncate">{ecName(t.ecId)}</TableCell>
                        <TableCell>{formatDate(t.createdOn)}</TableCell>
                        <TableCell><Badge variant="outline">{t.stage}</Badge></TableCell>
                        <TableCell>
                          {t.outcome ? (
                            <Badge variant={t.outcome === "Pass" ? "secondary" : "destructive"}>{t.outcome}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="max-w-56 truncate">{t.errors.join(", ") || "—"}</TableCell>
                        <TableCell><DeleteButton kind="auditTickets" id={t.id} label={t.projectName} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <NoRows title="No audit tickets yet" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="circle" className="mt-4">
          <Card>
            <CardHeader>
              <SectionCardTitle>Circle partners</SectionCardTitle>
              <CardDescription>Architects and partners onboarded by a designer. Feeds Architect Referrals.</CardDescription>
              <CardAction>
                <AddDialog title="Add Circle partner" action={addCircleMember} wide>
                  <CircleFields />
                </AddDialog>
              </CardAction>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.circleMembers.length ? (
                <Table className="min-w-[52rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead>Onboarded by</TableHead>
                      <TableHead>EC</TableHead>
                      <TableHead>Onboarded</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...data.circleMembers].reverse().map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell>{m.segment}</TableCell>
                        <TableCell>{designerName(m.onboardedBy)}</TableCell>
                        <TableCell className="max-w-48 truncate">{ecName(m.ecId)}</TableCell>
                        <TableCell>{formatDate(m.onboardedOn)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(m.revenue)}</TableCell>
                        <TableCell>
                          <Badge variant={m.status === "Active" ? "secondary" : "outline"}>{m.status}</Badge>
                        </TableCell>
                        <TableCell><DeleteButton kind="circleMembers" id={m.id} label={m.name} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <NoRows title="No Circle partners yet" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}

// --- Managers -------------------------------------------------------------------

function ManagersCard({ data }: { data: AdminData }) {
  return (
    <Card>
      <CardHeader>
        <SectionCardTitle>Managers / ASMs</SectionCardTitle>
        <CardDescription>People who can be assigned Experience Centres.</CardDescription>
        <CardAction>
          <AddDialog title="Add manager" action={addManager}>
            <Field label="Name"><Input name="name" required autoComplete="off" /></Field>
            <Field label="Title">
              <Choice name="title" options={["ASM", "EC Manager"]} defaultValue="ASM" />
            </Field>
          </AddDialog>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.managers.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">ECs</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.managers.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.title}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Object.values(data.ecManagers).filter((id) => id === m.id).length}
                  </TableCell>
                  <TableCell><DeleteButton kind="managers" id={m.id} label={m.name} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoRows title="No managers yet" />
        )}
      </CardContent>
    </Card>
  )
}

function EcMappingCard({ data }: { data: AdminData }) {
  const [pending, startTransition] = React.useTransition()

  function assign(ecId: string, managerId: string) {
    startTransition(async () => {
      const result = await assignEcManager(ecId, managerId === "none" ? "" : managerId)
      if (result.error) toast.error(result.error)
      else toast.success(`${ecName(ecId)} updated`)
    })
  }

  return (
    <Card aria-busy={pending}>
      <CardHeader>
        <SectionCardTitle>Experience Centre owners</SectionCardTitle>
        <CardDescription>Drives the EC rollup and what a manager sees in their seat.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Experience Centre</TableHead>
              <TableHead className="w-56">Manager</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ECS.map((ec) => (
              <TableRow key={ec.id}>
                <TableCell>
                  <div className="max-w-64 truncate font-medium">{ec.name}</div>
                  <div className="text-muted-foreground text-xs">{ec.city}</div>
                </TableCell>
                <TableCell>
                  <Select
                    value={data.ecManagers[ec.id] ?? "none"}
                    onValueChange={(value) => assign(ec.id, value)}
                    disabled={pending || !data.managers.length}
                  >
                    <SelectTrigger className="w-full" aria-label={`Manager for ${ec.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {data.managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// --- Form bodies ----------------------------------------------------------------

function TicketFields() {
  const [outcome, setOutcome] = React.useState("")
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Project" wide><Input name="projectName" required autoComplete="off" /></Field>
      <DesignerField name="designerId" />
      <EcField />
      <Field label="Raised on"><Input type="date" name="createdOn" defaultValue={today()} required /></Field>
      <Field label="Audit slot"><Input type="datetime-local" name="scheduledFor" required /></Field>
      <Field label="Stage"><Choice name="stage" options={TICKET_STAGES} defaultValue="Created" /></Field>
      <Field label="Audited on"><Input type="date" name="auditedOn" /></Field>
      <Field label="Outcome">
        <Select value={outcome || "pending"} onValueChange={(v) => setOutcome(v === "pending" ? "" : v)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Not audited yet</SelectItem>
            <SelectItem value="Pass">Pass</SelectItem>
            <SelectItem value="Fail">Fail</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="outcome" value={outcome} />
      </Field>
      <Field label="Auditor"><Input name="auditor" required autoComplete="off" /></Field>
      <Field label="Cycle time (days, QL → presentation)">
        <Input type="number" name="cycleDays" min={0} step={1} defaultValue={0} required />
      </Field>
      {outcome === "Fail" && (
        <fieldset className="grid gap-2 sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Errors found</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ERROR_TYPES.map((type) => (
              <Label key={type} className="font-normal">
                <Checkbox name="errors" value={type} /> {type}
              </Label>
            ))}
          </div>
        </fieldset>
      )}
      <Field label="Notes" wide><Textarea name="notes" rows={3} /></Field>
    </div>
  )
}

function CircleFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Partner name" wide><Input name="name" required autoComplete="off" /></Field>
      <Field label="Segment">
        <Choice name="segment" options={["Architect", "Contractor", "Interior Studio", "Channel Partner"]} defaultValue="Architect" />
      </Field>
      <Field label="Status"><Choice name="status" options={["Active", "Dormant"]} defaultValue="Active" /></Field>
      <DesignerField name="onboardedBy" label="Onboarded by" />
      <EcField />
      <Field label="Onboarded on"><Input type="date" name="onboardedOn" defaultValue={today()} required /></Field>
      <Field label="Revenue (₹)"><Input type="number" name="revenue" min={0} step="any" defaultValue={0} required /></Field>
      <Field label="Unique bookings"><Input type="number" name="uniqueBookings" min={0} step={1} defaultValue={0} required /></Field>
      <Field label="Active referrals"><Input type="number" name="activeReferrals" min={0} step={1} defaultValue={0} required /></Field>
    </div>
  )
}

function DesignerField({ name, label = "Designer" }: { name: string; label?: string }) {
  const { queries } = useDashboard()
  // Odoo down → no directory to pick from, so fall back to typing the name.
  if (!queries.designers.length) {
    return <Field label={label}><Input name={name} required autoComplete="off" /></Field>
  }
  return (
    <Field label={label}>
      <Select name={name} required>
        <SelectTrigger className="w-full"><SelectValue placeholder="Select designer" /></SelectTrigger>
        <SelectContent>
          {queries.designers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  )
}

function EcField() {
  return (
    <Field label="Experience Centre">
      <Select name="ecId" required>
        <SelectTrigger className="w-full"><SelectValue placeholder="Select EC" /></SelectTrigger>
        <SelectContent>
          {ECS.map((ec) => <SelectItem key={ec.id} value={ec.id}>{ec.name} · {ec.city}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  )
}

// --- Shared bits ----------------------------------------------------------------

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <Label className={`grid gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <span>{label}</span>
      {children}
    </Label>
  )
}

function Choice({ name, options, defaultValue }: { name: string; options: readonly string[]; defaultValue: string }) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function AddDialog({
  title,
  action,
  wide,
  children,
}: {
  title: string
  action: (prev: AdminFormState, formData: FormData) => Promise<AdminFormState>
  wide?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData)
    if (result.ok) {
      setOpen(false)
      toast.success(`${title.replace(/^Add /, "")} saved`)
    }
    return result
  }, {})

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><PlusIcon /> {title}</Button>
      </DialogTrigger>
      <DialogContent className={wide ? "max-h-[90vh] overflow-y-auto sm:max-w-2xl" : undefined}>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>All fields except notes and audit date are required.</DialogDescription>
          </DialogHeader>
          {state.error && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {children}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteButton({ kind, id, label }: { kind: "managers" | "auditTickets" | "circleMembers"; id: string; label: string }) {
  const [pending, startTransition] = React.useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${label}`} disabled={pending}>
          <Trash2Icon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>This removes it from every dashboard and can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              startTransition(async () => {
                const result = await deleteAdminRecord(kind, id)
                if (result.error) toast.error(result.error)
                else toast.success(`${label} deleted`)
              })
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function NoRows({ title }: { title: string }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>Use the Add button above to create the first one.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
