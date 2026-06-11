import type { ChannelConfigSchema } from '@marswave/cola-plugin-sdk'

export type PresenceConfig = {
  enabled: boolean
  clientId: string
  activityName: string
  largeImageKey?: string
  largeImageUrl?: string
  smallImageKey?: string
  smallImageUrl?: string
  largeImageText: string
  smallImageText: string
  showOrigin: boolean
  showTopic: boolean
  topicMaxLength: number
  reconnectMs: number
  updateDebounceMs: number
}

const DEFAULT_RECONNECT_MS = 15_000
const DEFAULT_UPDATE_DEBOUNCE_MS = 750
const DEFAULT_TOPIC_MAX_LENGTH = 72
const DEFAULT_CLIENT_ID = '1511096648137179227'
const DEFAULT_LARGE_IMAGE_URL = 'https://colaos.ai/apple-touch-icon.png'

export const presenceConfigSchema = {
  fields: [
    {
      key: 'enabled',
      path: ['enabled'],
      label: 'Enable plugin',
      description: 'Start Discord Presence when Cola launches.',
      type: 'boolean',
      required: false,
      defaultValue: true
    },
    {
      key: 'clientId',
      label: 'Discord application ID',
      description: 'Discord application client ID used for Rich Presence.',
      placeholder: DEFAULT_CLIENT_ID,
      type: 'text',
      defaultValue: DEFAULT_CLIENT_ID
    },
    {
      key: 'activityName',
      label: 'Activity name',
      description: 'Activity name sent to Discord.',
      type: 'text',
      defaultValue: 'Cola'
    },
    {
      key: 'largeImageKey',
      label: 'Large image',
      description: 'Discord application asset key or public image URL for the large image.',
      placeholder: DEFAULT_LARGE_IMAGE_URL,
      type: 'text',
      defaultValue: DEFAULT_LARGE_IMAGE_URL
    },
    {
      key: 'largeImageUrl',
      label: 'Large image URL',
      description: 'Backward-compatible alias for the large image. Prefer largeImageKey.',
      type: 'text'
    },
    {
      key: 'smallImageKey',
      label: 'Small image asset',
      description: 'Discord application asset key for the small image.',
      type: 'text'
    },
    {
      key: 'smallImageUrl',
      label: 'Small image URL',
      description: 'Public image URL for the small image.',
      type: 'text'
    },
    {
      key: 'largeImageText',
      label: 'Large image text',
      description: 'Hover text for the large image.',
      type: 'text',
      defaultValue: 'Cola'
    },
    {
      key: 'smallImageText',
      label: 'Small image text',
      description: 'Hover text for the small image.',
      type: 'text',
      defaultValue: 'Discord Presence'
    },
    {
      key: 'showOrigin',
      label: 'Show origin',
      description: 'Show the session origin kind when no topic is available.',
      type: 'boolean',
      defaultValue: true
    },
    {
      key: 'showTopic',
      label: 'Show topic',
      description: 'Show the short model-supplied public topic in Discord.',
      type: 'boolean',
      defaultValue: true
    },
    {
      key: 'topicMaxLength',
      label: 'Topic max length',
      description: 'Maximum topic summary length, clamped between 20 and 120 characters.',
      type: 'number',
      defaultValue: DEFAULT_TOPIC_MAX_LENGTH
    },
    {
      key: 'reconnectMs',
      label: 'Reconnect delay',
      description: 'Retry delay in milliseconds when Discord is not available.',
      type: 'number',
      defaultValue: DEFAULT_RECONNECT_MS
    },
    {
      key: 'updateDebounceMs',
      label: 'Update debounce',
      description: 'Minimum delay in milliseconds before applying presence updates.',
      type: 'number',
      defaultValue: DEFAULT_UPDATE_DEBOUNCE_MS
    }
  ]
} satisfies ChannelConfigSchema

export function readPresenceConfig(config: Readonly<Record<string, unknown>>): PresenceConfig {
  return {
    enabled: getBoolean(config, 'enabled', true),
    clientId:
      getString(config, 'clientId') ?? getString(config, 'discordClientId') ?? DEFAULT_CLIENT_ID,
    activityName: getString(config, 'activityName') ?? 'Cola',
    largeImageKey: getString(config, 'largeImageKey') ?? getString(config, 'largeImageUrl') ?? DEFAULT_LARGE_IMAGE_URL,
    largeImageUrl: undefined,
    smallImageKey: getString(config, 'smallImageKey') ?? undefined,
    smallImageUrl: getString(config, 'smallImageUrl') ?? undefined,
    largeImageText: getString(config, 'largeImageText') ?? 'Cola',
    smallImageText: getString(config, 'smallImageText') ?? 'Discord Presence',
    showOrigin: getBoolean(config, 'showOrigin', true),
    showTopic: getBoolean(config, 'showTopic', true),
    topicMaxLength: getNumber(config, 'topicMaxLength', DEFAULT_TOPIC_MAX_LENGTH, 20, 120),
    reconnectMs: getNumber(config, 'reconnectMs', DEFAULT_RECONNECT_MS, 1_000, 300_000),
    updateDebounceMs: getNumber(config, 'updateDebounceMs', DEFAULT_UPDATE_DEBOUNCE_MS, 0, 30_000)
  }
}

function getString(config: Readonly<Record<string, unknown>>, key: string): string | null {
  return normalizeString(config[key])
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function getBoolean(config: Readonly<Record<string, unknown>>, key: string, fallback: boolean): boolean {
  const value = config[key]

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true
    }

    if (value.toLowerCase() === 'false') {
      return false
    }
  }

  return fallback
}

function getNumber(
  config: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const value = config[key]
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return Math.min(max, Math.max(min, numberValue))
}
