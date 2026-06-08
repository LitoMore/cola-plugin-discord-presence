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

export function readPresenceConfig(
  config: Readonly<Record<string, unknown>>,
  env: NodeJS.ProcessEnv = process.env
): PresenceConfig {
  return {
    enabled: getBoolean(config, 'enabled', true),
    clientId:
      getString(config, 'clientId') ??
      getString(config, 'discordClientId') ??
      normalizeString(env.COLA_DISCORD_CLIENT_ID) ??
      normalizeString(env.DISCORD_CLIENT_ID) ??
      DEFAULT_CLIENT_ID,
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
