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
        "border-2 border-[#0d9668] bg-white outline-none",
        "transition-colors",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        // Focus ring
        "focus-visible:ring-2 focus-visible:ring-[#0d9668]/40 focus-visible:ring-offset-1",
        // Checked — solid green fill
        "data-checked:bg-[#0d9668] data-checked:border-[#0d9668]",
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
