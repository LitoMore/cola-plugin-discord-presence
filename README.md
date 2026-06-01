# Cola Discord Presence

Discord Rich Presence observer plugin for Cola. It subscribes to Cola session
events and publishes the current interaction state to Discord, such as:

- Ready for a conversation
- Reading your message
- Cola is thinking
- Cola is replying
- Using a tool
- Compacting context

The plugin does not send user prompts, assistant responses, tool inputs, or
tool results to Discord.

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
| `reconnectMs`      | number  | `15000`                                            | Retry delay when Discord is not available.                             |
| `updateDebounceMs` | number  | `750`                                              | Minimum delay before applying presence updates.                        |

Discord Rich Presence requires the Discord desktop client to be running.

## License

MIT
