// Shared design tokens + glassmorphism helper for the public marketing surfaces
// (landing + /trust). Airbnb palette + Apple glass, solid coral, no gradients.
import { Platform, type ViewStyle } from 'react-native';

export const C = {
  coral: '#FF5A5F',
  coralDark: '#c23b46',
  coralStatus: '#d12a4d',
  bg: '#fbf3ee',
  blob1: '#ffe1d6', blob2: '#ffd9dc', blob3: '#ffe9d2',
  glass: 'rgba(255,255,255,0.7)',
  glassBorder: 'rgba(255,255,255,0.85)',
  heading: '#1d1d1f',
  body: '#5b5b5f',
  muted: '#6b6b70', muted2: '#8a8a8f', muted3: '#9a9a9f',
  green: '#1f9d57', greenBg: '#e8f7ee',
  amber: '#f5a623',
  tileTint: '#fff0ec',
  avatarBg: '#ffd9c2', avatarFg: '#c8603a',
  line: 'rgba(0,0,0,0.07)',
};

export const MAXW = 1180;

// Translucent + (web) backdrop blur; native falls back to translucent.
export const glass = (intensity: 'standard' | 'subtle' | 'vivid' = 'standard'): ViewStyle => {
  const bg = intensity === 'subtle' ? 'rgba(255,255,255,0.8)' : intensity === 'vivid' ? 'rgba(255,255,255,0.58)' : C.glass;
  const web = Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px) saturate(165%)' } as unknown as ViewStyle) : null;
  return {
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: '#963c32',
    shadowOpacity: 0.1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    ...web,
  };
};
