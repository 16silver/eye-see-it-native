import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type CaptureDecisionMode = 'auto' | 'force-new' | 'force-existing';

export interface CapturePolicy {
  timeWindowMinutes: number;
  distanceThresholdMeters: number;
  mode: CaptureDecisionMode;
}

export interface GeoPoint { lat: number; lng: number }

export interface CaptureMeta {
  lastExhibitionId: string | null;
  lastCaptureAt: number | null; // epoch ms
  lastLocation: GeoPoint | null;
}

export const DEFAULT_CAPTURE_POLICY: CapturePolicy = {
  timeWindowMinutes: 120,
  distanceThresholdMeters: 200,
  mode: 'auto',
};

const POLICY_KEY = '@capture_policy_v1';
const META_KEY = '@capture_meta_v1';

export async function loadCapturePolicy(): Promise<CapturePolicy> {
  try {
    const raw = await AsyncStorage.getItem(POLICY_KEY);
    if (!raw) return DEFAULT_CAPTURE_POLICY;
    const p = JSON.parse(raw);
    return {
      timeWindowMinutes: Number(p.timeWindowMinutes) || DEFAULT_CAPTURE_POLICY.timeWindowMinutes,
      distanceThresholdMeters: Number(p.distanceThresholdMeters) || DEFAULT_CAPTURE_POLICY.distanceThresholdMeters,
      mode: (p.mode as CaptureDecisionMode) || DEFAULT_CAPTURE_POLICY.mode,
    };
  } catch {
    return DEFAULT_CAPTURE_POLICY;
  }
}

export async function saveCapturePolicy(p: CapturePolicy): Promise<void> {
  await AsyncStorage.setItem(POLICY_KEY, JSON.stringify(p));
}

export async function loadCaptureMeta(): Promise<CaptureMeta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return { lastExhibitionId: null, lastCaptureAt: null, lastLocation: null };
    const m = JSON.parse(raw);
    return {
      lastExhibitionId: m.lastExhibitionId ?? null,
      lastCaptureAt: typeof m.lastCaptureAt === 'number' ? m.lastCaptureAt : null,
      lastLocation: m.lastLocation && typeof m.lastLocation.lat === 'number' && typeof m.lastLocation.lng === 'number'
        ? { lat: m.lastLocation.lat, lng: m.lastLocation.lng }
        : null,
    };
  } catch {
    return { lastExhibitionId: null, lastCaptureAt: null, lastLocation: null };
  }
}

export async function saveCaptureMeta(meta: CaptureMeta): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

export async function updateCaptureMeta(exhibitionId: string, location: GeoPoint | null): Promise<void> {
  const now = Date.now();
  const meta: CaptureMeta = {
    lastExhibitionId: exhibitionId,
    lastCaptureAt: now,
    lastLocation: location ?? null,
  };
  await saveCaptureMeta(meta);
}

export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000; // meters
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon));
  return R * c;
}

export async function getCurrentLocation(timeoutMs = 8000): Promise<GeoPoint | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        return await new Promise<GeoPoint | null>((resolve) => {
          const onOk = (pos: GeolocationPosition) => {
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          };
          const onErr = () => resolve(null);
          navigator.geolocation.getCurrentPosition(onOk, onErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: timeoutMs });
        });
      }
      return null;
    }
    // Native: expo-location (optionally available)
    let Loc: any;
    try {
      Loc = require('expo-location');
    } catch {
      return null;
    }
    const { status } = await Loc.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Loc.getCurrentPositionAsync({ accuracy: Loc.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function shouldCreateNewExhibition(params: {
  policy: CapturePolicy;
  lastCaptureAt: number | null;
  lastLocation: GeoPoint | null;
  currentLocation: GeoPoint | null;
  now?: number;
}): boolean {
  const { policy, lastCaptureAt, lastLocation, currentLocation } = params;
  const now = params.now ?? Date.now();
  const thresholdMs = policy.timeWindowMinutes * 60 * 1000;

  const timeOk = typeof lastCaptureAt === 'number' && now - lastCaptureAt <= thresholdMs;
  let distanceOk = true; // if we don't know locations, don't force new by distance
  if (lastLocation && currentLocation) {
    const d = haversineDistanceMeters(lastLocation, currentLocation);
    distanceOk = d <= policy.distanceThresholdMeters;
  }
  // Case 2: within time window AND not far -> append; else create new (Case 3)
  const appendToExisting = timeOk && distanceOk;
  return !appendToExisting;
}

export function pickExistingExhibitionId(exhibitions: Array<{ id: string; updatedAt?: string; createdAt?: string }>, fallbackId?: string | null): string | null {
  if (fallbackId) return fallbackId;
  if (!exhibitions || exhibitions.length === 0) return null;
  const sorted = [...exhibitions].sort((a, b) => {
    const au = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bu = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bu - au;
  });
  return sorted[0]?.id ?? null;
}

export async function decideTargetExhibition(options: {
  exhibitions: Array<{ id: string; updatedAt?: string; createdAt?: string }>;
  policy: CapturePolicy;
  meta: CaptureMeta;
  currentLocation: GeoPoint | null;
  explicitTargetId?: string | null; // when user explicitly chose an exhibition
}): Promise<{ targetExhibitionId: string | null; createNew: boolean }> {
  const { exhibitions, policy, meta, currentLocation, explicitTargetId } = options;
  if (explicitTargetId) {
    return { targetExhibitionId: explicitTargetId, createNew: false };
  }
  if (!exhibitions || exhibitions.length === 0) {
    return { targetExhibitionId: null, createNew: true };
  }
  if (policy.mode === 'force-new') return { targetExhibitionId: null, createNew: true };
  if (policy.mode === 'force-existing') {
    const id = pickExistingExhibitionId(exhibitions, meta.lastExhibitionId);
    return { targetExhibitionId: id, createNew: !id };
  }
  const createNew = shouldCreateNewExhibition({
    policy,
    lastCaptureAt: meta.lastCaptureAt,
    lastLocation: meta.lastLocation,
    currentLocation,
  });
  if (createNew) return { targetExhibitionId: null, createNew: true };
  const id = pickExistingExhibitionId(exhibitions, meta.lastExhibitionId);
  return { targetExhibitionId: id, createNew: !id };
}


