// Web map: MapLibre GL + free OpenStreetMap raster tiles (no API key, no billing).
// Metro resolves this .web variant on web; native uses MapPin.tsx.
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { theme } from '../theme';

export function MapPin({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [lng, lat],
      zoom: 13,
    });
    const marker = new maplibregl.Marker({ color: theme.accent }).setLngLat([lng, lat]).addTo(map);
    return () => {
      marker.remove();
      map.remove();
    };
  }, [lat, lng]);

  return <div ref={ref} style={{ width: '100%', height: 240, borderRadius: 12, overflow: 'hidden' }} />;
}
