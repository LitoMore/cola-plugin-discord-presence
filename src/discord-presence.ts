import { Client } from '@xhayper/discord-rpc'
import type { SetActivity } from '@xhayper/discord-rpc'
import type { PluginLogger } from '@marswave/cola-plugin-sdk'

import type { PresenceConfig } from './config.js'

export class DiscordPresence {
  private client: Client | undefined
  private connected = false
  private connecting = false
  private stopped = true
  private desiredActivity: SetActivity | undefined
  private reconnectTimer: NodeJS.Timeout | undefined
  private updateTimer: NodeJS.Timeout | undefined
  private lastWarning: string | undefined

  constructor(
    private readonly config: PresenceConfig,
    private readonly logger: PluginLogger
  ) {}

  start(): void {
    this.stopped = false
    void this.connect()
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.clearTimers()

    const client = this.client
    this.client = undefined
    this.connected = false
    this.connecting = false

    if (!client) {
      return
    }

    try {
      await client.user?.clearActivity(process.pid)
    } catch (error) {
      this.logger.warn('Failed to clear Discord activity.', error)
    }

    try {
      await client.destroy()
    } catch (error) {
      this.logger.warn('Failed to close Discord RPC connection.', error)
    }
  }

  setActivity(activity: SetActivity): void {
    this.desiredActivity = activity

    if (!this.connected) {
      return
    }

    this.scheduleActivityUpdate()
  }

  private async connect(): Promise<void> {
    if (this.stopped || this.connecting || this.connected) {
      return
    }

    this.connecting = true
    const client = new Client({ clientId: this.config.clientId })
    this.client = client

    client.on('ready', () => {
      if (this.stopped || this.client !== client) {
        return
      }

      this.connected = true
      this.connecting = false
      this.lastWarning = undefined
      this.logger.info('Discord RPC connected.')
      this.scheduleActivityUpdate()
    })

    client.on('disconnected', () => {
      if (this.client !== client) {
        return
      }

      this.connected = false
      this.connecting = false
      this.client = undefined

      if (!this.stopped) {
        this.scheduleReconnect()
      }
    })

    try {
      await client.login()
    } catch (error) {
      if (this.client !== client) {
        return
      }

      this.connected = false
      this.connecting = false
      this.client = undefined
      await this.destroyQuietly(client)
      this.warnOnce('Discord RPC is unavailable. Is Discord running?', error)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) {
      return
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      void this.connect()
    }, this.config.reconnectMs)

    this.reconnectTimer.unref?.()
  }

  private scheduleActivityUpdate(): void {
    if (this.updateTimer) {
      return
    }

    this.updateTimer = setTimeout(() => {
      this.updateTimer = undefined
      void this.applyActivity()
    }, this.config.updateDebounceMs)

    this.updateTimer.unref?.()
  }

  private async applyActivity(): Promise<void> {
    const client = this.client
    const user = client?.user

    if (!this.connected || !client || !user || !this.desiredActivity) {
      return
    }

    try {
      await user.setActivity(this.desiredActivity, process.pid)
    } catch (error) {
      if (this.client !== client) {
        return
      }

      this.connected = false
      this.client = undefined
      await this.destroyQuietly(client)
      this.warnOnce('Failed to update Discord Rich Presence.', error)
      this.scheduleReconnect()
    }
  }

  private async destroyQuietly(client: Client): Promise<void> {
    try {
      await client.destroy()
    } catch {
      // Ignore cleanup failures after a connection failure.
    }
  }

  private warnOnce(message: string, error: unknown): void {
    const key = `${message}:${error instanceof Error ? error.message : String(error)}`

    if (key === this.lastWarning) {
      return
    }

    this.lastWarning = key
    this.logger.warn(message, error)
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = undefined
    }
  }
}
