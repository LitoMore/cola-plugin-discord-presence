# Cola Discord Presence

Discord Rich Presence observer plugin for Cola. It subscribes to Cola session
events and publishes the current interaction state to Discord, such as:

- Available
- Reviewing context
- Thinking, or reviewing results
- Replying
- Working with tools
- Organizing context

By default, the plugin does not send user prompts, full assistant responses,
tool inputs, or tool results to Discord. It does derive a short topic from the
latest assistant response and sends that summary directly in the Discord
activity state.
Set `showTopic` to `false` to disable topic summaries completely. Cola session
events do not currently expose user prompts or conversation titles to observer
plugins.

## Setup

Build the plugin before installing it into Cola:

```bash
npm install
npm run build
```

Cola discovers the plugin from the `cola.plugin` manifest in `package.json`.
The built entry is `./dist/index.js`.

## Configuration

The plugin reads settings from Cola plugin config first, then environment
variables where noted.

| Key                | Type    | Default                                            | Description                                                            |
| ------------------ | ------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| `enabled`          | boolean | `true`                                             | Disable without uninstalling.                                          |
| `clientId`         | string  | built in                                           | Optional Discord application ID override. Can be set by plugin config, `COLA_DISCORD_CLIENT_ID`, or `DISCORD_CLIENT_ID`. |
| `activityName`     | string  | `Cola`                                             | Activity name sent to Discord.                                         |
| `largeImageKey`    | string  | `https://colaos.ai/apple-touch-icon.png`           | Discord application asset key or public image URL for the large image. |
| `largeImageUrl`    | string  | none                                               | Backward-compatible alias for `largeImageKey`.                         |
| `smallImageKey`    | string  | none                                               | Discord application asset key.                                         |
| `smallImageUrl`    | string  | none                                               | Public image URL for the small image.                                  |
| `largeImageText`   | string  | `Cola`                                             | Hover text for the large image.                                        |
| `smallImageText`   | string  | `Discord Presence`                                 | Hover text for the small image.                                        |
| `showOrigin`       | boolean | `true`                                             | Show only the origin kind, such as desktop or CLI.                     |
| `showTopic`        | boolean | `true`                                             | Show a short topic derived from the latest assistant response. Sends that summary to Discord. |
| `topicMaxLength`   | number  | `72`                                               | Maximum topic summary length, clamped between 20 and 120 characters.   |
| `reconnectMs`      | number  | `15000`                                            | Retry delay when Discord is not available.                             |
| `updateDebounceMs` | number  | `750`                                              | Minimum delay before applying presence updates.                        |

Discord Rich Presence requires the Discord desktop client to be running.

## License

MIT
