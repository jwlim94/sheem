import type { RefObject } from 'react';
import type { RoomAudio } from './audio';
import { BOOTH } from './hall';
import { Soundbar } from './Soundbar';
import { BAR, barOnSurface } from './soundbarLayout';

// The room's soundbar, here four times the size so it reads from the hall's
// front: a 2.2 m bar on the projection booth's roof at the back, facing the
// stage, its LED spectrum dancing to chapter 1's song like the one on his
// bookcase. Its body is a lighter charcoal than the room's, faintly
// self-lit: its front faces the stage, away from the house light above, and
// vanished against the black foam.
const SCALE = 4;
const ROOF_TOP = BOOTH.floor + 3.1 + 0.15; // build_school.py: booth height, roof slab

export function HallSpeaker({
  audio,
  reduced,
}: {
  audio: RefObject<RoomAudio | null>;
  reduced: boolean;
}) {
  return (
    <Soundbar
      audio={audio}
      reduced={reduced}
      position={[
        BOOTH.x1 - (BAR.d * SCALE) / 2 - 0.1,
        barOnSurface(ROOF_TOP, SCALE),
        0,
      ]}
      rotation={Math.PI / 2}
      scale={SCALE}
      color="#3d4047"
      glow={0.55}
      roughness={0.45}
    />
  );
}
