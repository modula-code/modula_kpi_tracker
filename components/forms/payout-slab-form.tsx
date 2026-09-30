"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { IndianRupeeIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardAction,
} from "@/components/ui/card"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import { useDashboard } from "@/components/dashboard/dashboard-provider"

const formSchema = z.object({
  ratePerConvertedReferral: z.coerce.number<number>().min(0, "Rate cannot be negative."),
  percentOfReferredOrderValue: z.coerce
    .number<number>()
    .min(0, "Percentage cannot be negative.")
    .max(100, "Percentage cannot exceed 100%."),
  minimumConversions: z.coerce
    .number<number>()
    .int("Use a whole number.")
    .min(0, "Minimum conversions cannot be negative."),
})

export function PayoutSlabForm() {
  const { slab, setSlab } = useDashboard()
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ratePerConvertedReferral: slab.ratePerConvertedReferral,
      percentOfReferredOrderValue: slab.percentOfReferredOrderValue,
      minimumConversions: slab.minimumConversions,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true)
    // Simulate API delay for loading state
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSlab(values)
    form.reset(values)
    setIsSaving(false)
    toast.success("Payout slab updated")
  }

  return (
    <Card>
      <CardHeader>
        <SectionCardTitle>Payout slab</SectionCardTitle>
        <CardDescription>
          Enter a rate or percentage to preview referral payouts. Changes apply to this session.
        </CardDescription>
        <CardAction>
          <IndianRupeeIcon className="text-muted-foreground size-4" />
        </CardAction>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="ratePerConvertedReferral"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate per converted referral (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={500}
                      disabled={isSaving}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Flat amount paid for each converted referral.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="percentOfReferredOrderValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>% of referred order value</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.25}
                      disabled={isSaving}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Share of the converted referral’s order value.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minimumConversions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum conversions to qualify</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      disabled={isSaving}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Conversions required before any payout is calculated.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <p className="text-muted-foreground max-w-52 text-xs leading-relaxed">
              Payout = (rate × converted) + (% × referred order value), paid only above the floor.
            </p>
            <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
              {isSaving ? (
                <>
                <LoaderCircleIcon className="animate-spin" />
                  Saving
                </>
              ) : (
                "Apply slab"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
