'use client'
import { getAPIUrl, getBackendUrl } from '@services/config/config'
import { revalidateTags } from '@services/utils/ts/requests'
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { DragDropContext } from 'react-beautiful-dnd'
import { mutate } from 'swr'
import ChapterElement from './DraggableElements/ChapterElement'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import {
  createChapter,
  deleteChapter,
  updateChapterEdge,
} from '@services/courses/chapters'
import { useRouter } from 'next/navigation'
import {
  useCourse,
  useCourseDispatch,
} from '@components/Contexts/CourseContext'
import {
  CheckCircle2,
  Download,
  Hexagon,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import NewChapterModal from '@components/Objects/Modals/Chapters/NewChapter'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { AnimatePresence, motion } from 'framer-motion'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'

import dagre from 'dagre';
import { Background, BackgroundVariant, Handle, MarkerType, MiniMap, NodeProps, Position, addEdge, useEdgesState, useNodesState, Node, Edge } from '@xyflow/react';
const ReactFlow = dynamic(() => import('@xyflow/react').then((mod) => mod.ReactFlow), {
  ssr: false,
});
import '@xyflow/react/dist/style.css';
import './graph.css';

import styled from 'styled-components'
import dynamic from 'next/dynamic'
import { Button } from "@components/ui/button";
import { Input } from '@components/ui/input';
import { Card, CardContent } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { CourseTab, CourseTabSelector } from '@components/Objects/Modals/Course/Create/CourseTabSelector';
import {
  applyInvlectRoomsImport,
  fetchInvlectRoomsImport,
  InvlectRoomsApplyResponse,
  InvlectRoomsImportResponse,
} from '@services/invlectrooms';
import toast from 'react-hot-toast';

// -----------------------------------------------------------------------------
// TYPE DEFINITIONS
// -----------------------------------------------------------------------------

type DisplayGraphProps = {
    chapters: any[]
    setChapterID: Function
    chapterID: number,
}

type ImportStepStatus = 'pending' | 'active' | 'completed' | 'failed';

type ImportStepState = {
  id: string;
  label: string;
  status: ImportStepStatus;
};

const MOCK_IMPORT_STEPS: Array<Omit<ImportStepState, 'status'>> = [
  { id: 'validate', label: 'Validating source URL' },
  { id: 'fetch', label: 'Fetching remote course data' },
  { id: 'parse', label: 'Parsing chapters and activities' },
  { id: 'hydrate', label: 'Preparing course preview' },
  { id: 'finalize', label: 'Finalizing import' },
];

type ImportStepId = (typeof MOCK_IMPORT_STEPS)[number]['id'];

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const extractTextSegments = (html: string): string[] => {
  if (!html) {
    return [];
  }
  try {
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
      const fallback = normalizeWhitespace(html.replace(/<[^>]+>/g, ' '));
      return fallback ? [fallback] : [];
    }
    const parser = new DOMParser();
    const document = parser.parseFromString(html, 'text/html');
    const segments: string[] = [];
    document.querySelectorAll('script,style,noscript').forEach((el) => el.remove());
    const elements = document.querySelectorAll('p, li');
    if (elements.length) {
      elements.forEach((element) => {
        const text = normalizeWhitespace(element.textContent ?? '');
        if (text) {
          segments.push(element.tagName.toLowerCase() === 'li' ? `• ${text}` : text);
        }
      });
    } else {
      const fallback = normalizeWhitespace(document.body?.textContent ?? '');
      if (fallback) {
        segments.push(fallback);
      }
    }
    return segments;
  } catch {
    return [];
  }
};

