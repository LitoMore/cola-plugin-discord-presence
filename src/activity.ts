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
  lastToolName?: string
  lastToolErrored?: boolean
  recentTopic?: string
  startedAt: number
}

export type PresenceTopicUpdate = {
  sessionId?: SessionId
  scopeKey: string
  topic: string
}

export function createInitialSnapshot(): PresenceSnapshot {
  return {
    phase: 'idle',
    startedAt: Date.now()
  }
}

export function reducePresenceEvent(
  snapshot: PresenceSnapshot,
  event: PluginSessionEvent,
  config: Pick<PresenceConfig, 'showTopic'>
): PresenceSnapshot {
  const sameSession = isSameSession(snapshot.sessionId, event.sessionId)
  const base = {
    sessionId: event.sessionId,
    origin: event.origin,
    recentTopic: config.showTopic && sameSession ? snapshot.recentTopic : undefined,
    lastToolName: sameSession ? snapshot.lastToolName : undefined,
    lastToolErrored: sameSession ? snapshot.lastToolErrored : undefined,
    startedAt: sameSession && snapshot.phase !== 'idle' ? snapshot.startedAt : Date.now()
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
      return {
        ...base,
        phase: 'reading',
        toolName: undefined,
        lastToolName: undefined,
        lastToolErrored: undefined
      }
    case 'agent:start':
      return { ...base, phase: 'thinking' }
    case 'agent:end':
    case 'turn:end':
      return { ...base, phase: 'waiting' }
    case 'message:end':
      return {
        ...base,
        phase: 'waiting'
      }
    case 'message:start':
      return { ...base, phase: 'replying' }
    case 'message:update':
      return sameSession && snapshot.phase === 'replying' ? snapshot : { ...base, phase: 'replying' }
    case 'tool:call':
    case 'tool:execution_start':
      return {
        ...base,
        phase: 'tool',
        toolName: event.toolName,
        lastToolName: event.toolName,
        lastToolErrored: undefined
      }
    case 'tool:result':
    case 'tool:execution_end':
      return {
        ...base,
        phase: 'thinking',
        toolName: undefined,
        lastToolName: event.toolName,
        lastToolErrored: event.isError
      }
    case 'tool:execution_update':
      return sameSession && snapshot.phase === 'tool'
        ? snapshot
        : { ...base, phase: 'tool', toolName: event.toolName, lastToolName: event.toolName }
  }
}

export function applyTopicUpdate(
  snapshot: PresenceSnapshot,
  update: PresenceTopicUpdate,
  config: Pick<PresenceConfig, 'showTopic' | 'topicMaxLength'>
): PresenceSnapshot {
  const topic = config.showTopic ? sanitizeTopic(update.topic, config.topicMaxLength) : undefined

  if (!topic) {
    return snapshot
  }

  if (snapshot.sessionId && update.sessionId && isSameSession(snapshot.sessionId, update.sessionId)) {
    return {
      ...snapshot,
      recentTopic: topic
    }
  }

  if (!snapshot.sessionId && snapshot.origin?.kind === 'desktop' && update.scopeKey === 'desktop:local') {
    return {
      ...snapshot,
      recentTopic: topic
    }
  }

  return {
    ...snapshot,
    recentTopic: topic
  }
}

export function createActivity(snapshot: PresenceSnapshot, config: PresenceConfig): SetActivity {
  return pruneUndefined({
    name: truncate(config.activityName, 128),
    details: truncate(detailsForSnapshot(snapshot), 128),
    state: truncate(stateForSnapshot(snapshot, config), 128),
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
      return 'Available'
    case 'session':
      return 'In conversation'
    case 'reading':
      return 'Reviewing context'
    case 'thinking':
      return thinkingDetails(snapshot)
    case 'replying':
      return 'Replying'
    case 'tool':
      return 'Working with tools'
    case 'compacting':
      return 'Organizing context'
    case 'waiting':
      return snapshot.recentTopic ? 'Discussing' : 'In conversation'
  }
}

function stateForSnapshot(snapshot: PresenceSnapshot, config: PresenceConfig): string {
  if (config.showTopic && snapshot.recentTopic) {
    return snapshot.recentTopic
  }

  if (config.showOrigin && snapshot.origin) {
    return originLabel(snapshot.origin)
  }

  return stateForPhase(snapshot.phase)
}

function thinkingDetails(snapshot: PresenceSnapshot): string {
  if (!snapshot.lastToolName) {
    return 'Thinking'
  }

  return snapshot.lastToolErrored ? 'Recovering from a tool error' : 'Reviewing results'
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

function sanitizeTopic(text: string, maxLength: number): string | undefined {
  const normalized = normalizeTopicText(text)

  if (!normalized) {
    return undefined
  }

  const topic = stripLeadIn(normalized)

  return topic ? truncate(topic, maxLength) : undefined
}

function normalizeTopicText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[(.*?)\]\([^)]*\)/g, '$1')
    .replace(/\[(.*?)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[#>*_~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripLeadIn(text: string): string {
  return text
    .trim()
    .replace(/^(sure|okay|ok|of course|absolutely|certainly|yes)[,.:;!\s-]*/i, '')
    .replace(/^(?:\u53ef\u4ee5|\u597d\u7684|\u5f53\u7136|\u6ca1\u95ee\u9898|\u884c)[\s,\u3002\uff0c\uff1a\uff01\uff1f-]*/, '')
    .trim()
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
