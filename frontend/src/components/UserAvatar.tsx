import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { useProfileImage } from '#/features/auth/imageQueries'
import { getInitials, cn } from '#/lib/utils'

const SIZE_CLASS = {
  xs: 'h-7 w-7',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
  xl: 'h-16 w-16',
}

interface UserAvatarProps {
  uid: string
  displayName: string
  size?: keyof typeof SIZE_CLASS
  className?: string
}

export function UserAvatar({ uid, displayName, size = 'md', className }: UserAvatarProps) {
  const { data: base64 } = useProfileImage(uid)

  return (
    <Avatar className={cn(SIZE_CLASS[size], className)}>
      <AvatarImage src={base64 ?? undefined} alt={displayName} />
      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
    </Avatar>
  )
}
