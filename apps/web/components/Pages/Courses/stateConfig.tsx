import { CheckCircle, LockIcon, Rocket, ArrowRight } from 'lucide-react'
import React from 'react'
import { Badge } from '@/components/ui/badge'

export const stateConfig = {
  available: {
    icon: <Rocket size={18} className="text-primary" />,
    badge: (
      <Badge
        variant="outline"
        className="bg-primary/10 text-primary border-primary/20"
      >
        Available
      </Badge>
    ),
    buttonText: 'Start',
    mobileButtonText: 'Start',
    buttonVariant: 'default' as const,
    buttonIcon: <ArrowRight size={16} className="ml-2" />,
    borderColor: 'rgb(37, 99, 235)',
  },
  locked: {
    icon: <LockIcon size={18} className="text-muted-foreground" />,
    badge: (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        Locked
      </Badge>
    ),
    buttonText: 'Locked',
    mobileButtonText: 'Locked',
    buttonVariant: 'outline' as const,
    buttonIcon: <LockIcon size={16} className="ml-2" />,
    borderColor: 'rgb(229, 231, 235)',
  },
  done: {
    icon: <CheckCircle size={18} className="text-green-600" />,
    badge: (
      <Badge
        variant="outline"
        className="bg-green-100 text-green-700 border-green-200"
      >
        Completed
      </Badge>
    ),
    buttonText: 'Review',
    mobileButtonText: 'Review',
    buttonVariant: 'secondary' as const,
    buttonIcon: <ArrowRight size={16} className="ml-2" />,
    borderColor: 'rgb(22, 163, 74)',
  },
}
