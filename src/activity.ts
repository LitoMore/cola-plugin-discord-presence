import type { PluginSessionEvent, PluginSessionEventOrigin, SessionId } from '@marswave/cola-plugin-sdk'
import type { SetActivity } from '@xhayper/discord-rpc'

import type { PresenceConfig } from './config.js'

type PresencePhase =
  | 'idle'
  | 'session'
  | 'reading'
  | 'thinking'
  | 'replying'
  | 'tool'
  | 'compacting'
  | 'waiting'

export type PresenceSnapshot = {
  phase: PresencePhase
  sessionId?: SessionId
  origin?: PluginSessionEventOrigin
  toolName?: string
  startedAt: number
}

export function createInitialSnapshot(): PresenceSnapshot {
  return {
    phase: 'idle',
    startedAt: Date.now()
  }
}

export function reducePresenceEvent(
  snapshot: PresenceSnapshot,
  event: PluginSessionEvent
): PresenceSnapshot {
  const base = {
    sessionId: event.sessionId,
    origin: event.origin,
    startedAt: snapshot.phase === 'idle' ? Date.now() : snapshot.startedAt
  }

  switch (event.type) {
    case 'session:start':
      return { ...base, phase: 'session' }
    case 'session:shutdown':
      return isSameSession(snapshot.sessionId, event.sessionId) ? createInitialSnapshot() : snapshot
    case 'compact:start':
      return { ...base, phase: 'compacting' }
    case 'compact:end':
      return { ...base, phase: 'waiting' }
    case 'turn:start':
      return { ...base, phase: 'reading' }
    case 'agent:start':
      return { ...base, phase: 'thinking' }
    case 'agent:end':
    case 'turn:end':
    case 'message:end':
      return { ...base, phase: 'waiting' }
    case 'message:start':
      return { ...base, phase: 'replying' }
    case 'message:update':
      return snapshot.phase === 'replying' ? snapshot : { ...base, phase: 'replying' }
    case 'tool:call':
    case 'tool:execution_start':
      return { ...base, phase: 'tool', toolName: event.toolName }
    case 'tool:result':
    case 'tool:execution_end':
      return { ...base, phase: 'thinking' }
    case 'tool:execution_update':
      return snapshot.phase === 'tool' ? snapshot : { ...base, phase: 'tool', toolName: event.toolName }
  }
}

export function createActivity(snapshot: PresenceSnapshot, config: PresenceConfig): SetActivity {
  const origin = config.showOrigin && snapshot.origin ? originLabel(snapshot.origin) : undefined
  const state = origin ?? stateForPhase(snapshot.phase)

  return pruneUndefined({
    name: truncate(config.activityName, 128),
    details: truncate(detailsForSnapshot(snapshot), 128),
    state: truncate(state, 128),
    startTimestamp: new Date(snapshot.startedAt),
    largeImageKey: config.largeImageKey,
    largeImageUrl: config.largeImageUrl,
    smallImageKey: config.smallImageKey,
    smallImageUrl: config.smallImageUrl,
    largeImageText:
      config.largeImageKey || config.largeImageUrl ? truncate(config.largeImageText, 128) : undefined,
    smallImageText:
      config.smallImageKey || config.smallImageUrl ? truncate(config.smallImageText, 128) : undefined
  })
}

function detailsForSnapshot(snapshot: PresenceSnapshot): string {
  switch (snapshot.phase) {
    case 'idle':
      return 'Ready for a conversation'
    case 'session':
      return 'Session is active'
    case 'reading':
      return 'Reading your message'
    case 'thinking':
      return 'Cola is thinking'
    case 'replying':
      return 'Cola is replying'
    case 'tool':
      return snapshot.toolName ? `Using ${snapshot.toolName}` : 'Using a tool'
    case 'compacting':
      return 'Compacting context'
    case 'waiting':
      return 'Waiting for you'
  }
}

function stateForPhase(phase: PresencePhase): string {
  switch (phase) {
    case 'idle':
      return 'Idle'
    case 'session':
    case 'reading':
    case 'thinking':
    case 'replying':
    case 'tool':
    case 'compacting':
      return 'Active session'
    case 'waiting':
      return 'Conversation paused'
  }
}

function originLabel(origin: PluginSessionEventOrigin): string {
  switch (origin.kind) {
    case 'desktop':
      return 'Desktop session'
    case 'cli':
      return 'CLI session'
    case 'plugin':
      return `Plugin session: ${origin.pluginId}`
    case 'other':
      return 'External session'
  }
}

function isSameSession(left: SessionId | undefined, right: SessionId): boolean {
  return Boolean(left && left.length === right.length && left.every((part, index) => part === right[index]))
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T
}