const buildPreview = (segments: string[], limit = 220): string => {
  if (!segments.length) {
    return '';
  }
  const text = segments.join(' ');
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit).trimEnd()}…`;
};

const guessChapterTitleFromUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    const lastSegment =
      parsed.pathname
        .split('/')
        .filter(Boolean)
        .pop() || parsed.hostname;
    const normalized = decodeURIComponent(lastSegment)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) {
      return 'Imported content';
    }
    return normalized
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return 'Imported content';
  }
};

const CHECKPOINT_LEVELS = ['bronze', 'silver', 'gold'] as const;
type CheckpointLevel = (typeof CHECKPOINT_LEVELS)[number];

const CHECKPOINT_LABELS: Record<CheckpointLevel, string> = {
  bronze: 'Bronze',
  silver: 'Silber',
  gold: 'Gold',
};

const CHECKPOINT_BADGE_CLASSES: Record<CheckpointLevel, string> = {
  bronze: 'border-amber-400 text-amber-700 bg-amber-50',
  silver: 'border-slate-400 text-slate-600 bg-slate-50',
  gold: 'border-yellow-400 text-yellow-800 bg-yellow-50',
};

const CHECKPOINT_KEYWORDS: Record<CheckpointLevel, string[]> = {
  bronze: ['bronze'],
  silver: ['silber', 'silver'],
  gold: ['gold'],
};

const CHECKPOINT_IMAGE_TOKENS: Record<CheckpointLevel, string[]> = {
  bronze: ['platypusbronze'],
  silver: ['platypussilber', 'platypussilver'],
  gold: ['platypusgold'],
};

const IMAGE_ONLY_TEXT_PATTERN =
  /^(?:image:\s*)?(?:\/content\/|https?:\/\/).+\.(?:png|jpe?g|gif|webp|svg)(?:\?.*)?$/i;

const isImageOnlyText = (value: string): boolean => {
  const normalized = normalizeWhitespace(value ?? '');
  if (!normalized) {
    return true;
  }
  return IMAGE_ONLY_TEXT_PATTERN.test(normalized);
};

const detectImageOnlyProblem = ({
  html,
  plainText,
  image,
}: {
  html?: string;
  plainText?: string;
  image?: unknown;
}): boolean => {
  let hasImage = false;
  let hasText = false;
  let hasHtmlImage = false;

  if (typeof image === 'string') {
    hasImage = image.trim().length > 0;
  } else if (image && typeof image === 'object') {
    const candidate = image as Record<string, unknown>;
    for (const key of ['local', 'original']) {
      const value = candidate[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        hasImage = true;
        break;
      }
    }
  }

  if (html) {
    try {
      if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
        hasHtmlImage = /<img\b/i.test(html);
        const fallback = normalizeWhitespace(html.replace(/<[^>]+>/g, ' '));
        if (fallback) {
          hasText = true;
        }
      } else {
        const parser = new DOMParser();
        const document = parser.parseFromString(html, 'text/html');
        hasHtmlImage = !!document.querySelector('img');
        const textContent = normalizeWhitespace(document.body?.textContent ?? '');
        if (textContent) {
          hasText = true;
        }
      }
    } catch {
      // ignore parsing failures
    }
  }

  if (plainText && !isImageOnlyText(plainText)) {
    hasText = true;
  }

  if (!hasImage && hasHtmlImage) {
    hasImage = true;
  }

  return hasImage && !hasText;
};

type CheckpointDetectionInput = {
  title?: string;
  html?: string;
  plainText?: string;
  image?: unknown;
};

const detectCheckpointLevel = ({
  title,
  html,
  plainText,
  image,
}: CheckpointDetectionInput): CheckpointLevel | null => {
  const textFragments = [title, plainText, html]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.toLowerCase());

  if (textFragments.length) {
    const combined = textFragments.join(' ');
    if (combined.includes('schnabeltierchen')) {
      for (const level of CHECKPOINT_LEVELS) {
        if (CHECKPOINT_KEYWORDS[level].some((keyword) => combined.includes(keyword))) {
          return level;
        }
      }
    }
  }

  const evaluateImageValue = (value: unknown): CheckpointLevel | null => {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.toLowerCase();
    for (const level of CHECKPOINT_LEVELS) {
      if (CHECKPOINT_IMAGE_TOKENS[level].some((token) => normalized.includes(token))) {
        return level;
      }
    }
    return null;
  };

  if (typeof image === 'string') {
    const detected = evaluateImageValue(image);
    if (detected) {
      return detected;
    }
  } else if (image && typeof image === 'object') {
    const candidate = image as Record<string, unknown>;
    for (const key of ['local', 'original']) {
      const detected = evaluateImageValue(candidate[key]);
      if (detected) {
        return detected;
      }
    }
  }

  return null;
};

type ImportCourseStructureDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  onResult?: (result: InvlectRoomsImportResponse) => void;
  onApplied?: (result: InvlectRoomsApplyResponse) => void | Promise<void>;
  courseUuid: string;
  tabUuid?: string;
};

const ImportCourseStructureDialog: React.FC<ImportCourseStructureDialogProps> = ({
  isOpen,
  onCancel,
  onResult,
  onApplied,
  courseUuid,
  tabUuid,
}) => {
  const [sourceUrl, setSourceUrl] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<InvlectRoomsImportResponse | null>(null);
  const [chapterNames, setChapterNames] = useState<string[]>([]);
  const [importSource, setImportSource] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [xpReward, setXpReward] = useState(0);
  const [coinReward, setCoinReward] = useState(0);
  const [steps, setSteps] = useState<ImportStepState[]>(() =>
    MOCK_IMPORT_STEPS.map((step) => ({ ...step, status: 'pending' })),
  );
  const session = useSokratesSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  const updateStep = useCallback((id: ImportStepId, status: ImportStepStatus) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, status } : step))
    );
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSourceUrl('');
      setHasStarted(false);
      setTouched(false);
      setIsRunning(false);
      setHasCompleted(false);
      setErrorMessage(null);
      setImportResult(null);
      setChapterNames([]);
      setImportSource('');
      setIsApplying(false);
      setApplyError(null);
      setXpReward(0);
      setCoinReward(0);
      setSteps(MOCK_IMPORT_STEPS.map((step) => ({ ...step, status: 'pending' })));
    }
  }, [isOpen]);

  const isValidUrl = useMemo(() => {
    if (!sourceUrl) {
      return false;
    }
    try {
      const parsed = new URL(sourceUrl);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }, [sourceUrl]);

  const statusLabel = useCallback((status: ImportStepStatus) => {
    switch (status) {
      case 'active':
        return 'In progress';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  }, []);

  const startImport = useCallback(async () => {
    setTouched(true);
    if (!isValidUrl || isRunning) {
      return;
    }
    setErrorMessage(null);
    setImportResult(null);
    setChapterNames([]);
    setHasStarted(true);
    setHasCompleted(false);
    setIsRunning(true);
    setSteps(MOCK_IMPORT_STEPS.map((step) => ({ ...step, status: 'pending' })));

    const stepSequence: ImportStepId[] = MOCK_IMPORT_STEPS.map((step) => step.id as ImportStepId);
    let currentStep: ImportStepId = stepSequence[0];

    try {
      currentStep = 'validate';
      updateStep(currentStep, 'active');
      updateStep(currentStep, 'completed');

      currentStep = 'fetch';
      updateStep(currentStep, 'active');
      const response = await fetchInvlectRoomsImport(sourceUrl, access_token);
      updateStep(currentStep, 'completed');

      currentStep = 'parse';
      updateStep(currentStep, 'active');
      updateStep(currentStep, 'completed');

      currentStep = 'hydrate';
      updateStep(currentStep, 'active');
      updateStep(currentStep, 'completed');

      currentStep = 'finalize';
      updateStep(currentStep, 'active');
      updateStep(currentStep, 'completed');

      setImportResult(response);
      setImportSource(response.url || sourceUrl);
      if (onResult) {
        onResult(response);
      }

      setHasCompleted(true);
    } catch (error: any) {
      updateStep(currentStep, 'failed');
      const message =
        error?.message && typeof error.message === 'string'
          ? `Import failed: ${error.message}`
          : 'Import failed. Please try again.';
      setErrorMessage(message);
      setHasCompleted(false);
    } finally {
      setIsRunning(false);
    }
  }, [isValidUrl, isRunning, sourceUrl, access_token, updateStep, onResult]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await startImport();
    },
    [startImport],
  );

  const handleCancel = useCallback(() => {
    if (isRunning) {
      return;
    }
    onCancel();
  }, [isRunning, onCancel]);

  const mapProxyBaseUrl = useMemo(() => {
    const apiBase = getAPIUrl();
    if (!apiBase || apiBase === 'error') {
      return '/api/v1/mapProxy';
    }
    const normalizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    return `${normalizedBase}/mapProxy`;
  }, []);

  const normalizeRemoteUrl = useCallback((input: string) => {
    if (!input) return input;
    if (input.startsWith('//')) {
      const protocol =
        typeof window !== 'undefined' && window.location?.protocol
          ? window.location.protocol
          : 'https:';
      return `${protocol}${input}`;
    }
    return input;
  }, []);

  const filenameFromUrl = useCallback((url: string | undefined) => {
    if (!url) return undefined;
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length === 0) {
        return undefined;
      }
      const last = segments[segments.length - 1];
      return last ? last.split('?')[0] : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const ensureFilenameWithExtension = useCallback((filename: string | undefined, label?: string) => {
    const ALLOWED_EXTENSION = /\.(png|jpe?g|gif|webp|svg)$/i;
    if (filename) {
      const trimmed = filename.trim();
      if (trimmed.length > 0) {
        if (ALLOWED_EXTENSION.test(trimmed)) {
          if (/\.gif$/i.test(trimmed)) {
            return trimmed.replace(/\.gif$/i, '.png');
          }
          return trimmed;
        }
        return `${trimmed}.png`;
      }
    }
    if (label && label.trim().length > 0) {
      const base = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'asset';
      return `${base}.png`;
    }
    return 'asset.png';
  }, []);

  const toProxiedImageUrl = useCallback((file: string, label?: string) => {
    if (!file) return file;
    const trimmed = file.trim();
    if (!trimmed) return trimmed;

    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }

    const alreadyProxy =
      trimmed.includes('/mapProxy?url=') ||
      (trimmed.includes('/mapProxy/') && trimmed.includes('?url='));
    if (alreadyProxy) {
      return trimmed;
    }

    const normalizedSource = normalizeRemoteUrl(trimmed);
    const isRemote = /^(https?:)?\/\//i.test(normalizedSource);
    if (!isRemote) {
      return trimmed;
    }

    if (!mapProxyBaseUrl) {
      return normalizedSource;
    }

    const filenameCandidate = filenameFromUrl(normalizedSource);
    const safeFilename = ensureFilenameWithExtension(filenameCandidate, label);
    const isGifSource = /\.gif(?:$|[?#])/i.test(normalizedSource);
    const formatParam = isGifSource ? '&format=png' : '';
    return `${mapProxyBaseUrl}/${encodeURIComponent(safeFilename)}?url=${encodeURIComponent(normalizedSource)}${formatParam}`;
  }, [mapProxyBaseUrl, normalizeRemoteUrl, filenameFromUrl, ensureFilenameWithExtension]);

  const problems = useMemo(() => {
    const list = importResult?.refresh && Array.isArray(importResult.refresh.problems)
      ? importResult.refresh.problems
      : [];
    if (!list.length) {
      return [];
    }
    const backendUrl = (getBackendUrl() || '').replace(/\/$/, '');
    const MAX_PREVIEW_LENGTH = 220;

    return list.map((problem: any, index: number) => {
      const title =
        typeof problem?.title === 'string' && problem.title.trim().length > 0
          ? problem.title.trim()
          : `Problem ${index + 1}`;
      const rawImg = problem?.img;
      let imagePreview: string | undefined;
      let imageMeta: { original?: string; local?: string } | null = null;
      if (typeof rawImg === 'string') {
        const proxiedOriginal = toProxiedImageUrl(rawImg, title);
        imageMeta = { original: proxiedOriginal };
        if (/^(https?:)?\/\//i.test(rawImg)) {
          imagePreview = proxiedOriginal;
        } else {
          imagePreview = `${backendUrl}${rawImg}`;
        }
      } else if (rawImg && typeof rawImg === 'object') {
        const localImg = typeof rawImg.local === 'string' ? rawImg.local : undefined;
        const originalImg = typeof rawImg.original === 'string' ? rawImg.original : undefined;
        if (localImg) {
          imagePreview = /^(https?:)?\/\//i.test(localImg)
            ? toProxiedImageUrl(localImg, title)
            : `${backendUrl}${localImg}`;
        } else if (originalImg) {
          imagePreview = toProxiedImageUrl(originalImg, title);
        }
        const proxiedOriginal = originalImg ? toProxiedImageUrl(originalImg, title) : undefined;
        const proxiedLocal = localImg ? toProxiedImageUrl(localImg, title) : undefined;
        imageMeta = {
          ...(proxiedOriginal ? { original: proxiedOriginal } : {}),
          ...(proxiedLocal ? { local: proxiedLocal } : {}),
        };
      }
      const status = typeof problem?.status === 'string' ? problem.status : undefined;
      const html = typeof problem?.body === 'string' ? problem.body : '';
      const segments = extractTextSegments(html);
      const plainText = segments.join(' ');
      const preview = buildPreview(segments, MAX_PREVIEW_LENGTH);
      const imageOnly = detectImageOnlyProblem({
        html,
        plainText,
        image: rawImg,
      });
      const rawCheckpoint =
        typeof problem?.checkpointLevel === 'string' ? problem.checkpointLevel.trim().toLowerCase() : null;
      let checkpointLevel: CheckpointLevel | null = null;
      if (rawCheckpoint) {
        checkpointLevel = CHECKPOINT_LEVELS.find((level) => level === rawCheckpoint) ?? null;
      }
      if (!checkpointLevel) {
        checkpointLevel = detectCheckpointLevel({
          title,
          html,
          plainText,
          image: rawImg,
        });
      }

      return {
        id: problem?.id ?? index,
        title,
        status,
        html,
        plainText,
        preview,
        image: imageMeta,
        imagePreview,
        checkpointLevel,
        imageOnly,
      };
    });
  }, [importResult, toProxiedImageUrl]);

  const handleApply = useCallback(async () => {
    if (isApplying) {
      return;
    }
    if (!importResult) {
      setApplyError('Run the import before applying changes.');
      return;
    }
    if (!courseUuid) {
      setApplyError('Course context is missing.');
      return;
    }
    if (!problems.length) {
      setApplyError('No problems detected in the imported document.');
      return;
    }
    const trimmedChapterNames = chapterNames.map((name) => name.trim());
    if (trimmedChapterNames.length !== problems.length) {
      setApplyError('Provide a chapter name for each problem before applying.');
      return;
    }
    if (trimmedChapterNames.some((name) => !name)) {
      setApplyError('Provide a chapter name for each problem before applying.');
      return;
    }
    setApplyError(null);
    setIsApplying(true);
    try {
      const response = await applyInvlectRoomsImport(
        {
          url: importResult.url || sourceUrl,
          course_uuid: courseUuid,
          tab_uuid: tabUuid,
          xp_reward: xpReward,
          coin_reward: coinReward,
          problems: problems.map((problem, index) => ({
            id: problem.id,
            title: problem.title,
            status: problem.status,
            html: problem.html,
            plain_text: problem.plainText,
            image: problem.image ?? null,
            chapter_name: trimmedChapterNames[index],
            checkpoint_level: problem.checkpointLevel ?? null,
          })),
        },
        access_token
      );
      if (onApplied) {
        await onApplied(response);
      }
      onCancel();
    } catch (error: any) {
      const message =
        error?.message && typeof error.message === 'string'
          ? error.message
          : 'Failed to apply import.';
      setApplyError(message);
      return;
    } finally {
      setIsApplying(false);
    }
  }, [isApplying, importResult, courseUuid, tabUuid, chapterNames, problems, sourceUrl, access_token, onApplied, onCancel, xpReward, coinReward]);

  const validationMessage =
    touched && !isValidUrl ? 'Enter a valid URL (starting with http:// or https://).' : undefined;
  const hasProgress = hasStarted || isRunning || hasCompleted;

  useEffect(() => {
    if (!importResult) {
      setChapterNames([]);
      return;
    }
    const baseSource = importSource || importResult.url || '';
    const baseName = guessChapterTitleFromUrl(baseSource);
    setChapterNames(
      problems.map((problem, index) => {
        const problemTitle = problem.title || `Problem ${index + 1}`;
        return baseName ? `${baseName} — ${problemTitle}` : problemTitle;
      })
    );
  }, [importResult, importSource, problems]);

  const imageCount =
    importResult?.refresh && Array.isArray((importResult.refresh as any)?._images)
      ? ((importResult.refresh as any)._images as Array<unknown>).length
      : 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-6 py-2">
      <div className="space-y-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Source URL
          <Input
            type="url"
            placeholder="https://hpi.de/friedrich/docs/InvLectRooms/..."
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            required
            aria-invalid={validationMessage ? 'true' : 'false'}
            aria-describedby={validationMessage ? 'import-url-error' : undefined}
            disabled={isRunning}
          />
        </label>
        {validationMessage && (
          <p id="import-url-error" className="text-xs text-red-600">
            {validationMessage}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px,minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="space-y-3 rounded-md border border-gray-400 bg-gray-100 px-3 py-3 min-h-[280px] h-full">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Import progress</h3>
              <p className="text-xs text-muted-foreground">
                {hasProgress
                  ? 'Track each step as the import runs.'
                  : 'Start an import to see progress updates here.'}
              </p>
            </div>
            {hasProgress ? (
              <ul className="space-y-2">
                {steps.map((step) => {
                  let indicator: React.ReactNode;
                  if (step.status === 'active') {
                    indicator = <Loader2 className="h-3 w-3 animate-spin text-blue-500" aria-hidden="true" />;
                  } else if (step.status === 'completed') {
                    indicator = <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />;
                  } else if (step.status === 'failed') {
                    indicator = <X className="h-3 w-3 text-red-500" aria-hidden="true" />;
                  } else {
                    indicator = <span className="block h-2.5 w-2.5 rounded-full bg-gray-300" aria-hidden="true" />;
                  }
                  return (
                    <li key={step.id} className="flex items-start gap-3 rounded-md border border-gray-200 bg-white/70 px-3 py-2">
                      <span className="mt-1 flex h-5 w-5 items-center justify-center">
                        {indicator}
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{statusLabel(step.status)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="space-y-2">
                {MOCK_IMPORT_STEPS.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between rounded-md border border-dashed border-gray-200 bg-white/60 px-3 py-3"
                    aria-hidden="true"
                  >
                    <span className="h-2.5 w-24 rounded bg-gray-200 animate-pulse" />
                    <span className="h-2 w-16 rounded bg-gray-100 animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-md border border-gray-400 bg-gray-100 px-3 py-3 min-h-[280px]">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Import preview</h3>
            <p className="text-xs text-muted-foreground">
              {importResult
                ? problems.length > 0
                  ? `Found ${problems.length} problem${problems.length === 1 ? '' : 's'} in the source.`
                  : 'No problems detected in the source document.'
                : 'Run an import to preview the chapters that will be created.'}
            </p>
            {importResult?.refresh_url && (
              <a
                href={importResult.refresh_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View original refresh endpoint
              </a>
            )}
          </div>
          {importResult ? (
            <>
              {problems.length > 0 ? (
                <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
                  {problems.map((problem, index) => {
                      const chapterInputId = `import-chapter-${index}`;
                      const chapterValue = chapterNames[index] ?? '';
                      const checkpointLevel = (problem?.checkpointLevel ?? null) as CheckpointLevel | null;
                      return (
                        <article
                          key={`${problem.id}-${index}`}
                          className="space-y-3 rounded-md border border-gray-200 bg-white/70 p-3 shadow-sm"
                        >
                        <div className="space-y-1">
                          <label
                            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                            htmlFor={chapterInputId}
                          >
                            Chapter name
                          </label>
                          <Input
                            id={chapterInputId}
                            value={chapterValue}
                            onChange={(event) =>
                              setChapterNames((current) => {
                                const next = [...current];
                                next[index] = event.target.value;
                                return next;
                              })
                            }
                            placeholder={`Chapter title for ${problem.title}`}
                            disabled={isApplying}
                          />
                        </div>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p
                                className="flex-1 truncate text-sm font-medium text-foreground"
                                title={problem.title}
                              >
                                {problem.title}
                              </p>
                              {checkpointLevel && (
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wide ${CHECKPOINT_BADGE_CLASSES[checkpointLevel]}`}
                                >
                                  {CHECKPOINT_LABELS[checkpointLevel]} checkpoint
                                </Badge>
                              )}
                              {problem.imageOnly && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wide border-blue-300 text-blue-700 bg-blue-50"
                                >
                                  Image-only
                                </Badge>
                              )}
                            </div>
                            {problem.status && (
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {problem.status}
                              </span>
                            )}
                          </div>
                          {problem.id !== undefined && (
                            <span className="text-[10px] text-muted-foreground" title={String(problem.id)}>
                              ID: {problem.id}
                            </span>
                          )}
                        </div>
                        {problem.preview && (
                          <p
                            className="text-xs leading-relaxed text-muted-foreground overflow-hidden text-ellipsis"
                            title={problem.plainText}
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {problem.preview}
                          </p>
                        )}
                        {problem.imagePreview && (
                          <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
                            <img
                              src={problem.imagePreview}
                              alt={`Preview for ${problem.title}`}
                              className="max-h-40 w-full rounded object-contain"
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-gray-200 bg-white/60 text-xs text-muted-foreground">
                  No problems detected in the source document.
                </div>
              )}
              {imageCount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Cached {imageCount} image{imageCount === 1 ? '' : 's'} for offline reuse.
                </p>
              )}
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-gray-200 bg-white/60 text-xs text-muted-foreground">
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching preview…
                </span>
              ) : (
                'Import preview will appear here after the source has been processed.'
              )}
            </div>
          )}
        </div>
      </div>

      {hasCompleted && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Import finished successfully. You can review the changes before saving.
        </div>
      )}
      {applyError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {applyError}
        </div>
      )}

      {hasCompleted && (
        <div className="rounded-md border border-gray-200 bg-white/70 px-3 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col items-start space-y-1">
              <span className="text-xs text-neutral-600">XP reward per chapter: {xpReward}</span>
              <input
                type="range"
                min={0}
                max={50}
                value={xpReward}
                onChange={(event) => setXpReward(Number(event.target.value))}
                disabled={isApplying}
              />
            </div>
            <div className="flex flex-col items-start space-y-1">
              <span className="text-xs text-neutral-600">Coin reward per chapter: {coinReward}</span>
              <input
                type="range"
                min={0}
                max={10}
                value={coinReward}
                onChange={(event) => setCoinReward(Number(event.target.value))}
                disabled={isApplying}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {!hasCompleted && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={isRunning}
          >
            Cancel
          </Button>
        )}
        {hasCompleted ? (
          <Button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : (
              'Apply'
            )}
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!isValidUrl || isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              'Start'
            )}
          </Button>
        )}
      </div>
    </form>
  );
};


