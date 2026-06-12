import { defineChannel, definePlugin } from '@marswave/cola-plugin-sdk'
import type {
  ChannelStatusResult,
  PluginEventHandler,
  PluginLlm,
  PluginLogger,
  PluginSessionEvent,
  PluginStartContext
} from '@marswave/cola-plugin-sdk'

import { applyTopicUpdate, createActivity, createInitialSnapshot, reducePresenceEvent } from './activity.js'
import type { PresenceSnapshot } from './activity.js'
import { presenceConfigSchema, readPresenceConfig } from './config.js'
import type { PresenceConfig } from './config.js'
import { DiscordPresence } from './discord-presence.js'

const EVENT_TYPES = [
  'session:start',
  'session:shutdown',
  'compact:start',
  'compact:end',
  'agent:start',
  'agent:end',
  'turn:start',
  'turn:end',
  'message:start',
  'message:update',
  'message:end',
  'tool:call',
  'tool:result',
  'tool:execution_start',
  'tool:execution_update',
  'tool:execution_end'
] as const satisfies readonly PluginSessionEvent['type'][]

let controller: PresenceController | undefined
let activeConfigKey: string | undefined

type PresenceRuntimeContext = Pick<PluginStartContext, 'config' | 'runtime' | 'logger' | 'abortSignal'>
type GeneratedTopic = {
  topic?: unknown
}

const TOPIC_SOURCE_MAX_LENGTH = 4_000
const TOPIC_GENERATION_TIMEOUT_MS = 15_000
const TOPIC_GENERATION_SYSTEM_PROMPT = [
  'Create a short public Discord Rich Presence topic from the assistant response.',
  'Use a natural 2-6 word noun phrase.',
  'Do not quote private user text.',
  'Do not include secrets, credentials, personal data, file paths, exact prompts, or sensitive details.',
  'If the response is sensitive, vague, or mostly code/log output, use a broad safe category.'
].join(' ')

const discordPresenceChannel = defineChannel({
  id: 'discord-presence',
  meta: {
    label: 'Discord Presence',
    description: 'Publishes Cola interaction state to Discord Rich Presence.'
  },
  capabilities: {
    receive: {},
    send: {}
  },
  config: {
    schema: presenceConfigSchema
  },
  gateway: {
    async start(ctx) {
      await startPresence(ctx)
    },
    async stop() {
      await stopPresence()
    },
    getStatus(ctx): ChannelStatusResult {
      return getPresenceStatus(ctx.config)
    }
  }
})

export default definePlugin({
  ...discordPresenceChannel,
  async start(ctx) {
    await startPresence(ctx)
  },
  async stop() {
    await stopPresence()
  }
})

async function startPresence(ctx: PresenceRuntimeContext): Promise<void> {
  const config = readPresenceConfig(ctx.config)
  const configKey = JSON.stringify(config)

  if (!config.enabled) {
    await stopPresence()
    ctx.logger.info('Discord Presence plugin is disabled.')
    return
  }

  if (controller && activeConfigKey === configKey) {
    return
  }

  await stopPresence()

  controller = new PresenceController(config)
  activeConfigKey = configKey
  await controller.start(ctx)
}

async function stopPresence(): Promise<void> {
  activeConfigKey = undefined
  await controller?.stop()
  controller = undefined
}

function getPresenceStatus(configInput: Readonly<Record<string, unknown>>): ChannelStatusResult {
  const config = readPresenceConfig(configInput)

  if (!config.enabled) {
    return {
      connected: false,
      configured: true,
      message: 'Plugin disabled'
    }
  }

  const connected = controller?.isConnected() ?? false

  return {
    connected,
    configured: true,
    message: controller?.getStatusMessage() ?? 'Discord Presence is not running'
  }
}

class PresenceController {
  private snapshot: PresenceSnapshot = createInitialSnapshot()
  private presence: DiscordPresence | undefined
  private unsubscribers: Array<() => void> = []
  private llm: PluginLlm | undefined
  private logger: PluginLogger | undefined
  private topicGenerationId = 0
  private stopped = true
  private topicWarningShown = false

