import React, { useRef, useState, useReducer } from 'react';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext';
import { CourseMapEditorToolbar } from './EditCourseMapToolbar';
import { BarLoader } from 'react-spinners';
import dynamic from 'next/dynamic';
import { AssetData } from '@components/Objects/ContentMap/Asset/assetTypes';
import { SPRITES } from '@components/Dashboard/Pages/Course/EditCourseMap/spriteIndex';
import { SPRITE_SCALE_FACTOR } from '@components/Objects/ContentMap/constants';
import { LayoutState } from '@components/Objects/ContentMap/Canvas';
import { CourseTab, CourseTabSelector } from '@components/Objects/Modals/Course/Create/CourseTabSelector';
import { AnimatePresence, motion } from 'framer-motion';
import { X, PanelRightOpen, Download, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAPIUrl } from '@services/config/config';
const ContentMap = dynamic(() => import('components/Objects/ContentMap/Canvas'), { ssr: false });

export interface EditCourseMapProps {
    orgslug: string
    course_uuid?: string
    onChapterClick?: (chapterID: number) => void
    tabs: CourseTab[]
    selectedTabId: string
    onTabsChange: (tabs: CourseTab[]) => void
    onTabChange: (tabId: string) => void
    mapState: any
    onMapStateChange: (tabId: string, mapState: any) => void
}

function updateChapterStonesInContentMapState(oldState: AssetData[], chapters: any[]): AssetData[] {
    // if (!courseStructure || !courseStructure.chapters) return;
    
    const currentChapterNodes = oldState.filter(el => el.type && el.type.kind === 'chapter');
    const nonChapterNodes = oldState.filter(el => !el.type || el.type.kind !== 'chapter');

    const CHAPTER_SPRITE_LABEL = 'Stein blockiert.webp'
    const chapterSprite = SPRITES.find((sprite) => sprite.file === CHAPTER_SPRITE_LABEL)
    if (!chapterSprite) {
        throw("Chapter asset not found in sprite index; Index is likely corrupt.")
    }

    const newChapterNodes: AssetData[] = chapters
        .filter((chapter: any) =>
            !currentChapterNodes.some(el => el.type.associatedChapterID === chapter.id)
        )
        .map((chapter: any, index: number) => {
            const padding = 150;

            const offsetX = padding
            const offsetY = index * padding + padding
            const data: AssetData = {
                x: offsetX,
                y: offsetY,
                label: `${chapter.id}`,
                id: -chapter.id,
                scale: SPRITE_SCALE_FACTOR,
                file: chapterSprite.file,
                type: {
                    kind: "chapter",
                    associatedChapterID: chapter.id,
                    label: chapter.name,
                }
            };
            return data
        });

    const updatedChapterNodes = currentChapterNodes.filter(el =>
        chapters.find((chapter: any) => chapter.id === el.type.associatedChapterID)
    );

    const merged = [...nonChapterNodes, ...updatedChapterNodes, ...newChapterNodes];
    return merged

}

function createInitialLayout(mapState: any, chapters: any[]): AssetData[] {
    const layout = mapState?.objects ?? [];
    return updateChapterStonesInContentMapState(layout, chapters ?? []);
}

// Default boundaries
const DEFAULT_BOUNDARIES = {
    left: -1000,
    right: 1000,
    top: -1000,
    bottom: 1000
};

const JSON_FILE_TYPES = [
    {
        description: 'JSON Files',
        accept: {
            'application/json': ['.json'],
        },
    },
] as const;

// Reducer actions
const ACTIONS = {
    SET_LAYOUT: 'set_layout',
    UNDO: 'undo',
    REDO: 'redo',
    RESET: 'reset',
    SET_BOUNDARIES: 'set_boundaries',
    INIT: 'init',
};

