import { CheckCircle, LockIcon, Rocket, ArrowRight } from 'lucide-react'
import React from 'react'
import { Badge } from '@/components/ui/badge'

export function getStateConfig(t: (key: string) => string) {
  return {
    available: {
      icon: <Rocket size={18} className="text-primary" />,
      badge: (
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/20"
        >
          {t('available')}
        </Badge>
      ),
      buttonText: t('start'),
      mobileButtonText: t('start'),
      buttonVariant: 'default' as const,
      buttonIcon: <ArrowRight size={16} className="ml-2" />,
      borderColor: 'rgb(37, 99, 235)',
    },
    locked: {
      icon: <LockIcon size={18} className="text-muted-foreground" />,
      badge: (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          {t('locked')}
        </Badge>
      ),
      buttonText: t('locked'),
      mobileButtonText: t('locked'),
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
          {t('completed')}
        </Badge>
      ),
      buttonText: t('review'),
      mobileButtonText: t('review'),
      buttonVariant: 'secondary' as const,
      buttonIcon: <ArrowRight size={16} className="ml-2" />,
      borderColor: 'rgb(22, 163, 74)',
    },
  }
}
