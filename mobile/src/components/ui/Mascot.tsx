import React from 'react';
import { Image, ImageSourcePropType, ImageStyle } from 'react-native';
import { theme } from '@/constants/theme';

type TiltKey = keyof typeof theme.tilts;

export type MascotPose =
  | 'welcome'
  | 'empty-albums'
  | 'empty-day'
  | 'camera'
  | 'story'
  | 'milestone'
  | 'loading'
  | 'success'
  | 'error'
  | 'search-empty'
  | 'soundtrack'
  | 'settings'
  | 'permission'
  | 'archived'
  | '404';

const WELCOME = require('../../../assets/mascot/mascot-welcome.png');

const POSE_SOURCE: Record<MascotPose, ImageSourcePropType> = {
  'welcome':       WELCOME,
  'empty-albums':  require('../../../assets/mascot/mascot-empty-albums.png'),
  'empty-day':     require('../../../assets/mascot/mascot-empty-day.png'),
  'camera':        require('../../../assets/mascot/mascot-camera.png'),
  'story':         require('../../../assets/mascot/mascot-story.png'),
  'milestone':     WELCOME,
  'loading':       WELCOME,
  'success':       WELCOME,
  'error':         WELCOME,
  'search-empty':  WELCOME,
  'soundtrack':    WELCOME,
  'settings':      WELCOME,
  'permission':    WELCOME,
  'archived':      WELCOME,
  '404':           WELCOME,
};

interface MascotProps {
  pose?: MascotPose;
  size?: number;
  tilt?: TiltKey;
  flip?: boolean;
  withShadow?: boolean;
  testID?: string;
}

export function Mascot({
  pose = 'welcome',
  size = 32,
  tilt = 'none',
  flip = false,
  withShadow: _withShadow = true,
  testID,
}: MascotProps) {
  const magnitude = theme.tilts[tilt];
  const deg = flip ? -magnitude : magnitude;

  const style: ImageStyle = {
    width: size,
    height: size,
    ...(magnitude !== 0 && { transform: [{ rotate: `${deg}deg` }] }),
  };

  return (
    <Image
      testID={testID}
      source={POSE_SOURCE[pose]}
      style={style}
      resizeMode="contain"
    />
  );
}
