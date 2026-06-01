import { definePlugin } from '@marswave/cola-plugin-sdk'
import type { PluginEventHandler, PluginSessionEvent, PluginStartContext } from '@marswave/cola-plugin-sdk'

import { createActivity, createInitialSnapshot, reducePresenceEvent } from './activity.js'
import type { PresenceSnapshot } from './activity.js'
import { readPresenceConfig } from './config.js'
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

export default definePlugin({
  id: 'discord-presence',
  meta: {
    label: 'Discord Presence',
    description: 'Publishes Cola interaction state to Discord Rich Presence.'
  },
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

  private readonly handleEvent = (event: PluginSessionEvent): void => {
    this.snapshot = reducePresenceEvent(this.snapshot, event)
    this.presence?.setActivity(createActivity(this.snapshot, this.config))
  }
}
