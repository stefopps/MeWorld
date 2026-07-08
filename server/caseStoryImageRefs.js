import fsp from 'fs/promises';
import path from 'path';
import { readPortraitCache } from './casePortrait.js';
import { readGenerationLayoutBuffer } from './portraitFrame.js';
import { readMasterImageBase64 } from './caseStoryCharacterLock.js';
import { readCaseStoryCharacterMapBuffer } from './caseStoryCharacterMap.js';

/**
 * Magnific inputs for case story — CHARACTER-MAP (white bg) always attached when available.
 * Resolution: public/assets/patient/uber/*-CHARACTER-MAP.png → dev/.../character-maps-pending/*-alt1|alt2.png
 * @param {'master'|'beat'|'grid'} mode
 */
export async function resolveCaseStoryMagnificRefs({
  gameRoot,
  caseContext,
  cacheDir,
  caseId,
  mode = 'beat',
}) {
  const characterMap = await readCaseStoryCharacterMapBuffer(gameRoot, caseContext);
  const masterRef = await readMasterImageBase64(cacheDir, caseId);
  const cachedPortrait = await readPortraitCache(
    path.join(gameRoot, '.case-portraits'),
    caseId,
  );

  const charMapExtra = characterMap
    ? [
        {
          image: `data:image/png;base64,${characterMap.imageBase64}`,
          mime_type: 'image/png',
          text:
            'WHITE-BG CHARACTER MAP — match face, hair, age, skin, and likeness exactly in every beat.',
        },
      ]
    : [];

  if (mode === 'master' && characterMap) {
    return {
      characterMap,
      imageBase64: characterMap.imageBase64,
      mimeType: characterMap.mimeType,
      referenceText:
        'WHITE-BG CHARACTER MAP — master identity for case story. Third-person 3/4 bedside — NOT bird-eye overhead.',
      extraReferenceImages: [],
    };
  }

  if (masterRef) {
    return {
      characterMap,
      imageBase64: masterRef.buffer.toString('base64'),
      mimeType: masterRef.mimeType,
      referenceText:
        'STORYBOARD — match master scene patient. CHARACTER MAP ref locks face/hair — never swap laterality.',
      extraReferenceImages: charMapExtra,
    };
  }

  if (characterMap) {
    return {
      characterMap,
      imageBase64: characterMap.imageBase64,
      mimeType: characterMap.mimeType,
      referenceText:
        'WHITE-BG CHARACTER MAP — establish identity before storyboard beats.',
      extraReferenceImages: [],
    };
  }

  if (cachedPortrait.exists) {
    const buf = await fsp.readFile(cachedPortrait.pngPath);
    return {
      characterMap: null,
      imageBase64: buf.toString('base64'),
      mimeType: 'image/png',
      referenceText: 'Match cached portrait likeness.',
      extraReferenceImages: [],
    };
  }

  const plate = await readGenerationLayoutBuffer(gameRoot, caseContext);
  return {
    characterMap: null,
    imageBase64: plate.buffer.toString('base64'),
    mimeType: plate.mimeType,
    referenceText: 'Match reference layout — patient identity from prompt.',
    extraReferenceImages: [],
  };
}
