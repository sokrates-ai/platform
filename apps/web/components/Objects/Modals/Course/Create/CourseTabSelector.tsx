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
import { GripVertical, Plus, X, CheckCircle2, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
  type DroppableProps,
} from 'react-beautiful-dnd';
import { DEFAULT_COURSE_TABS, type CourseTab } from './courseTabs';

export { DEFAULT_COURSE_TABS, type CourseTab } from './courseTabs';

const deriveCounter = (tabs: CourseTab[]): number => {
  const numericIds = tabs
    .map((tab) => {
      const match = tab.id.match(/^tab-(\d+)/);
      if (!match) return Number.NaN;
      return Number.parseInt(match[1], 10);
    })
    .filter((value) => Number.isFinite(value));

  if (numericIds.length === 0) {
    return tabs.length;
  }

  return Math.max(...numericIds);
};

const deriveTabIdSuffix = (tabs: CourseTab[]): string => {
  for (const tab of tabs) {
    const match = tab.id.match(/^tab-\d+(.+)$/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return '';
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
  onTabsChange?: (
    tabs: CourseTab[],
    change?: { type: 'create' | 'remove' | 'reorder' | 'update'; tabId?: string },
  ) => void;
  onActiveTabChange?: (
    tabId: string,
    change?: { type: 'create' | 'remove' | 'manual' },
  ) => void;
  renderTabContent?: (tab: CourseTab) => React.ReactNode;
  addButtonLabel?: string;
  orientation?: 'horizontal' | 'vertical';
  showVisibilityControls?: boolean;
  allowTabEditing?: boolean;
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
  allowTabEditing = true,
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

  const toDateOnly = useCallback((value?: string | null) => {
    if (!value) {
      return null;
    }
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) {
      return match[0];
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
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
      onActiveTabChange?.('', { type: 'remove' });
      return;
    }
    if (!tabs.some((tab) => tab.id === internalActiveTab)) {
      const fallback = tabs[0]?.id ?? '';
      setInternalActiveTab(fallback);
      onActiveTabChange?.(fallback, { type: 'remove' });
    }
  }, [tabs, isActiveTabControlled, internalActiveTab, onActiveTabChange]);

  const handleActiveTabChange = useCallback(
    (
      value: string,
      change: { type: 'create' | 'remove' | 'manual' } = { type: 'manual' },
    ) => {
      setEditingTabId(null);
      setEditingValue('');
      if (!isActiveTabControlled) {
        setInternalActiveTab(value);
      }
      onActiveTabChange?.(value, change);
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
    const newTabId = `tab-${tabCounterRef.current}${deriveTabIdSuffix(tabs)}`;

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
    onTabsChange?.(nextTabs, { type: 'create', tabId: newTabId });
    handleActiveTabChange(newTabId, { type: 'create' });

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
        onTabsChange?.(nextTabs, { type: 'update', tabId });
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
      onTabsChange?.(nextTabs, { type: 'update', tabId });
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
    onTabsChange?.(filteredTabs, { type: 'remove', tabId: tabPendingRemoval.id });

    if (tabPendingRemoval.id === activeTab) {
      const fallbackTab = filteredTabs[Math.max(filteredTabs.length - 1, 0)];
      handleActiveTabChange(fallbackTab?.id ?? '', { type: 'remove' });
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
  const canEditTabs = allowTabEditing;

  // Hilfsfunktion: nächsten Montag als "YYYY-MM-DD"
  function getNextMondayAt8(): string {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMonday);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
  }

  return (
    <div className={cn(isVertical ? 'flex w-full flex-col' : 'w-full', className)}>
      <DragDropContext
        onDragEnd={(result: DropResult) => {
          if (!canEditTabs) return;
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
          onTabsChange?.(reordered, { type: 'reorder', tabId: moved.id });
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
                    const isInstant = !hasVisibleAfter;
                    const isPlanned = hasVisibleAfter;
                    const instantVisibilityLabel = visibilityValue ? 'Visible immediately' : 'Hidden';
                    const instantTextClass = visibilityValue ? 'text-emerald-700' : 'text-gray-600';
                    const instantIconClass = visibilityValue ? 'text-emerald-500' : 'text-gray-400';
                    return (
                      <Draggable
                        key={tab.id}
                        draggableId={tab.id}
                        index={index}
                        isDragDisabled={!canEditTabs}
                      >
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            style={dragProvided.draggableProps.style}
                            className={cn(
                              'relative flex gap-2 rounded-md',
                              showVisibilityControls && isVertical ? 'items-start' : 'items-center',
                              snapshot.isDragging && 'opacity-80 shadow-lg',
                              isVertical ? 'w-full' : '',
                            )}
                          >
                            {canEditTabs ? (
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
                            ) : null}
                            <div
                              className={cn(
                                'flex w-full flex-col gap-2',
                                showVisibilityControls && isVertical
                                  ? 'rounded-md border border-transparent bg-white/70 p-2'
                                  : '',
                                showVisibilityControls && isVertical
                                  ? (tab.id === activeTab
                                      ? 'border-[#FF6934] ring-1 ring-[#FF6934]/30'
                                      : 'border-gray-300')
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
                                        if (!canEditTabs) return;
                                        if (event.pointerType === 'mouse' && event.button !== 0) {
                                          return;
                                        }
                                        handleLongPressStart(tab);
                                      }}
                                      onPointerUp={clearLongPressTimeout}
                                      onPointerLeave={clearLongPressTimeout}
                                      onPointerCancel={clearLongPressTimeout}
                                      onClick={(event) => {
                                        if (!canEditTabs) return;
                                        if (longPressTriggeredRef.current) {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          longPressTriggeredRef.current = false;
                                        }
                                      }}
                                      onDoubleClick={(event) => {
                                        if (!canEditTabs) return;
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
                                <div className="px-1 pb-0">
                                  {/* Segmented Control */}
                                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1">
                                  {/* Instant */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateTabMetadata(tab.id, (current) => ({
                                          ...current,
                                          visibleAfter: null,
                                        }))
                                      }
                                      className={cn(
                                        'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all duration-150',
                                        isInstant
                                          ? 'bg-white text-emerald-700 shadow ring-1 ring-emerald-200'
                                          : 'text-gray-500 hover:bg-white/60',
                                      )}
                                    >
                                      <CheckCircle2 className={cn('h-3.5 w-3.5', isInstant ? 'text-emerald-500' : 'text-gray-400')} />
                                      Instant
                                    </button>
                                    {/* Planned */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateTabMetadata(tab.id, (current) => ({
                                          ...current,
                                          visibility: true,
                                          visibleAfter: toDateOnly(current.visibleAfter ?? getNextMondayAt8()),
                                        }))
                                      }
                                      className={cn(
                                        'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all duration-150',
                                        isPlanned
                                          ? 'bg-white text-violet-700 shadow ring-1 ring-violet-200'
                                          : 'text-gray-500 hover:bg-white/60',
                                      )}
                                    >
                                      <CalendarClock className={cn('h-3.5 w-3.5', isPlanned ? 'text-violet-500' : 'text-gray-400')} />
                                      Planned
                                    </button>
                                  </div>

                                  {/* Slide-Down Controls */}
                                  <div className={cn(
                                    'overflow-hidden transition-all duration-200',
                                    isInstant ? 'max-h-20 h-20 mt-1.5 opacity-100' : 'max-h-0 h-0 opacity-0',
                                  )}>
                                    <div
                                      className={cn(
                                        'flex items-center justify-between rounded-lg border px-2.5 py-2',
                                        visibilityValue
                                          ? 'border-emerald-200 bg-emerald-50'
                                          : 'border-red-200 bg-red-50',
                                      )}
                                    >
                                      <div className={cn('flex items-center gap-2 text-[11px] font-medium', instantTextClass)}>
                                        <CheckCircle2 className={cn('h-3.5 w-3.5', instantIconClass)} />
                                        {instantVisibilityLabel}
                                      </div>
                                      <Switch
                                        checked={visibilityValue}
                                        onCheckedChange={(checked) =>
                                          updateTabMetadata(tab.id, (current) => ({
                                            ...current,
                                            visibility: checked,
                                            visibleAfter: checked ? null : current.visibleAfter,
                                          }))
                                        }
                                        aria-label="Visibility"
                                      />
                                    </div>
                                  </div>
                                  <div className={cn(
                                    'overflow-hidden transition-all duration-200',
                                    isPlanned ? 'max-h-20 h-20 mt-1.5 opacity-100' : 'max-h-0 h-0 opacity-0',
                                  )}>
                                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2">
                                      <input
                                        type="date"
                                        value={formattedVisibleAfter}
                                        min={new Date().toISOString().slice(0, 10)}
                                        onChange={(e) =>
                                          updateTabMetadata(tab.id, (current) => ({
                                            ...current,
                                            visibleAfter: toDateOnly(e.target.value),
                                          }))
                                        }
                                        className="w-full rounded-md border border-violet-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-violet-400"
                                      />
                                      {tab.visibleAfter && (() => {
                                        const d = new Date(tab.visibleAfter);
                                        if (Number.isNaN(d.getTime())) return null;
                                        return (
                                          <p className="mt-1 flex items-center gap-1 text-[10px] text-violet-600">
                                            <CalendarClock className="h-3 w-3 shrink-0" />
                                            {d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                          </p>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            {canEditTabs ? (
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
                            ) : null}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {dropProvided.placeholder}
                </TabsList>
              )}
            </StrictModeDroppable>
            {canEditTabs ? (
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
            ) : null}
          </div>
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              {renderContent(tab)}
            </TabsContent>
          ))}
        </Tabs>
      </DragDropContext>

      {canEditTabs ? (
        <>
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
        </>
      ) : null}
    </div>
  );
};

export default CourseTabSelector;