  constructor(private readonly config: PresenceConfig) {}

  async start(ctx: PluginStartContext): Promise<void> {
    this.llm = ctx.runtime.llm
    this.logger = ctx.logger
    this.stopped = false
    this.presence = new DiscordPresence(this.config, ctx.logger)
    this.presence.setActivity(createActivity(this.snapshot, this.config))

    for (const eventType of EVENT_TYPES) {
      const unsubscribe = ctx.runtime.events.on(
        eventType,
        this.handleEvent as PluginEventHandler<typeof eventType>,
        { scope: 'all' }
      )
      this.unsubscribers.push(unsubscribe)
    }

    ctx.abortSignal.addEventListener(
      'abort',
      () => {
        void this.stop()
      },
      { once: true }
    )

    this.presence.start()
  }

  isConnected(): boolean {
    return this.presence?.isConnected() ?? false
  }

  getStatusMessage(): string {
    return this.presence?.getStatusMessage() ?? 'Discord Presence stopped'
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.topicGenerationId += 1

    for (const unsubscribe of this.unsubscribers.splice(0)) {
      unsubscribe()
    }

    await this.presence?.stop()
    this.presence = undefined
    this.logger = undefined
  }

  private readonly handleEvent = (event: PluginSessionEvent): void => {
    this.snapshot = reducePresenceEvent(this.snapshot, event, this.config)
    this.presence?.setActivity(createActivity(this.snapshot, this.config))

    if (event.type === 'turn:start') {
      this.topicGenerationId += 1
    }

    if (event.type === 'message:end') {
      void this.generateTopicFromMessage(event)
    }
  }

  private async generateTopicFromMessage(
    event: Extract<PluginSessionEvent, { type: 'message:end' }>
  ): Promise<void> {
    if (!this.config.showTopic || !this.llm || !event.text.trim()) {
      return
    }

    const generationId = ++this.topicGenerationId

    try {
      const result = await this.llm.generateObject<GeneratedTopic>(
        topicPromptForMessage(event.text),
        topicSchema(this.config.topicMaxLength),
        {
          systemPrompt: TOPIC_GENERATION_SYSTEM_PROMPT,
          timeoutMs: TOPIC_GENERATION_TIMEOUT_MS
        }
      )
      const topic = readGeneratedTopic(result)

      if (
        !topic ||
        this.stopped ||
        generationId !== this.topicGenerationId ||
        !isCurrentSession(this.snapshot, event.sessionId)
      ) {
        return
      }

      this.snapshot = applyTopicUpdate(
        this.snapshot,
        {
          sessionId: event.sessionId,
          topic
        },
        this.config
      )
      this.presence?.setActivity(createActivity(this.snapshot, this.config))
    } catch (error) {
      if (!this.topicWarningShown) {
        this.topicWarningShown = true
        this.logger?.warn('Failed to generate Discord activity topic.', error)
      }
    }
  }
}

function topicSchema(maxLength: number): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      topic: {
        type: 'string',
        minLength: 2,
        maxLength: Math.trunc(maxLength),
        description: 'A concise public Discord presence topic.'
      }
    },
    required: ['topic']
  }
}

function topicPromptForMessage(text: string): string {
  return `Assistant response:\n${truncateForPrompt(text, TOPIC_SOURCE_MAX_LENGTH)}`
}

function readGeneratedTopic(result: GeneratedTopic): string | undefined {
  return typeof result.topic === 'string' && result.topic.trim().length > 0 ? result.topic : undefined
}

function truncateForPrompt(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`
}

function isCurrentSession(snapshot: PresenceSnapshot, sessionId: PluginSessionEvent['sessionId']): boolean {
  return Boolean(
    snapshot.sessionId &&
      snapshot.sessionId.length === sessionId.length &&
      snapshot.sessionId.every((part, index) => part === sessionId[index])
  )
}
