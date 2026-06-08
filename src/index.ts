import { defineChannel, definePlugin } from '@marswave/cola-plugin-sdk'
import type {
  PluginEventHandler,
  PluginSessionEvent,
  PluginStartContext,
  PluginTool,
  PluginToolContext
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
  }
})

const setActivityTopicTool: PluginTool = {
  name: 'set_activity_topic',
  label: 'Set Discord activity topic',
  description:
    'Update Discord Rich Presence with a short, natural public topic for the current Cola conversation. Call this whenever the user intent is clear or the topic changes.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      topic: {
        type: 'string',
        minLength: 2,
        maxLength: 120,
        description:
          'A concise public topic, not a quote from the conversation. Keep it natural, neutral, and safe for Discord presence.'
      }
    },
    required: ['topic']
  },
  promptSnippet:
    'set_activity_topic: keep Discord Rich Presence updated with a concise public topic for the current conversation.',
  promptGuidelines: [
    'Call set_activity_topic once the user intent is clear, preferably before or early in your response. Call it again when the topic changes meaningfully.',
    'Do not quote private user text. Do not include secrets, credentials, personal data, file paths, exact prompts, or sensitive details.',
    'Use a natural 2-6 word noun phrase such as "Discord presence topics" or "Plugin build debugging"; avoid full sentences and prefixes like "Topic:".',
    'Do not mention the presence update to the user unless they ask about Discord Presence.'
  ],
  async execute(input: unknown, ctx: PluginToolContext) {
    const topic = readToolTopic(input)

    if (!topic) {
      return {
        content: [{ type: 'text', text: 'No topic was provided.' }],
        isError: true
      }
    }

    if (!controller) {
      return {
        content: [{ type: 'text', text: 'Discord Presence is not running.' }],
        isError: true
      }
    }

    controller.setTopic(topic, ctx)

    return {
      content: [{ type: 'text', text: 'Discord activity topic updated.' }],
      details: { topic }
    }
  }
}

export default definePlugin({
  ...discordPresenceChannel,
  tools: [setActivityTopicTool],
  async start(ctx) {
    const config = readPresenceConfig(ctx.config)

    if (!config.enabled) {
      ctx.logger.info('Discord Presence plugin is disabled.')
      return
    }

    await controller?.stop()
    controller = new PresenceController(config)
    await controller.start(ctx)
  },
  async stop() {
    await controller?.stop()
    controller = undefined
  }
})

class PresenceController {
  private snapshot: PresenceSnapshot = createInitialSnapshot()
  private presence: DiscordPresence | undefined
  private unsubscribers: Array<() => void> = []

  constructor(private readonly config: PresenceConfig) {}

  async start(ctx: PluginStartContext): Promise<void> {
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

  async stop(): Promise<void> {
    for (const unsubscribe of this.unsubscribers.splice(0)) {
      unsubscribe()
    }

    await this.presence?.stop()
    this.presence = undefined
  }

  setTopic(topic: string, ctx: PluginToolContext): void {
    this.snapshot = applyTopicUpdate(
      this.snapshot,
      {
        sessionId: ctx.sessionId,
        scopeKey: ctx.scopeKey,
        topic
      },
      this.config
    )
    this.presence?.setActivity(createActivity(this.snapshot, this.config))
  }

  private readonly handleEvent = (event: PluginSessionEvent): void => {
    this.snapshot = reducePresenceEvent(this.snapshot, event, this.config)
    this.presence?.setActivity(createActivity(this.snapshot, this.config))
  }
}

function readToolTopic(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const topic = (input as { topic?: unknown }).topic

  return typeof topic === 'string' && topic.trim().length > 0 ? topic : undefined
}
