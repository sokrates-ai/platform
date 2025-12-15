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
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export interface CourseTabSelectorProps {
  className?: string;
  initialTabs?: CourseTab[];
  tabs?: CourseTab[];
  activeTab?: string;
  onTabsChange?: (tabs: CourseTab[]) => void;
  onActiveTabChange?: (tabId: string) => void;
  renderTabContent?: (tab: CourseTab) => React.ReactNode;
  addButtonLabel?: string;
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

  return (
    <div className={cn('w-full border-y border-solid border-black px-[3rem] py-[0.5rem]', className)}>
      <Tabs value={activeTab} onValueChange={handleActiveTabChange} className="w-full">
        <div className="flex items-center justify-between gap-2">
          <TabsList className="flex flex-1 flex-wrap items-center gap-2 justify-start bg-transparent">
            {tabs.map((tab) => {
              const disableRemove = tabs.length === 1;
              return (
                <div key={tab.id} className="relative">
                  <TabsTrigger value={tab.id} className="pr-6 border-gray-400 border-[1px] border-solid">
                    {tab.name}
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
                      'absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition',
                      'hover:bg-muted-foreground/10 hover:text-destructive',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      disableRemove && 'pointer-events-none opacity-50',
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </TabsList>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {addButtonLabel}
          </Button>
        </div>
      </Tabs>

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
