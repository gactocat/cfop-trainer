import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type TwistyPlayerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  alg?: string;
  'experimental-setup-alg'?: string;
  'experimental-setup-anchor'?: 'start' | 'end';
  background?: 'none' | 'checkered';
  'control-panel'?: 'none' | 'bottom-row';
  'hint-facelets'?: 'none' | 'floating';
  'back-view'?: 'none' | 'side-by-side' | 'top-right';
  'camera-latitude'?: number | string;
  'camera-longitude'?: number | string;
  'camera-distance'?: number | string;
  'camera-latitude-limit'?: number | string;
  'visualization'?: 'PG3D' | '3D' | '2D' | 'experimental-2D-LL';
  'tempo-scale'?: number | string;
  puzzle?: string;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': TwistyPlayerAttributes;
    }
  }
}

export {};