export type OrderPayload =
  | {
      chapter_order_by_ids: [
        {
          chapter_id: string
          activities_order_by_ids: [
            {
              activity_id: string
            },
          ]
        },
      ]
    }
  | undefined

export type ChapterEdgeModification =
  | {
        from_chapter_id: number,
        to_chapter_id: number,
        delete: boolean,
    }
  | undefined

// -----------------------------------------------------------------------------
// STYLED COMPONENTS
// -----------------------------------------------------------------------------

const BlurVignette = styled.div`
  --radius: 44px;
  --inset: 18px;
  --transition-length: 60px;
  --blur: 50px;


  position: absolute;
  inset: 0;
  border-radius: var(--radius);
  -webkit-backdrop-filter: blur(var(--blur));
  backdrop-filter: blur(var(--blur));
  --r: max(var(--transition-length), calc(var(--radius) - var(--inset)));
  --corner-size: calc(var(--r) + var(--inset)) calc(var(--r) + var(--inset));
  --corner-gradient: transparent 0px,
    transparent calc(var(--r) - var(--transition-length)), black var(--r);
  --fill-gradient: black, black var(--inset),
    transparent calc(var(--inset) + var(--transition-length)),
    transparent calc(100% - var(--transition-length) - var(--inset)),
    black calc(100% - var(--inset));
  --fill-narrow-size: calc(100% - (var(--inset) + var(--r)) * 2);
  --fill-farther-position: calc(var(--inset) + var(--r));
  -webkit-mask-image: linear-gradient(to right, var(--fill-gradient)),
    linear-gradient(to bottom, var(--fill-gradient)),
    radial-gradient(at bottom right, var(--corner-gradient)),
    radial-gradient(at bottom left, var(--corner-gradient)),
    radial-gradient(at top left, var(--corner-gradient)),
    radial-gradient(at top right, var(--corner-gradient));
  -webkit-mask-size: 100% var(--fill-narrow-size), var(--fill-narrow-size) 100%,
    var(--corner-size), var(--corner-size), var(--corner-size),
    var(--corner-size);
  -webkit-mask-position: 0 var(--fill-farther-position), var(--fill-farther-position) 0,
    0 0, 100% 0, 100% 100%, 0 100%;
  -webkit-mask-repeat: no-repeat;
`;

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

