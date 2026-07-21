import {
  MAP_VIEW_STORAGE_KEY,
  type MapViewState,
} from "./types";

export function saveMapView(view: MapViewState): void {
  try {
    sessionStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {

  }
}

export function loadMapView(): MapViewState | null {
  try {
    const raw = sessionStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MapViewState;
  } catch {
    return null;
  }
}

export function clearMapView(): void {
  try {
    sessionStorage.removeItem(MAP_VIEW_STORAGE_KEY);
  } catch {

  }
}
