'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { GripVertical, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
  type DroppableProps,
} from 'react-beautiful-dnd';

export type CourseTab = {
  id: string;
  name: string;
  description?: string;
};

export const DEFAULT_COURSE_TABS: CourseTab[] = [
  { id: 'tab-1', name: 'Account', description: 'Make changes to your account here.' },
  { id: 'tab-2', name: 'Password', description: 'Change your password here.' },
];

const deriveCounter = (tabs: CourseTab[]): number => {
  const numericIds = tabs
    .map((tab) => {
      const matches = tab.id.match(/(\d+)/g);
      if (!matches) return Number.NaN;
      const lastMatch = matches[matches.length - 1];
      return Number.parseInt(lastMatch, 10);
    })
    .filter((value) => Number.isFinite(value));

  if (numericIds.length === 0) {
    return tabs.length;
  }

  return Math.max(...numericIds);
};

const StrictModeDroppable: React.FC<DroppableProps> = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => cancelAnimationFrame(animation);
  }, []);

  if (!enabled) {
    return null;
  }

  return <Droppable {...props}>{children}</Droppable>;
};

export interface CourseTabSelectorProps {
  className?: string;
  initialTabs?: CourseTab[];
  tabs?: CourseTab[];
  activeTab?: string;
  onTabsChange?: (tabs: CourseTab[]) => void;
  onActiveTabChange?: (tabId: string) => void;
  renderTabContent?: (tab: CourseTab) => React.ReactNode;
  addButtonLabel?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const CourseTabSelector: React.FC<CourseTabSelectorProps> = ({
  className,
  initialTabs,
  tabs: tabsProp,
  activeTab: activeTabProp,
  onTabsChange,
  onActiveTabChange,
  renderTabContent,
  addButtonLabel = 'Add tab',
  orientation = 'horizontal',
}) => {
  const resolvedInitialTabs = useMemo(
    () => (initialTabs?.length ? initialTabs : DEFAULT_COURSE_TABS),
    [initialTabs],
  );

  const isTabsControlled = Array.isArray(tabsProp);
  const [internalTabs, setInternalTabs] = useState<CourseTab[]>(() =>
    (tabsProp && isTabsControlled
      ? tabsProp
      : resolvedInitialTabs
    ).map((tab) => ({ ...tab })),
  );
  const tabs = isTabsControlled ? (tabsProp as CourseTab[]) : internalTabs;

  const isActiveTabControlled = activeTabProp !== undefined;
  const [internalActiveTab, setInternalActiveTab] = useState<string>(() => {
    if (isActiveTabControlled) {
      return activeTabProp as string;
    }
    return tabs[0]?.id ?? '';
  });
  const activeTab = isActiveTabControlled ? (activeTabProp as string) : internalActiveTab;

  const tabCounterRef = useRef<number>(deriveCounter(tabs));
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [tabPendingRemoval, setTabPendingRemoval] = useState<CourseTab | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  useEffect(() => {
    if (isTabsControlled) {
      return;
    }
    setInternalTabs(resolvedInitialTabs.map((tab) => ({ ...tab })));
  }, [isTabsControlled, resolvedInitialTabs]);

  useEffect(() => {
    if (!isActiveTabControlled) {
      return;
    }
    setInternalActiveTab(activeTabProp as string);
  }, [isActiveTabControlled, activeTabProp]);

  useEffect(() => {
    tabCounterRef.current = deriveCounter(tabs);
  }, [tabs]);

  useEffect(() => {
    if (isActiveTabControlled) {
      return;
    }
    if (tabs.length === 0) {
      setInternalActiveTab('');
      onActiveTabChange?.('');
      return;
    }
    if (!tabs.some((tab) => tab.id === internalActiveTab)) {
      const fallback = tabs[0]?.id ?? '';
      setInternalActiveTab(fallback);
      onActiveTabChange?.(fallback);
    }
  }, [tabs, isActiveTabControlled, internalActiveTab, onActiveTabChange]);

  const handleActiveTabChange = useCallback(
    (value: string) => {
      setEditingTabId(null);
      setEditingValue('');
      if (!isActiveTabControlled) {
        setInternalActiveTab(value);
      }
      onActiveTabChange?.(value);
    },
    [isActiveTabControlled, onActiveTabChange],
  );

  const handleAddDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setNewTabName('');
    }
  };

  const handleRemoveDialogOpenChange = (open: boolean) => {
    setIsRemoveDialogOpen(open);
    if (!open) {
      setTabPendingRemoval(null);
    }
  };

  const handleCreateTab = () => {
    const trimmedName = newTabName.trim();
    if (!trimmedName) return;

    tabCounterRef.current += 1;
    const newTabId = `tab-${tabCounterRef.current}`;

    const nextTabs = [...tabs, { id: newTabId, name: trimmedName }];
    if (!isTabsControlled) {
      setInternalTabs(nextTabs);
    }
    onTabsChange?.(nextTabs);
    handleActiveTabChange(newTabId);

    setNewTabName('');
    setIsAddDialogOpen(false);
  };

  const requestRemoveTab = (tab: CourseTab) => {
    if (tabs.length <= 1) return;
    setTabPendingRemoval(tab);
    setIsRemoveDialogOpen(true);
  };

  useEffect(() => {
    if (editingTabId && !tabs.some((tab) => tab.id === editingTabId)) {
      setEditingTabId(null);
      setEditingValue('');
    }
  }, [editingTabId, tabs]);

  const startEditingTab = useCallback(
    (tab: CourseTab) => {
      setEditingTabId(tab.id);
      setEditingValue(tab.name);
    },
    [],
  );

  const applyTabNameUpdate = useCallback(
    (tabId: string, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed) {
        setEditingTabId(null);
        setEditingValue('');
        return;
      }
      const nextTabs = tabs.map((tab) =>
        tab.id === tabId ? { ...tab, name: trimmed } : tab,
      );
      if (!isTabsControlled) {
        setInternalTabs(nextTabs);
      }
      onTabsChange?.(nextTabs);
      setEditingTabId(null);
      setEditingValue('');
    },
    [isTabsControlled, onTabsChange, tabs],
  );

  const cancelEditingTab = useCallback(() => {
    setEditingTabId(null);
    setEditingValue('');
  }, []);

  const confirmRemoveTab = () => {
    if (!tabPendingRemoval) return;
    if (tabs.length <= 1) {
      handleRemoveDialogOpenChange(false);
      return;
    }

    const filteredTabs = tabs.filter((tab) => tab.id !== tabPendingRemoval.id);
    if (!filteredTabs.length) {
      handleRemoveDialogOpenChange(false);
      return;
    }

    if (!isTabsControlled) {
      setInternalTabs(filteredTabs);
    }
    onTabsChange?.(filteredTabs);

    if (tabPendingRemoval.id === activeTab) {
      const fallbackTab = filteredTabs[Math.max(filteredTabs.length - 1, 0)];
      handleActiveTabChange(fallbackTab?.id ?? '');
    }

    setTabPendingRemoval(null);
    setIsRemoveDialogOpen(false);
  };

  const renderContent =
    renderTabContent ??
    ((tab: CourseTab) => (
      <p className="text-sm text-muted-foreground">
        {tab.description ?? `Nothing here yet for "${tab.name}".`}
      </p>
    ));

  const isVertical = orientation === 'vertical';
  const listClassName = isVertical
    ? 'flex flex-col items-stretch gap-2 w-full h-auto bg-transparent'
    : 'flex flex-1 flex-wrap items-center gap-2 justify-start bg-transparent';
  const wrapperClassName = isVertical
    ? 'flex flex-col items-stretch gap-3'
    : 'flex items-center justify-between gap-2';
  const addButtonClassName = isVertical ? 'w-full justify-center' : 'shrink-0';

  return (
    <div className={cn(isVertical ? 'flex w-full flex-col' : 'w-full', className)}>
      <DragDropContext
        onDragEnd={(result: DropResult) => {
          if (!result.destination) return;
          if (result.destination.index === result.source.index) return;
          const reordered = [...tabs];
          const [moved] = reordered.splice(result.source.index, 1);
          if (!moved) return;
          reordered.splice(result.destination.index, 0, moved);
          setEditingTabId(null);
          setEditingValue('');
          if (!isTabsControlled) {
            setInternalTabs(reordered);
          }
          onTabsChange?.(reordered);
          if (!isActiveTabControlled) {
            const stillActive = reordered.find((tab) => tab.id === activeTab);
            if (!stillActive) {
              handleActiveTabChange(reordered[0]?.id ?? '');
            }
          }
        }}
      >
        <Tabs
          value={activeTab}
          onValueChange={handleActiveTabChange}
          className={cn('w-full', isVertical && 'h-full')}
          orientation={isVertical ? 'vertical' : 'horizontal'}
        >
          <div className={wrapperClassName}>
            <StrictModeDroppable
              droppableId="course-tab-selector"
              direction={isVertical ? 'vertical' : 'horizontal'}
            >
              {(dropProvided) => (
                <TabsList
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                  className={listClassName}
                >
                  {tabs.map((tab, index) => {
                    const disableRemove = tabs.length === 1;
                    return (
                      <Draggable key={tab.id} draggableId={tab.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            style={dragProvided.draggableProps.style}
                            className={cn(
                              'relative flex items-center gap-2 rounded-md',
                              snapshot.isDragging && 'opacity-80 shadow-lg',
                              isVertical ? 'w-full' : '',
                            )}
                          >
                            <button
                              type="button"
                              aria-label={`Reorder ${tab.name}`}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-white/70 p-1 text-muted-foreground transition',
                                'cursor-grab active:cursor-grabbing',
                                'hover:bg-muted-foreground/10 hover:text-foreground',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                snapshot.isDragging && 'text-primary',
                              )}
                            >
                              <GripVertical aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <TabsTrigger
                              value={tab.id}
                              asChild
                              className={cn(
                                'flex-1 rounded-md border border-gray-300 bg-white/70',
                                snapshot.isDragging && 'border-primary shadow',
                              )}
                            >
                              <div
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition',
                                  isVertical ? 'justify-start text-left' : 'justify-center text-center',
                                )}
                              >
                                {editingTabId === tab.id ? (
                                  <input
                                    value={editingValue}
                                    onChange={(event) => setEditingValue(event.target.value)}
                                    onBlur={() => applyTabNameUpdate(tab.id, editingValue)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        applyTabNameUpdate(tab.id, editingValue);
                                      }
                                      if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancelEditingTab();
                                      }
                                    }}
                                    autoFocus
                                    className={cn(
                                      'w-full rounded-md border border-transparent bg-transparent text-sm outline-none focus:border-primary focus:ring-0',
                                      isVertical ? '' : 'text-center',
                                    )}
                                  />
                                ) : (
                                  <span
                                    onClick={(event) => {
                                      if (tab.id !== activeTab) return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      startEditingTab(tab);
                                    }}
                                    className={cn(
                                      'line-clamp-1 flex-1',
                                      isVertical ? 'text-left' : 'text-center',
                                    )}
                                  >
                                    {tab.name}
                                  </span>
                                )}
                              </div>
                            </TabsTrigger>
                            <button
                              type="button"
                              aria-label={`Remove ${tab.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                event.preventDefault();
                                requestRemoveTab(tab);
                              }}
                              disabled={disableRemove}
                              className={cn(
                                'rounded-full p-0.5 text-muted-foreground transition',
                                'hover:bg-muted-foreground/10 hover:text-destructive',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                disableRemove && 'pointer-events-none opacity-50',
                              )}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {dropProvided.placeholder}
                </TabsList>
              )}
            </StrictModeDroppable>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={addButtonClassName}
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {addButtonLabel}
            </Button>
          </div>
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              {renderContent(tab)}
            </TabsContent>
          ))}
        </Tabs>
      </DragDropContext>

      <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new tab</DialogTitle>
            <DialogDescription>
              Give your tab a descriptive name so it is easy to find later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Tab name
              <Input
                value={newTabName}
                onChange={(event) => setNewTabName(event.target.value)}
                placeholder="My new tab"
                autoFocus
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleAddDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateTab} disabled={!newTabName.trim()}>
              Add tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRemoveDialogOpen} onOpenChange={handleRemoveDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove tab</DialogTitle>
            <DialogDescription>
              {tabPendingRemoval
                ? `Are you sure you want to delete "${tabPendingRemoval.name}"? This cannot be undone.`
                : 'Are you sure you want to delete this tab? This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleRemoveDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemoveTab}>
              Delete tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseTabSelector;
