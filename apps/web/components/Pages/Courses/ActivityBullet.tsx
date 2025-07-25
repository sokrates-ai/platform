// components/course/ActivityBullet.tsx
import Image from 'next/image'
import clsx from 'clsx'

export type BulletState = 'locked' | 'available' | 'done'

interface Props {
  /**
   * Where the bullet sits inside the list
   * (needed to draw the green part of the line only up to the last done item)
   */
  index: number
  lastDoneIndex: number
  state: BulletState
}

export default function ActivityBullet({ index, lastDoneIndex, state }: Props) {
  /** grey by default, switch to green when "done" OR when the item is above the last done one */
  const lineColor =
    index <= lastDoneIndex ? 'bg-[#90AF40]' : 'bg-[#DFDFDF]'

  return (
    <>
      {/* vertical line */}
      <span
        className={clsx(
          'absolute left-[14px] w-[2px] -top-4 bottom-0',
          lineColor
        )}
      />
      {/* bullet itself */}
      <span
        className={clsx(
          'relative z-10 flex items-center justify-center w-[29px] h-[29px] rounded-full shrink-0',
          {
            'bg-[#90AF40]': state === 'done',
            'border-2 border-[#B7B7B7] bg-[#D4D4D4]': state === 'available',
            'border-2 border-[#DFDFDF] bg-[#E4E4E4]': state === 'locked',
          }
        )}
      >
        {state === 'done' && (
          <Image
            src="/checkmark-green.svg"
            alt="done"
            width={16}
            height={16}
            priority
          />
        )}
      </span>
    </>
  )
}
