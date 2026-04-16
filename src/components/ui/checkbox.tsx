"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Base
        "peer relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm",
        "border-2 border-[var(--brand-600)] bg-white outline-none",
        "transition-colors",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        // Focus ring
        "focus-visible:ring-2 focus-visible:ring-[var(--brand-600)]/40 focus-visible:ring-offset-1",
        // Checked — solid green fill
        "data-checked:bg-[var(--brand-600)] data-checked:border-[var(--brand-600)]",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <CheckIcon
          className="size-3 stroke-3 text-white"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