// Types for reducer
interface LayoutHistoryState extends LayoutState {
    history: AssetData[][];
    historyIndex: number;
    boundaries?: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

type LayoutAction =
    | { type: 'init'; payload: { layout: AssetData[]; boundaries?: { left: number; right: number; top: number; bottom: number } } }
    | { type: 'set_layout'; payload: LayoutState }
    | { type: 'undo' }
    | { type: 'redo' }
    | { type: 'reset'; payload: AssetData[] }
    | { type: 'set_boundaries'; payload: { left: number; right: number; top: number; bottom: number } };


function layoutReducer(state: LayoutHistoryState, action: LayoutAction): LayoutHistoryState {
    switch (action.type) {
        case 'init': {
            return {
                ...state,
                layout: action.payload.layout,
                boundaries: action.payload.boundaries || DEFAULT_BOUNDARIES,
                history: [action.payload.layout],
                historyIndex: 0,
            };
        }
        case 'set_layout': {
            // Only push to history if updateOriginator is 'user'
            if (action.payload.updateOriginator !== 'user' || !action.payload.layout) {
                return {
                    ...state,
                    ...action.payload,
                };
            }
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push([...action.payload.layout]);
            return {
                ...state,
                ...action.payload,
                history: newHistory,
                historyIndex: newHistory.length - 1,
            };
        }
        case 'set_boundaries': {
            if (state.boundaries && 
                state.boundaries.left === action.payload.left &&
                state.boundaries.right === action.payload.right &&
                state.boundaries.top === action.payload.top &&
                state.boundaries.bottom === action.payload.bottom) {
                return state;
            }
            
            return {
                ...state,
                boundaries: action.payload,
                updateOriginator: 'user',
            };
        }
        case 'undo': {
            if (state.historyIndex > 0) {
                const newIndex = state.historyIndex - 1;
                return {
                    ...state,
                    layout: state.history[newIndex],
                    updateOriginator: 'user',
                    historyIndex: newIndex,
                };
            }
            return state;
        }
        case 'redo': {
            if (state.historyIndex < state.history.length - 1) {
                const newIndex = state.historyIndex + 1;
                return {
                    ...state,
                    layout: state.history[newIndex],
                    updateOriginator: 'user',
                    historyIndex: newIndex,
                };
            }
            return state;
        }
        default:
            return state;
    }
}

const EditCourseMap: React.FC<EditCourseMapProps> = (props) => {
    const {
        tabs,
        selectedTabId,
        onTabsChange,
        onTabChange,
        mapState,
        onMapStateChange,
    } = props;
    const session = useSokratesSession() as any;
    const access_token = session?.data?.tokens?.access_token
    const course = useCourse() as any
    const { isLoading, courseStructure } = course as any
    const dispatchCourse = useCourseDispatch() as any
    const onMapUpdateCallbackRef = useRef<Function | undefined>(undefined)
    const [showGrid, setShowGrid] = React.useState<boolean>(true)
    const [snapToGrid, setSnapToGrid] = React.useState<boolean>(true)
    const [gridGranularity, setGridGranularity] = React.useState<number>(5)
    const [clampToMap, setClampToMap] = React.useState<boolean>(true)
    const [assetPanelOpen, setAssetPanelOpen] = useState(false)
    const [customSprites, setCustomSprites] = useState<{ file: string; label: string; scale: number; sourceUrl: string; previewSrc?: string }[]>([])
    const [customSpriteUrl, setCustomSpriteUrl] = useState<string>('')
    const [customSpriteLabel, setCustomSpriteLabel] = useState<string>('')
    const [customSpriteError, setCustomSpriteError] = useState<string | null>(null)
    const lastInitializedTabRef = React.useRef<string | null>(null);
    const lastInitializedMapSignatureRef = React.useRef<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    // Initial state for reducer
    const [state, dispatch] = useReducer(layoutReducer, {
        layout: null,
        updateOriginator: 'initial',
        boundaries: DEFAULT_BOUNDARIES,
        history: [],
        historyIndex: -1,
    } as LayoutHistoryState);

    // Initialize layout and history when courseStructure is loaded (only on first load or course change)
    React.useEffect(() => {
        if (isLoading) return;
        if (!mapState) return;
        const mapSignature = [
            selectedTabId,
            Array.isArray(mapState?.objects) ? mapState.objects.length : '0',
            mapState?.boundaries
                ? `${mapState.boundaries.left}:${mapState.boundaries.right}:${mapState.boundaries.top}:${mapState.boundaries.bottom}`
                : 'default',
        ].join('|');

        if (lastInitializedMapSignatureRef.current === mapSignature) {
            return;
        }

        lastInitializedTabRef.current = selectedTabId;
        lastInitializedMapSignatureRef.current = mapSignature;

        const initialLayout = createInitialLayout(mapState, courseStructure?.chapters ?? []);
        let boundaries = mapState?.boundaries;

        if (
            !boundaries &&
            (mapState?.worldWidth || mapState?.worldHeight)
        ) {
            const width = mapState?.worldWidth || 2000;
            const height = mapState?.worldHeight || 2000;
            boundaries = {
                left: -width / 2,
                right: width / 2,
                top: -height / 2,
                bottom: height / 2,
            };
        }

        dispatch({
            type: 'init',
            payload: {
                layout: initialLayout,
                boundaries: boundaries || DEFAULT_BOUNDARIES,
            },
        });
    }, [isLoading, mapState, courseStructure?.chapters, selectedTabId]);

    React.useEffect(() => {
        if (!mapState) return;
        onMapUpdateCallbackRef.current = (mapData: AssetData[]) => {
            const nextMap = {
                ...mapState,
                objects: mapData,
            };
            onMapStateChange(selectedTabId, nextMap);
            dispatchCourse({ type: 'setIsNotSaved' });
        };
    }, [mapState, onMapStateChange, selectedTabId, dispatchCourse]);

    const mapProxyBaseUrl = React.useMemo(() => {
        const apiBase = getAPIUrl();
        if (!apiBase || apiBase === 'error') {
            return '/api/v1/mapProxy';
        }
        const normalizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
        return `${normalizedBase}/mapProxy`;
    }, []);

    const normalizeRemoteUrl = React.useCallback((input: string) => {
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

    const extractRemoteFromProxy = React.useCallback((maybeProxyUrl: string): string | null => {
        const marker = 'mapProxy';
        if (!maybeProxyUrl.includes(marker)) {
            return null;
        }
        const queryIndex = maybeProxyUrl.indexOf('url=');
        if (queryIndex === -1) {
            return null;
        }
        const after = maybeProxyUrl.substring(queryIndex + 4);
        const endIndex = after.indexOf('&');
        const encoded = endIndex === -1 ? after : after.substring(0, endIndex);
        try {
            return decodeURIComponent(encoded);
        } catch (_error) {
            return null;
        }
    }, []);

    const filenameFromUrl = React.useCallback((url: string | undefined) => {
        if (!url) return undefined;
        try {
            const parsed = new URL(url);
            const segments = parsed.pathname.split('/').filter(Boolean);
            if (segments.length === 0) {
                return undefined;
            }
            const last = segments[segments.length - 1];
            return last ? last.split('?')[0] : undefined;
        } catch (_error) {
            return undefined;
        }
    }, []);

    const ensureFilenameWithExtension = React.useCallback((filename: string | undefined, label?: string) => {
        const ALLOWED_EXTENSION = /\.(png|jpe?g|gif|webp|svg)$/i;
        if (filename) {
            const trimmed = filename.trim();
            if (trimmed.length > 0) {
                if (ALLOWED_EXTENSION.test(trimmed)) {
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

    const toProxiedAssetUrl = React.useCallback((file: string, options?: { sourceUrl?: string; label?: string }) => {
        if (!file) return file;

        const alreadyProxy =
            file.includes('/mapProxy?url=') ||
            (file.includes('/mapProxy/') && file.includes('?url='));

        const candidateSource = options?.sourceUrl || (alreadyProxy ? extractRemoteFromProxy(file) : undefined);

        const normalizedSource = candidateSource
            ? normalizeRemoteUrl(candidateSource)
            : normalizeRemoteUrl(file);

        const isRemote = /^(https?:)?\/\//i.test(normalizedSource);

        if (!isRemote) {
            return file;
        }

        if (!mapProxyBaseUrl) {
            return normalizedSource;
        }

        const filenameCandidate = filenameFromUrl(normalizedSource);
        const safeFilename = ensureFilenameWithExtension(filenameCandidate, options?.label);
        const proxiedUrl = `${mapProxyBaseUrl}/${encodeURIComponent(safeFilename)}?url=${encodeURIComponent(normalizedSource)}`;

        if (alreadyProxy && proxiedUrl === file) {
            return file;
        }

        return proxiedUrl;
    }, [mapProxyBaseUrl, extractRemoteFromProxy, normalizeRemoteUrl, filenameFromUrl, ensureFilenameWithExtension]);

    const resolveAssetPath = React.useCallback((file: string) => {
        if (!file) return file;

        const trimmed = file.trim();
        if (!trimmed) return trimmed;

        if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
            return trimmed;
        }
        if (trimmed.includes('/mapProxy?url=') || trimmed.includes('/mapProxy/')) {
            return trimmed;
        }
        if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('//')) {
            return toProxiedAssetUrl(trimmed);
        }

        const withoutDotPrefix = trimmed.replace(/^\.\/+/, '');
        if (withoutDotPrefix.startsWith('/')) {
            return withoutDotPrefix;
        }
        if (withoutDotPrefix.startsWith('contentMap/')) {
            return `/${withoutDotPrefix}`;
        }

        return `/contentMap/${withoutDotPrefix}`;
    }, [toProxiedAssetUrl]);

    React.useEffect(() => {
        if (!state.layout || state.layout.length === 0) {
            return;
        }
        let requiresUpdate = false;
        const proxiedLayout = state.layout.map((asset) => {
            const effectiveSourceUrl = asset.sourceUrl || extractRemoteFromProxy(asset.file) || undefined;
            const proxiedFile = toProxiedAssetUrl(asset.file, {
                sourceUrl: effectiveSourceUrl,
                label: asset.label,
            });
            if (proxiedFile !== asset.file || (!asset.sourceUrl && effectiveSourceUrl)) {
                requiresUpdate = true;
                return {
                    ...asset,
                    file: proxiedFile,
                    sourceUrl: effectiveSourceUrl ?? asset.sourceUrl,
                };
            }
            return asset;
        });
        if (requiresUpdate) {
            dispatch({
                type: 'set_layout',
                payload: {
                    layout: proxiedLayout,
                    updateOriginator: 'initial',
                    boundaries: state.boundaries,
                },
            });
        }
    }, [state.layout, state.boundaries, toProxiedAssetUrl, extractRemoteFromProxy]);

    // Call update callback when layout changes (for saving)
    React.useEffect(() => {
        if (state.layout && state.updateOriginator === 'user' && onMapUpdateCallbackRef.current) {
            onMapUpdateCallbackRef.current(state.layout)
        }
    }, [state.layout, state.updateOriginator])

    // Call update callback when boundaries change (for saving)
    React.useEffect(() => {
        if (!mapState || !state.boundaries) return;
        if (state.updateOriginator !== 'user') return;
        const currentBoundaries = mapState?.boundaries;
        if (
            currentBoundaries &&
            currentBoundaries.left === state.boundaries.left &&
            currentBoundaries.right === state.boundaries.right &&
            currentBoundaries.top === state.boundaries.top &&
            currentBoundaries.bottom === state.boundaries.bottom
        ) {
            return;
        }
        const nextMap = {
            ...mapState,
            boundaries: state.boundaries,
        };
        onMapStateChange(selectedTabId, nextMap);
        dispatchCourse({ type: 'setIsNotSaved' });
    }, [state.boundaries, state.updateOriginator, mapState, onMapStateChange, selectedTabId, dispatchCourse]);

    // Custom setLayout function to be passed to Canvas
    const setLayout = (updater: LayoutState | ((prev: LayoutState) => LayoutState)) => {
        if (typeof updater === 'function') {
            // updater is a function (prevState => newState)
            dispatch({
                type: 'set_layout',
                payload: updater({
                    layout: state.layout,
                    updateOriginator: 'user',
                    boundaries: state.boundaries,
                })
            })
        } else {
            // updater is a direct value
            dispatch({
                type: 'set_layout',
                payload: updater
            })
        }
    }

    const deriveLabelFromUrl = React.useCallback((url: string) => {
        try {
            const parsed = new URL(url);
            const pathSegments = parsed.pathname.split('/').filter(Boolean);
            const filename = pathSegments[pathSegments.length - 1] ?? '';
            if (filename) {
                return filename.split('?')[0];
            }
            return parsed.hostname;
        } catch (_error) {
            return url;
        }
    }, []);

    const sanitizeImportedMap = React.useCallback((candidate: any) => {
        if (!candidate || typeof candidate !== 'object') {
            throw new Error('Invalid map export: expected an object.');
        }

        const objects = Array.isArray(candidate.objects) ? candidate.objects : [];
        const rawBoundaries = candidate.boundaries || {};

        const normalizedBoundaries = {
            left:
                typeof rawBoundaries.left === 'number'
                    ? rawBoundaries.left
                    : DEFAULT_BOUNDARIES.left,
            right:
                typeof rawBoundaries.right === 'number'
                    ? rawBoundaries.right
                    : DEFAULT_BOUNDARIES.right,
            top:
                typeof rawBoundaries.top === 'number'
                    ? rawBoundaries.top
                    : DEFAULT_BOUNDARIES.top,
            bottom:
                typeof rawBoundaries.bottom === 'number'
                    ? rawBoundaries.bottom
                    : DEFAULT_BOUNDARIES.bottom,
        };

        return {
            objects,
            boundaries: normalizedBoundaries,
        };
    }, []);

    const handleExportMap = React.useCallback(async () => {
        if (!state.layout) {
            return;
        }

        const payload = {
            objects: state.layout,
            boundaries: state.boundaries || DEFAULT_BOUNDARIES,
        };

        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const suggestedName = `content-map-${selectedTabId || 'tab'}.json`;

        if (typeof window === 'undefined') {
            return;
        }

        const anyWindow = window as typeof window & {
            showSaveFilePicker?: (options?: any) => Promise<any>;
        };

        try {
            if (anyWindow.showSaveFilePicker) {
                const handle = await anyWindow.showSaveFilePicker({
                    suggestedName,
                    types: JSON_FILE_TYPES,
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = suggestedName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                return;
            }
            console.error('Failed to export map', error);
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('Export failed. Please try again.');
            }
        }
    }, [state.layout, state.boundaries, selectedTabId]);

    const processImportedMapFile = React.useCallback(
        async (file: File) => {
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                const { objects, boundaries } = sanitizeImportedMap(parsed);
                dispatch({
                    type: 'set_layout',
                    payload: {
                        layout: objects,
                        boundaries,
                        updateOriginator: 'user',
                    },
                });
            } catch (error) {
                console.error('Failed to import map', error);
                if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                    window.alert('Import failed. Please ensure the file is a valid JSON export.');
                }
            }
        },
        [sanitizeImportedMap, dispatch],
    );

    const handleImportMap = React.useCallback(async () => {
        if (typeof window === 'undefined') {
            return;
        }

        const anyWindow = window as typeof window & {
            showOpenFilePicker?: (options?: any) => Promise<any[]>;
        };

        if (anyWindow.showOpenFilePicker) {
            try {
                const handles = await anyWindow.showOpenFilePicker({
                    multiple: false,
                    excludeAcceptAllOption: true,
                    types: JSON_FILE_TYPES,
                });
                if (handles && handles.length > 0) {
                    const file = await handles[0].getFile();
                    await processImportedMapFile(file);
                }
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    return;
                }
                console.error('Failed to open map file', error);
                if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                    window.alert('Selecting a map JSON failed. Please try again.');
                }
            }
        } else if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    }, [processImportedMapFile, fileInputRef]);

    const handleImportInputChange = React.useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            await processImportedMapFile(file);
            event.target.value = '';
        },
        [processImportedMapFile],
    );

    const handleCustomSpriteSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedUrl = customSpriteUrl.trim();
        const trimmedLabel = customSpriteLabel.trim();

        if (!trimmedUrl) {
            setCustomSpriteError('Please provide an image URL.');
            return;
        }

        const isRemoteUrl = /^(https?:)?\/\//i.test(trimmedUrl);
        const isDataOrBlob = trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('blob:');

        if (!isRemoteUrl && !isDataOrBlob) {
            setCustomSpriteError('Only http(s), protocol-relative, data, or blob URLs are supported.');
            return;
        }

        const protocol =
            typeof window !== 'undefined' && window.location?.protocol
                ? window.location.protocol
                : 'https:';

        const normalizedRemoteUrl =
            isRemoteUrl && trimmedUrl.startsWith('//') ? `${protocol}${trimmedUrl}` : trimmedUrl;

        const sourceUrlKey = isRemoteUrl ? normalizedRemoteUrl : trimmedUrl;

        let spriteFile = trimmedUrl;
        const spriteLabel = trimmedLabel || deriveLabelFromUrl(sourceUrlKey);

        if (isRemoteUrl) {
            const proxiedUrl = toProxiedAssetUrl(normalizedRemoteUrl, {
                sourceUrl: normalizedRemoteUrl,
                label: spriteLabel,
            });
            if (!proxiedUrl.includes('mapProxy')) {
                setCustomSpriteError('Proxy endpoint is not configured. Please contact support.');
                return;
            }
            try {
                if (typeof window === 'undefined') {
                    setCustomSpriteError('Custom asset proxy can only be used in a browser context.');
                    return;
                }

                const response = await window.fetch(proxiedUrl, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                });

                if (!response.ok) {
                    setCustomSpriteError(`Could not fetch the image (status ${response.status}).`);
                    return;
                }

                const contentType = response.headers.get('content-type');
                if (contentType && !contentType.toLowerCase().startsWith('image/')) {
                    setCustomSpriteError('The provided URL does not point to an image resource.');
                    return;
                }

                await response.blob();
            } catch (error) {
                console.error('Failed to proxy asset', error);
                setCustomSpriteError('Failed to proxy the provided URL. Please verify the address and try again.');
                return;
            }

            spriteFile = proxiedUrl;
        }

