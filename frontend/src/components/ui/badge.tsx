import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--lagoon-deep)] text-white',
        secondary: 'border-transparent bg-[var(--sand)] text-[var(--sea-ink)]',
        destructive: 'border-transparent bg-red-500 text-white',
        outline: 'border-[var(--line)] text-[var(--sea-ink)]',
        success: 'border-transparent bg-[var(--palm)] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