type EditCourseStructureProps = {
  orgslug: string;
  course_uuid?: string;
  tabs: CourseTab[];
  selectedTabId: string;
  onTabsChange: (tabs: CourseTab[]) => void;
  onTabChange: (tabId: string) => void;
  tabContent: {
    chapters: any[];
  };
  onTabContentChange: (tabId: string, chapters: any[]) => void;
};

const EditCourseStructure = (props: EditCourseStructureProps) => {
  const {
    tabs,
    selectedTabId,
    onTabsChange,
    onTabChange,
    tabContent,
    onTabContentChange,
  } = props;
  // Local state management ----------------------------------------------------
  const [chapterID, setChapterID] = useState(-1);
  const [winReady, setWinReady] = useState(false);
  const [newChapterModal, setNewChapterModal] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [order, setOrder] = useState<OrderPayload>();
  const [triggerAutoLayout, setTriggerAutoLayout] = useState(false);

  // External hooks ------------------------------------------------------------
  const router = useRouter();
  const session = useSokratesSession() as any;  const access_token = session?.data?.tokens?.access_token;

  const course = useCourse() as any;
  const course_structure = course ? course.courseStructure : {};
  const course_uuid = course ? course.courseStructure.course_uuid : '';
  const isSaving = Boolean(course?.isSaving);
  const dispatchCourse = useCourseDispatch() as any;
  const tabChapters = useMemo(() => tabContent?.chapters ?? [], [tabContent?.chapters]);
  const handleChapterRewardsChange = useCallback(
    (chapterId: number, xpReward: number, coinReward: number) => {
      const nextChapters = tabChapters.map((chapter: any) => {
        if (chapter.id !== chapterId) {
          return chapter;
        }
        return {
          ...chapter,
          xp_reward: xpReward,
          coin_reward: coinReward,
        };
      });
      onTabContentChange(selectedTabId, nextChapters);
      dispatchCourse({
        type: 'updateChapterRewardsDraft',
        payload: {
          chapterId,
          rewards: {
            xp_reward: xpReward,
            coin_reward: coinReward,
          },
        },
      });
    },
    [dispatchCourse, onTabContentChange, selectedTabId, tabChapters]
  );
  const currentChapter = tabChapters.find((c: any) => c.id === chapterID);
  const sidePanelOpen = winReady && currentChapter;

  const handleImportApplied = useCallback(async () => {
    try {
      if (course_uuid) {
        await mutate(`${getAPIUrl()}courses/${course_uuid}/meta`);
      }
      await revalidateTags(['courses'], props.orgslug);
      toast.success('Imported problems as new activities');
    } catch (error) {
      toast.error('Import applied, but refreshing the course failed.');
    } finally {
      setIsImportModalOpen(false);
      router.refresh();
    }
  }, [course_uuid, props.orgslug, router]);

  // Refs for ReactFlow instance and container
  const reactFlowRef = React.useRef<HTMLDivElement>(null) as React.MutableRefObject<HTMLDivElement | null>;
  const reactFlowInstanceRef = React.useRef<any>(null) as React.MutableRefObject<any>;

  // ---------------------------------------------------------------------------
  // CHAPTER CRUD OPERATIONS
  // ---------------------------------------------------------------------------

  const closeNewChapterModal = async () => setNewChapterModal(false);

  const submitChapter = async (chapter: any) => {
    const chapterPayload = {
      ...chapter,
      tab_uuid: selectedTabId,
    };
    await createChapter(chapterPayload, access_token);
    mutate(`${getAPIUrl()}courses/${course_uuid}/meta`);
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();
    setNewChapterModal(false);
    // Optimistic UI update so the node appears immediately
    const nextChapters = [
      ...tabChapters,
      {
        ...chapterPayload,
        activities: Array.isArray(chapter.activities) ? [...chapter.activities] : [],
      },
    ];
    onTabContentChange(selectedTabId, nextChapters);
  };

  const modifyChapterEdge = async (
    fromChapterID: number,
    toChapterID: number,
    deleteEdge: boolean,
  ) => {
    await updateChapterEdge(
      course_uuid,
      {
        from_chapter_id: fromChapterID,
        to_chapter_id: toChapterID,
        delete: deleteEdge,
      },
      access_token,
    );

    mutate(`${getAPIUrl()}courses/${course_uuid}/meta`);
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();

    const updatedChapters = tabChapters.map((chapter: any) => {
      if (chapter.id !== toChapterID) {
        return chapter;
      }
      const nextPredecessors = deleteEdge
        ? chapter.predecessors.filter((p: number) => p !== fromChapterID)
        : [...chapter.predecessors, fromChapterID];
      return {
        ...chapter,
        predecessors: Array.from(new Set(nextPredecessors)),
      };
    });
    onTabContentChange(selectedTabId, updatedChapters);
  };

  const deleteSelectedChapter = useCallback(async () => {
    if (!currentChapter) {
      return;
    }

    await deleteChapter(currentChapter.id, access_token);

    const remainingChapters = tabChapters
      .filter((chapter: any) => chapter.id !== currentChapter.id)
      .map((chapter: any) => ({
        ...chapter,
        predecessors: Array.isArray(chapter.predecessors)
          ? chapter.predecessors.filter(
              (predecessorId: number) => predecessorId !== currentChapter.id,
            )
          : [],
      }));

    onTabContentChange(selectedTabId, remainingChapters);
    setChapterID(-1);
    await mutate(`${getAPIUrl()}courses/${course_uuid}/meta`);
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();
  }, [
    access_token,
    course_uuid,
    currentChapter,
    onTabContentChange,
    props.orgslug,
    router,
    selectedTabId,
    tabChapters,
  ]);

  // ---------------------------------------------------------------------------
  // LEGACY DRAG‑AND‑DROP ORDERING (kept for list view)
  // ---------------------------------------------------------------------------

  const updateStructure = (result: any) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

  if (type === 'chapter') {
      const newChapterOrder = [...tabChapters];
      const [moved] = newChapterOrder.splice(source.index, 1);
      if (moved) {
        newChapterOrder.splice(destination.index, 0, moved);
        onTabContentChange(selectedTabId, newChapterOrder);
        dispatchCourse({ type: 'setIsNotSaved' });
      }
    }

    if (type === 'activity') {
      const newChapterOrder = tabChapters.map((chapter: any) => ({
        ...chapter,
        activities: [...(chapter.activities ?? [])],
      }));
      const sourceChapter = newChapterOrder.find((c: any) => c.chapter_uuid === source.droppableId) as any;
      const destinationChapter = newChapterOrder.find((c: any) => c.chapter_uuid === destination.droppableId) ?? sourceChapter;
      if (!sourceChapter || !destinationChapter) return;
      const activity = sourceChapter.activities.find((a: any) => a.activity_uuid === draggableId);
      if (!activity) return;
      sourceChapter.activities.splice(source.index, 1);
      destinationChapter.activities.splice(destination.index, 0, activity);
      onTabContentChange(selectedTabId, newChapterOrder);
      dispatchCourse({ type: 'setIsNotSaved' });
    }
  };

  // ---------------------------------------------------------------------------
  // GRAPH COMPONENT (ReactFlow + Dagre)
  // ---------------------------------------------------------------------------

  const CustomNode: React.FC<NodeProps> = (props: any) => (
    <div
      className={`flex flex-col items-center bg-white shadow-md rounded-lg p-4 transform -translate-x-1/2 hover:shadow-lg transition-shadow ${props.selected ? 'border-indigo-600 ring-4 ring-indigo-200 selected-node' : 'border-gray-200'} border`}
      style={{ minWidth: '180px', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
    >
      <p className="font-medium text-center text-gray-800">{props.data.label}</p>
      <Handle type="source" position={Position.Bottom} className="w-8 h-8 bg-indigo-500 border-2 border-white" style={{ bottom: '-16px' }} />
      <Handle type="target" position={Position.Top} className="w-8 h-8 bg-gray-400 border-2 border-white" style={{ top: '-16px' }} />
    </div>
  );

  const NewGraph = ({ chapters, setChapterID, chapterID, reactFlowRef, reactFlowInstanceRef, triggerAutoLayout }: DisplayGraphProps & { reactFlowRef: React.MutableRefObject<HTMLDivElement | null>, reactFlowInstanceRef: React.MutableRefObject<any>, triggerAutoLayout: boolean }) => {
    // ----------------------- Local state ------------------------------------
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<any>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<any>>([]);
    const [graphError, setGraphError] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [layoutApplied, setLayoutApplied] = useState(false);

    // ----------------------- Dagre helpers ----------------------------------
    const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    const nodeWidth = 180;
    const nodeHeight = 80;

    const getLayouted = (n: any[], e: any[]) => {
      dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 150, edgesep: 80 });
      n.forEach((node: any) => dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
      e.forEach((edge: any) => dagreGraph.setEdge(edge.source, edge.target));
      dagre.layout(dagreGraph);
      const layoutedNodes = n.map((node: any) => {
        const { x, y } = dagreGraph.node(node.id);
        return {
          ...node,
          targetPosition: Position.Top,
          sourcePosition: Position.Bottom,
          position: { x: x - nodeWidth / 2, y: y - nodeHeight / 2 },
        };
      });
      return { nodes: layoutedNodes, edges: e };
    };

    const onLayoutInternal = useCallback(() => {
      if (!nodes.length) return;
      const { nodes: lNodes, edges: lEdges } = getLayouted(nodes, edges);
      setIsAnimating(true);
      setNodes(lNodes);
      setEdges(lEdges);
      setLayoutApplied(true);
      setTimeout(() => setIsAnimating(false), 500);
    }, [edges, nodes, setEdges, setNodes]);

    // ----------------------- Effects ----------------------------------------

    // (re)build graph elements whenever chapter data changes
    useEffect(() => {
      const newNodes = chapters.map((c: any) => ({
        id: `${c.id}`,
        type: 'customNode',
        position: { x: 0, y: 0 },
        data: { label: c.name, id: c.id },
        draggable: true,
      }));

      const newEdges: any = [];
      chapters.forEach((c: any) => {
        (c.predecessors || []).forEach((p: number) =>
          newEdges.push({
            id: `${p}:${c.id}`,
            source: `${p}`,
            target: `${c.id}`,
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6366f1' },
            style: { strokeWidth: 3, stroke: '#6366f1' },
            animated: true,
          }),
        );
      });

      setNodes(newNodes);
      setEdges(newEdges);
    }, [chapters, setEdges, setNodes]);

    // Highlight selected node without rebuilding layout
    const highlightedNodes = useMemo(() =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === String(chapterID),
        className: `${isAnimating ? 'position-transition' : ''} ${n.id === String(chapterID) ? 'selected-node' : ''}`,
      })),
      [nodes, chapterID, isAnimating]
    );

    // trigger auto‑layout only once after nodes are ready OR after chapters changed
    useEffect(() => {
      if (!layoutApplied && nodes.length) onLayoutInternal();
    }, [layoutApplied, nodes, onLayoutInternal]);

    // trigger auto-layout when requested by parent (button click)
    useEffect(() => {
      if (triggerAutoLayout) {
        setLayoutApplied(false);
      }
    }, [triggerAutoLayout]);

    // ----------------------- ReactFlow handlers -----------------------------

    const hasRunRef = useRef(false);

    const onInit = (instance: any) => {
      (reactFlowInstanceRef as any).current = instance;
      // expose helpers for external toolbar
      if (reactFlowRef.current) {
        (reactFlowRef.current as any).onLayoutInternal = onLayoutInternal;
        (reactFlowRef.current as any).reactFlowInstanceRef = reactFlowInstanceRef;
      }
      // Only fitView on very first mount
      if (!hasRunRef.current) {
        instance.fitView({ duration: 400, padding: 0.2 });
        hasRunRef.current = true;
      }
    };

    const onNodeClick = (_: any, node: any) => setChapterID(Number(node.id));

    const onEdgesChangeWrapped = useCallback(
      async (params: any) => {
        const action = params[0];
        if (action.type !== 'remove') {
          onEdgesChange(params);
          return;
        }
        const [from, to] = action.id.split(':').map((v: string) => Number(v));
        await modifyChapterEdge(from, to, true);
        onEdgesChange(params);
      },
      [onEdgesChange],
    );

    const onConnect = useCallback(
      async (params: any) => {
        const fromID = Number(params.source);
        const toID = Number(params.target);
        try {
          await modifyChapterEdge(fromID, toID, false);
          setEdges((eds) =>
            addEdge(
              {
                ...params,
                markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6366f1' },
                animated: true,
                style: { strokeWidth: 3, stroke: '#6366f1' },
              },
              eds,
            ),
          );
        } catch (e: any) {
          if (e.message === 'Unprocessable Entity') {
            setGraphError('Cyclic dependency');
            setTimeout(() => setGraphError(null), 1000);
          }
        }
      },
      [setEdges],
    );

    const onNodesDelete = () => {} // prevent node deletion completely

    // ----------------------- Render -----------------------------------------

    return (
      <div className="h-full w-full" ref={reactFlowRef} data-graph-autolayout>
        <ReactFlow
          nodes={highlightedNodes}
          edges={edges}
          nodeTypes={useMemo(() => ({ customNode: CustomNode }), [])}
          onNodesChange={onNodesChange}
          onNodesDelete={onNodesDelete}
          onEdgesChange={onEdgesChangeWrapped}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onInit={onInit}
          nodesDraggable
          maxZoom={4}
          minZoom={1}
          style={{ borderRadius: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}
          proOptions={{ hideAttribution: true }}
        >
          {/* mini status indicator */}
          <div
            className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-2 shadow-sm border border-gray-100"
            title={graphError ?? 'Graph semantics are valid'}
          >
            <div
              className={`w-3 h-3 rounded-full ${graphError ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ boxShadow: graphError ? '0 0 8px rgba(239, 68, 68, 0.6)' : '0 0 8px rgba(16, 185, 129, 0.6)' }}
            />
            <span className="text-xs font-medium text-gray-600">{graphError ? 'Error' : 'Valid'}</span>
          </div>

          <MiniMap
            nodeColor={() => '#6366f1'}
            maskColor="rgba(99,102,241,0.1)"
            style={{ bottom: 16, right: 16, top: 'auto', background: 'rgba(255,255,255,0.8)', borderRadius: '0.75rem', border: '1px solid rgba(229,231,235,1)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#6366f1" />
        </ReactFlow>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // LIFECYCLE / RENDER LOGIC FOR MAIN COMPONENT
  // ---------------------------------------------------------------------------

  useEffect(() => setWinReady(true), [props.course_uuid, tabChapters, course]);

  useEffect(() => {
    if (!tabChapters.some((chapter: any) => chapter.id === chapterID)) {
      setChapterID(-1);
    }
  }, [tabChapters, chapterID]);

  if (!course) return <PageLoading />;

  return (
    <div className="relative flex h-full w-full overflow-hidden gap-6 px-6 py-6" data-selected-tab={selectedTabId}>
      <Card className="h-full w-96 shrink-0">
        <CardContent className="h-full overflow-hidden px-4 py-6">
          <CourseTabSelector
            className="h-full overflow-y-auto"
            tabs={tabs}
            activeTab={selectedTabId}
            onTabsChange={onTabsChange}
            onActiveTabChange={onTabChange}
            orientation="vertical"
            showVisibilityControls
            renderTabContent={() => null}
          />
        </CardContent>
      </Card>
      <div className="flex-1 overflow-hidden">
        {/* MAIN GRID */}
        <motion.div
          className="grid h-full w-full"
          animate={{ gridTemplateColumns: sidePanelOpen ? '1fr 0.6fr' : '1fr 0fr' }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          style={{ gridTemplateColumns: sidePanelOpen ? '1fr 0.6fr' : '1fr 0fr' }}
        >
          {/* GRAPH AREA */}
          <div className="relative h-full w-full bg-white">
            <NewGraph
              chapters={tabChapters}
              setChapterID={setChapterID}
              chapterID={chapterID}
              reactFlowRef={reactFlowRef}
              reactFlowInstanceRef={reactFlowInstanceRef}
              triggerAutoLayout={triggerAutoLayout}
            />

            {/* FLOATING TOOLBAR */}
            <div className="pointer-events-none absolute left-1/2 bottom-8 z-30 -translate-x-1/2">
              <div className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-xl rounded-2xl px-6 py-3 flex items-center gap-4 border border-gray-200 transition-all">
                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => reactFlowInstanceRef.current?.zoomOut?.()}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-l-md p-2 transition-all"
                    title="Zoom Out"
                  >
                    —
                  </button>
                  <button
                    onClick={() => reactFlowInstanceRef.current?.zoomIn?.()}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-r-md p-2 transition-all"
                    title="Zoom In"
                  >
                    +
                  </button>
                </div>
                {/* Fit view */}
                <button
                  onClick={() => reactFlowInstanceRef.current?.fitView?.({ duration: 300, padding: 0.2 })}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md p-2 transition-all"
                  title="Fit View"
                >
                  ⛶
                </button>
                {/* Auto layout */}
                <Button
                  variant="secondary"
                  onClick={() => setTriggerAutoLayout((v) => !v)}
                  className="hover:bg-indigo-100 font-medium rounded px-4 py-2 text-xs shadow transition-all"
                  title="Auto Layout"
                >
                  Auto Layout
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setIsImportModalOpen(true)}
                  className={`hover:bg-emerald-100 font-medium rounded px-4 py-2 text-xs shadow transition-all flex items-center gap-2${isSaving ? ' opacity-60 cursor-not-allowed' : ''}`}
                  title="Import course content"
                  disabled={isSaving}
                >
                  <Download strokeWidth={2} size={14} />
                  Import
                </Button>
                {/* Add chapter */}
                <Button
                  variant={"secondary"}
                  onClick={() => setNewChapterModal(true)}
                  className={`hover:bg-cyan-100 font-medium rounded px-4 py-2 text-xs shadow transition-all flex items-center gap-2${isSaving ? ' opacity-60 cursor-not-allowed' : ''}`}
                  disabled={isSaving}
                >
                  <Hexagon strokeWidth={2} size={14} className="" />
                  Add Chapter
                </Button>
              </div>
            </div>
          </div>

          {/* SIDE PANEL */}
          <AnimatePresence>
            {sidePanelOpen && (
              <motion.div
                key="side-panel"
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                className="relative h-full w-full bg-gray-100 border-l border-gray-200 shadow-xl flex flex-col"
                style={{ minWidth: 0 }}
              >
                <button
                  className="absolute top-4 right-4 z-50 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-full p-1 shadow"
                  onClick={() => setChapterID(-1)}
                >
                  <X></X>
                </button>
                <div className="p-10 h-full overflow-y-auto">
                  <div className="mb-4 flex justify-end pr-10">
                    <ConfirmationModal
                      confirmationButtonText="Delete Chapter"
                      confirmationMessage="Are you sure you want to delete this chapter?"
                      dialogTitle={`Delete ${currentChapter.name} ?`}
                      dialogTrigger={
                        <Button
                          variant="destructive"
                          className="flex items-center gap-2"
                        >
                          <Trash2 size={15} />
                          Delete Chapter
                        </Button>
                      }
                      functionToExecute={() => deleteSelectedChapter()}
                      status="warning"
                    />
                  </div>
                  <DragDropContext onDragEnd={updateStructure}>
                    <ChapterElement
                      key={currentChapter.chapter_uuid}
                      chapterIndex={0}
                      orgslug={props.orgslug}
                      course_uuid={course_uuid}
                      chapter={currentChapter}
                      onRewardsChange={handleChapterRewardsChange}
                      showDeleteAction={false}
                    />
                  </DragDropContext>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* IMPORT MODAL */}
      <Modal
        isDialogOpen={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        minHeight="md"
        minWidth="lg"
        dialogTitle="Import course content"
        dialogDescription="Provide a source URL to import chapters and map assets."
        dialogContent={
          <ImportCourseStructureDialog
            isOpen={isImportModalOpen}
            onCancel={() => setIsImportModalOpen(false)}
            courseUuid={course_uuid}
            tabUuid={selectedTabId}
            onApplied={handleImportApplied}
          />
        }
        dialogTrigger={null}
      />

      {/* NEW CHAPTER MODAL */}
      <Modal
        isDialogOpen={newChapterModal}
        onOpenChange={setNewChapterModal}
        minHeight="sm"
        dialogContent={<NewChapterModal course={course ? course.courseStructure : null} closeModal={closeNewChapterModal} submitChapter={submitChapter} />}
        dialogTitle="Create chapter"
        dialogDescription="Add a new chapter to the course"
        dialogTrigger={null}
      />
    </div>
  );
};

export default EditCourseStructure;