        setCustomSprites((prev) => {
            if (prev.some(sprite => sprite.sourceUrl === sourceUrlKey || sprite.file === spriteFile)) {
                setCustomSpriteError('This URL has already been added.');
                return prev;
            }
            const previewSrc = toProxiedAssetUrl(sourceUrlKey, {
                sourceUrl: sourceUrlKey,
                label: spriteLabel,
            });
            const next = [
                {
                    file: spriteFile,
                    label: spriteLabel,
                    scale: 1,
                    sourceUrl: sourceUrlKey,
                    previewSrc,
                },
                ...prev,
            ];
            setCustomSpriteError(null);
            setCustomSpriteUrl('');
            setCustomSpriteLabel('');
            return next;
        });
    }, [customSpriteUrl, customSpriteLabel, deriveLabelFromUrl, toProxiedAssetUrl]);

    const allSprites = React.useMemo(() => [
        ...customSprites,
        ...SPRITES,
    ], [customSprites]);

    const assetBrowserSprites = React.useMemo(() => {
        return allSprites.map((sprite) => {
            const effectiveSourceUrl = sprite.sourceUrl || extractRemoteFromProxy(sprite.file) || undefined;
            const proxiedFile = toProxiedAssetUrl(sprite.file, {
                sourceUrl: effectiveSourceUrl,
                label: sprite.label,
            });
            const previewSrc = effectiveSourceUrl
                ? toProxiedAssetUrl(effectiveSourceUrl, {
                    sourceUrl: effectiveSourceUrl,
                    label: sprite.label,
                })
                : undefined;

            if (proxiedFile === sprite.file && previewSrc === sprite.previewSrc) {
                return sprite;
            }

            return {
                ...sprite,
                file: proxiedFile,
                previewSrc,
            };
        });
    }, [allSprites, toProxiedAssetUrl, extractRemoteFromProxy]);

    function resetLayout() {
        const resetted = updateChapterStonesInContentMapState([], courseStructure.chapters)
        setLayout({
            layout: resetted,
            updateOriginator: 'user',
            boundaries: state.boundaries,
        })
    }

    const handleBoundariesChange = (newBoundaries: { left: number; right: number; top: number; bottom: number }) => {
        dispatch({ 
            type: 'set_boundaries', 
            payload: newBoundaries 
        });
    }

    const handleUndo = () => dispatch({ type: 'undo' })
    const handleRedo = () => dispatch({ type: 'redo' })
    const handleGridToggle = (showGrid: boolean) => setShowGrid(showGrid)
    const handleSnapToggle = (snapToGrid: boolean) => setSnapToGrid(snapToGrid)
    const handleGridGranularityChange = (value: number) => setGridGranularity(value)
    const handleClampToMapChange = (clampToMap: boolean) => setClampToMap(clampToMap)

    const layoutForActiveTab = React.useMemo(() => {
        return state;
    }, [state]);

    if (!onMapUpdateCallbackRef.current || !state.layout) {
        return (<div className='bg-black flex flex-col items-center justify-center h-full'>
            <BarLoader
                width={600}
                height={10}
                color="#ffffff"
                cssOverride={{ 'borderRadius': '3rem' }}
            >
            </BarLoader>
        </div>)
    } else {
        return (
            <div className="relative h-full w-full overflow-hidden" data-selected-tab={selectedTabId}>
                {/* Top-right button to open asset browser */}
                <button
                    className="absolute top-6 right-8 z-30 bg-white/80 hover:bg-white/90 border border-gray-200 shadow-lg rounded-full p-2 transition-all"
                    onClick={() => setAssetPanelOpen(true)}
                    style={{ display: assetPanelOpen ? 'none' : 'block' }}
                >
                    <PanelRightOpen className="w-6 h-6 text-gray-700" />
                </button>
                {/* Canvas/ContentMap - always full size */}
                <div className="relative bg-neutral-100 h-full w-full flex gap-6 px-6 py-6">
                    <Card className="h-full w-64 shrink-0">
                        <CardContent className="h-full overflow-hidden px-4 py-6">
                            <CourseTabSelector
                                className="h-full overflow-y-auto"
                                tabs={tabs}
                                activeTab={selectedTabId}
                                onTabsChange={onTabsChange}
                                onActiveTabChange={onTabChange}
                                orientation="vertical"
                                renderTabContent={() => null}
                            />
                        </CardContent>
                    </Card>

                    <div className="relative flex flex-1 flex-col">
                        <ContentMap
                            layout={layoutForActiveTab}
                            setLayout={setLayout}
                            readOnly={false}
                            showGrid={showGrid}
                            snapToGrid={snapToGrid}
                            gridGranularity={gridGranularity}
                            clampToMap={clampToMap}
                            undoRedo={{
                                undo: handleUndo,
                                redo: handleRedo
                            }}
                            onChapterClick={() => { }}
                        />
                        {/* Floating toolbar at bottom center */}
                        <div className="pointer-events-none absolute left-1/2 bottom-8 z-20 -translate-x-1/2">
                            <div className="pointer-events-auto bg-white/80 backdrop-blur-md shadow-xl rounded-2xl px-6 py-3 flex items-center gap-4 border border-gray-200">
                                <CourseMapEditorToolbar
                                    undo={handleUndo}
                                    redo={handleRedo}
                                    reset={resetLayout}
                                    boundaries={state.boundaries}
                                    onBoundariesChange={handleBoundariesChange}
                                    showGrid={showGrid}
                                    onShowGridChange={handleGridToggle}
                                    snapToGrid={snapToGrid}
                                    onSnapToGridChange={handleSnapToggle}
                                    gridGranularity={gridGranularity}
                                    onGridGranularityChange={handleGridGranularityChange}
                                    clampToMap={clampToMap}
                                    onClampToMapChange={handleClampToMapChange}
                                    canUndo={state.historyIndex > 0}
                                    canRedo={state.historyIndex < state.history.length - 1}
                                />
                                <div className="h-8 w-px bg-gray-200" />
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExportMap}
                                        className="gap-2"
                                    >
                                        <Download className="h-4 w-4" />
                                        Export
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleImportMap}
                                        className="gap-2"
                                    >
                                        <Upload className="h-4 w-4" />
                                        Import
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportInputChange}
                />
                {/* Asset browser panel as overlay */}
                <AnimatePresence>
                    {assetPanelOpen && (
                        <motion.div
                            initial={{ x: 400, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 400, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 30 }}
                            className="absolute top-0 right-0 h-full w-[350px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col"
                            style={{ minWidth: 0 }}
                        >
                            <button
                                className="absolute top-4 right-4 z-50 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-full p-1 shadow"
                                onClick={() => setAssetPanelOpen(false)}
                            >
                                <X className="w-5 h-5 text-gray-700" />
                            </button>
                            <div className="p-6 border-b space-y-4">
                                <div>
                                    <h3 className="text-lg font-semibold">Asset Browser</h3>
                                    <p className="text-xs text-gray-500">
                                        Drag assets onto the map or add your own image via URL.
                                    </p>
                                </div>
                                <form onSubmit={handleCustomSpriteSubmit} className="space-y-3">
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="custom-asset-url"
                                            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                        >
                                            Image URL
                                        </label>
                                        <input
                                            id="custom-asset-url"
                                            type="url"
                                            value={customSpriteUrl}
                                            onChange={(event) => {
                                                setCustomSpriteUrl(event.target.value);
                                                if (customSpriteError) setCustomSpriteError(null);
                                            }}
                                            placeholder="https://example.com/asset.png"
                                            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="custom-asset-label"
                                            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                        >
                                            Label (optional)
                                        </label>
                                        <input
                                            id="custom-asset-label"
                                            type="text"
                                            value={customSpriteLabel}
                                            onChange={(event) => {
                                                setCustomSpriteLabel(event.target.value);
                                                if (customSpriteError) setCustomSpriteError(null);
                                            }}
                                            placeholder="My custom asset"
                                            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={!customSpriteUrl.trim()}
                                    >
                                        Add image to browser
                                    </button>
                                    {customSpriteError && (
                                        <p className="text-xs text-red-500">{customSpriteError}</p>
                                    )}
                                </form>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 80px)' }}>
                                <div className="grid grid-cols-2 gap-4">
                                    {assetBrowserSprites.map((sprite, idx) => (
                                        <div
                                            key={`${sprite.file}-${idx}`}
                                            draggable
                                            onDragStart={e => {
                                                e.dataTransfer.setData("application/json", JSON.stringify(sprite))
                                            }}
                                            className="group flex flex-col items-center p-2 rounded-lg border bg-gray-50 hover:border-primary transition-colors cursor-grab active:cursor-grabbing shadow-sm"
                                        >
                                            <div className="relative w-full aspect-square flex items-center justify-center mb-1 bg-muted/40 rounded overflow-hidden">
                                                <img
                                                    src={sprite.previewSrc ?? resolveAssetPath(sprite.file)}
                                                    alt={sprite.label}
                                                    className="object-contain max-h-full max-w-full group-hover:scale-105 transition-transform"
                                                    style={{ filter: "saturate(120%)" }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium truncate w-full text-center text-muted-foreground group-hover:text-foreground">
                                                {sprite.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )
    }
}

export default EditCourseMap
