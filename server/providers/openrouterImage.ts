import type { Provider } from './types'
import { runOpenrouterMedia } from '../run/openrouterMediaRunner'

/**
 * OpenRouter Image: synchronous image generation (Gemini/GPT image models) via
 * the chat-completions endpoint with modalities:['image','text']. Saves the
 * generated image(s) into the node's working dir for a downstream Warehouse.
 */
export const openrouterImageProvider: Provider = {
  id: 'openrouter-image',
  label: 'OpenRouter — image (generation)',
  kind: 'image',
  supportsSkills: false,
  run: (p) => runOpenrouterMedia(p, 'image'),
}
