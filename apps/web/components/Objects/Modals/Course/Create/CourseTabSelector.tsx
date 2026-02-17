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
import { Switch } from '@/components/ui/switch';
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
  position?: number;
  visibility?: boolean;
  visibleAfter?: string | null;
  isVisible?: boolean;
};

export const DEFAULT_COURSE_TABS: CourseTab[] = [
  {
    id: 'tab-1',
    name: 'Content',
    description: 'Organize chapters and activities for this course.',
    visibility: true,
    visibleAfter: null,
  },
  {
    id: 'tab-2',
    name: 'Map',
    description: 'Design the spatial course map for learners.',
    visibility: true,
    visibleAfter: null,
  },
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
  showVisibilityControls?: boolean;
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
  showVisibilityControls = false,
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
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const formatVisibleAfterValue = useCallback((value?: string | null) => {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) {
        return match[0];
      }
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsed.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const resolveVisibilityValue = useCallback((tab: CourseTab) => {
    if (typeof tab.visibility === 'boolean') {
      return tab.visibility;
    }
    return true;
  }, []);

  const resolveEffectiveVisibility = useCallback(
    (tab: CourseTab) => {
      const hasManualOverride = typeof tab.visibility === 'boolean';
      const hasVisibleAfter = tab.visibleAfter !== undefined && tab.visibleAfter !== null;
      const manualVisible = resolveVisibilityValue(tab);
      if (!manualVisible) {
        return false;
      }
      const rawVisibleAfter = tab.visibleAfter ?? null;
      if (!rawVisibleAfter) {
        return manualVisible;
      }
      const parsed = new Date(rawVisibleAfter);
      if (Number.isNaN(parsed.getTime())) {
        return manualVisible;
      }
      const today = new Date();
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const visibleAfterDate = new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
      );
      const derivedVisible = visibleAfterDate <= todayDate;
      if (hasManualOverride || hasVisibleAfter) {
        return derivedVisible;
      }
      if (typeof tab.isVisible === 'boolean') {
        return tab.isVisible;
      }
      return derivedVisible;
    },
    [resolveVisibilityValue],
  );

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

    const nextTabs = [
      ...tabs,
      {
        id: newTabId,
        name: trimmedName,
        visibility: true,
        visibleAfter: null,
      },
    ];
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
      const currentTab = tabs.find((tab) => tab.id === tabId);
      const hasChanged = !currentTab || currentTab.name !== trimmed;
      const nextTabs = tabs.map((tab) =>
        tab.id === tabId ? { ...tab, name: trimmed } : tab,
      );
      if (!isTabsControlled) {
        setInternalTabs(nextTabs);
      }
      if (hasChanged) {
        onTabsChange?.(nextTabs);
      }
      setEditingTabId(null);
      setEditingValue('');
    },
    [isTabsControlled, onTabsChange, tabs],
  );

  const updateTabMetadata = useCallback(
    (tabId: string, updater: (tab: CourseTab) => CourseTab) => {
      const nextTabs = tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
      if (!isTabsControlled) {
        setInternalTabs(nextTabs);
      }
      onTabsChange?.(nextTabs);
    },
    [isTabsControlled, onTabsChange, tabs],
  );

  const cancelEditingTab = useCallback(() => {
    setEditingTabId(null);
    setEditingValue('');
  }, []);

  const clearLongPressTimeout = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const handleLongPressStart = useCallback(
    (tab: CourseTab) => {
      longPressTriggeredRef.current = false;
      clearLongPressTimeout();
      longPressTimeoutRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        startEditingTab(tab);
      }, 450);
    },
    [clearLongPressTimeout, startEditingTab],
  );

  useEffect(() => {
    return () => clearLongPressTimeout();
  }, [clearLongPressTimeout]);

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
                    const visibilityValue = resolveVisibilityValue(tab);
                    const effectiveVisibility = resolveEffectiveVisibility(tab);
                    const formattedVisibleAfter = formatVisibleAfterValue(tab.visibleAfter ?? null);
                    const hasVisibleAfter = Boolean(formattedVisibleAfter);
                    return (
                      <Draggable key={tab.id} draggableId={tab.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            style={dragProvided.draggableProps.style}
                            className={cn(
                              'relative flex gap-2 rounded-md',
                              showVisibilityControls && isVertical ? 'items-start' : 'items-center',
                              showVisibilityControls && isVertical ? 'min-h-[96px]' : '',
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
                                showVisibilityControls && isVertical ? 'self-center' : '',
                                snapshot.isDragging && 'text-primary',
                              )}
                            >
                              <GripVertical aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <div
                              className={cn(
                                'flex w-full flex-col gap-2',
                                showVisibilityControls && isVertical
                                  ? 'rounded-md border border-gray-300 bg-white/70 p-2'
                                  : '',
                                showVisibilityControls && isVertical && tab.id === activeTab
                                  ? 'border-[#FF6934] ring-1 ring-[#FF6934]/30'
                                  : '',
                              )}
                            >
                              <TabsTrigger
                                value={tab.id}
                                asChild
                                className={cn(
                                  showVisibilityControls && isVertical
                                    ? 'flex-1 rounded-md border border-transparent bg-transparent justify-start'
                                    : 'flex-1 rounded-md border border-gray-300 bg-white/70 justify-start',
                                  snapshot.isDragging && 'border-primary shadow',
                                )}
                              >
                                <div
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-4 py-3 text-sm transition',
                                    isVertical ? 'justify-start text-left' : 'justify-start text-left',
                                  )}
                                >
                                  {editingTabId === tab.id ? (
                                    <input
                                      value={editingValue}
                                      onChange={(event) => setEditingValue(event.target.value)}
                                      onBlur={() => applyTabNameUpdate(tab.id, editingValue)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === 'NumpadEnter') {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          applyTabNameUpdate(tab.id, editingValue);
                                        }
                                        if (event.key === 'Escape') {
                                          event.preventDefault();
                                          event.stopPropagation();
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
                                      onPointerDown={(event) => {
                                        if (event.pointerType === 'mouse' && event.button !== 0) {
                                          return;
                                        }
                                        handleLongPressStart(tab);
                                      }}
                                      onPointerUp={clearLongPressTimeout}
                                      onPointerLeave={clearLongPressTimeout}
                                      onPointerCancel={clearLongPressTimeout}
                                      onClick={(event) => {
                                        if (longPressTriggeredRef.current) {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          longPressTriggeredRef.current = false;
                                        }
                                      }}
                                      onDoubleClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        startEditingTab(tab);
                                      }}
                                      className={cn(
                                        'line-clamp-1 w-full text-ellipsis overflow-visible',
                                        isVertical ? 'text-left' : 'text-center',
                                      )}
                                    >
                                      {tab.name}
                                    </span>
                                  )}
                                </div>
                              </TabsTrigger>
                              {showVisibilityControls && isVertical ? (
                                <div className="flex w-full items-center gap-3 rounded-md bg-white/50 px-4 py-2">
                                  <label className="flex flex-1 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Visible After
                                    <Input
                                      type="date"
                                      value={formattedVisibleAfter}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        updateTabMetadata(tab.id, (current) => ({
                                          ...current,
                                          visibleAfter: nextValue ? nextValue : null,
                                        }));
                                      }}
                                      className={cn(
                                        'h-8 text-xs',
                                        !hasVisibleAfter
                                          ? 'border-slate-300 bg-slate-100 text-slate-500 focus-visible:ring-slate-300'
                                          : effectiveVisibility
                                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700 focus-visible:ring-emerald-500'
                                          : 'border-rose-400 bg-rose-50 text-rose-700 focus-visible:ring-rose-500',
                                      )}
                                    />
                                  </label>
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Visible
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={visibilityValue}
                                        onCheckedChange={(checked) => {
                                          updateTabMetadata(tab.id, (current) => ({
                                            ...current,
                                            visibility: checked,
                                          }));
                                        }}
                                        aria-label={`Toggle visibility for ${tab.name}`}
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        {visibilityValue ? 'On' : 'Off'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
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
