"use client"

import * as React from "react"
import { useActionState } from "react"
import { CheckIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react"

import { saveTargets, type TargetsState } from "@/app/actions/targets"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/layout/page-header"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import { formatCurrency } from "@/lib/format"
import { annualBookingTarget, targetsFor, type TargetConfig } from "@/lib/data/sales-metrics"

/**
 * Monthly Sales & Conversion targets per designer. A blank cell inherits the
 * defaults row, so Ops only fills in the people who differ from the standard.
 */
export function TargetsForm({
  designers,
  targets,
  error,
}: {
  designers: string[]
  targets: TargetConfig
  error?: string
}) {
  const [state, formAction, pending] = useActionState<TargetsState, FormData>(saveTargets, {})

  return (
    <form action={formAction}>
      <input type="hidden" name="designers" value={designers.join("\n")} />

      <PageHeader
        title="Target Setting"
        description="Targets for the Sales & Conversion module. Set a monthly booking value, an annual one, or both — an annual target with no monthly figure spreads evenly over twelve months. Weeks pro-rate the monthly target; quarters, years, and all-time score as the average of their monthly scores."
        actions={
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            Save targets
          </Button>
        }
      />

      <div className="mt-4 space-y-4 px-4 lg:px-6">
        {error && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Designer list unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {state.error && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Not saved</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {state.ok && (
          <Alert>
            <CheckIcon />
            <AlertTitle>Targets saved</AlertTitle>
            <AlertDescription>
              The Sales &amp; Conversion module is scoring against these numbers now.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <SectionCardTitle>Default target · every designer</SectionCardTitle>
            <CardDescription>
              Applies to anyone without a target of their own — including designers added in Odoo
              later.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              id="defaults.booking"
              label="Booking value / month"
              hint={formatCurrency(targets.defaults.booking)}
              defaultValue={targets.defaults.booking}
            />
            <Field
              id="defaults.annualBooking"
              label="Booking value / year"
              hint={formatCurrency(targets.defaults.annualBooking ?? targets.defaults.booking * 12)}
              defaultValue={targets.defaults.annualBooking ?? targets.defaults.booking * 12}
            />
            <Field
              id="defaults.walkin"
              label="Walk-in conversion (%)"
              hint={`${targets.defaults.walkin}%`}
              defaultValue={targets.defaults.walkin}
              step="0.1"
            />
            <Field
              id="defaults.aov"
              label="AOV"
              hint={formatCurrency(targets.defaults.aov)}
              defaultValue={targets.defaults.aov}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionCardTitle>Per designer</SectionCardTitle>
            <CardDescription>
              {designers.length} designers from the Design POC field in Odoo. Blank cells inherit
              the default above.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[56rem]" aria-label="Per designer targets">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-48">Designer</TableHead>
                  <TableHead>Booking / month</TableHead>
                  <TableHead>Booking / year</TableHead>
                  <TableHead>Walk-in conversion (%)</TableHead>
                  <TableHead>AOV</TableHead>
                  <TableHead className="text-right">In effect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designers.map((name) => {
                  const own = targets.byDesigner[name] ?? {}
                  const effective = targetsFor(name, targets)
                  const annual = annualBookingTarget(name, targets)
                  return (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>
                        <Cell name={`designer.${name}.booking`} defaultValue={own.booking} />
                      </TableCell>
                      <TableCell>
                        <Cell
                          name={`designer.${name}.annualBooking`}
                          defaultValue={own.annualBooking}
                        />
                      </TableCell>
                      <TableCell>
                        <Cell
                          name={`designer.${name}.walkin`}
                          defaultValue={own.walkin}
                          step="0.1"
                        />
                      </TableCell>
                      <TableCell>
                        <Cell name={`designer.${name}.aov`} defaultValue={own.aov} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                        {formatCurrency(effective.booking)}/mo · {formatCurrency(annual)}/yr ·{" "}
                        {effective.walkin.toFixed(1)}% · {formatCurrency(effective.aov)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!designers.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                      No designers returned from Odoo.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  defaultValue,
  step = "1",
}: {
  id: string
  label: string
  hint: string
  defaultValue: number
  step?: string
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="number"
        min="0"
        step={step}
        defaultValue={defaultValue}
        className="tabular-nums"
      />
      <span className="text-muted-foreground text-xs">Currently {hint}</span>
    </div>
  )
}

function Cell({
  name,
  defaultValue,
  step = "1",
}: {
  name: string
  defaultValue?: number
  step?: string
}) {
  return (
    <Input
      name={name}
      type="number"
      min="0"
      step={step}
      defaultValue={defaultValue ?? ""}
      placeholder="default"
      aria-label={name}
      className="tabular-nums"
    />
  )
}
