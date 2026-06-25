import type { Provider } from './types'
import { runOpenrouterMedia } from '../run/openrouterMediaRunner'

/**
 * OpenRouter Video: asynchronous text-to-video (Veo etc.) via the /videos job
 * API — submit, poll to completion, download the MP4 into the node's working
 * dir for a downstream Warehouse. Long-running (30s–several minutes).
 */
export const openrouterVideoProvider: Provider = {
  id: 'openrouter-video',
  label: 'OpenRouter — video (generation)',
  kind: 'video',
  supportsSkills: false,
  run: (p) => runOpenrouterMedia(p, 'video'),
}
