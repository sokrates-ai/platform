import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Markdown from '@/shared/ui/Markdown';
import { Button } from '@/shared/ui/button';

interface TaskProps {
  title?: string;
  instruction?: string;
  className?: string;
}

export const Task: React.FC<TaskProps> = ({
  title = 'Exercise',
  instruction = '',
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`w-full px-8 md:px-12 lg:px-16 mb-8 ${className}`}>
      <div className="text-left space-y-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
          <Markdown>{title}</Markdown>
        </h1>

        <div className="max-w-2xl text-base sm:text-lg text-gray-600 leading-relaxed font-normal">
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={expanded ? 'Collapse description' : 'Expand description'}
              aria-expanded={expanded}
              onClick={() => setExpanded(v => !v)}
              className="h-6 w-6 p-0 mt-1 shrink-0"
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform duration-200 ease-out ${expanded ? 'rotate-90' : ''}`}
              />
            </Button>

            <div
              className={[
                'prose prose-neutral max-w-none prose-p:my-0 prose-headings:my-0 prose-strong:inherit prose-em:inherit',
                expanded ? '' : 'line-clamp-3',
              ].join(' ')}
              style={
                expanded
                  ? undefined
                  : ({
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  } as React.CSSProperties)
              }
            >
              <Markdown>{instruction}</Markdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Task;
