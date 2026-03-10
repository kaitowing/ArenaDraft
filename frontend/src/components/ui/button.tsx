import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon)] focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--lagoon-deep)] text-white shadow hover:bg-[var(--lagoon)] active:scale-95',
        destructive: 'bg-red-500 text-white shadow hover:bg-red-600 active:scale-95',
        outline:
          'border border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink)] hover:bg-[var(--surface-strong)] active:scale-95',
        secondary:
          'bg-[var(--sand)] text-[var(--sea-ink)] hover:bg-[var(--foam)] active:scale-95',
        ghost:
          'text-[var(--sea-ink)] hover:bg-[var(--surface-strong)] active:scale-95',
        link: 'text-[var(--lagoon-deep)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-6 text-base',
        xl: 'h-16 rounded-2xl px-8 text-xl font-bold',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
