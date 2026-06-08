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
tool inputs, or tool results to Discord. It registers a Cola tool that lets the
model set a short, public-facing topic for the current conversation, then sends
that topic directly in the Discord activity state.
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
| `showTopic`        | boolean | `true`                                             | Show a short model-supplied public topic. Sends that topic to Discord. |
| `topicMaxLength`   | number  | `72`                                               | Maximum topic summary length, clamped between 20 and 120 characters.   |
| `reconnectMs`      | number  | `15000`                                            | Retry delay when Discord is not available.                             |
| `updateDebounceMs` | number  | `750`                                              | Minimum delay before applying presence updates.                        |

Discord Rich Presence requires the Discord desktop client to be running.

## Topic Summaries

The plugin exposes a global `set_activity_topic` tool. When Cola's model decides
the conversation topic is clear or has changed, it can call the tool with a
concise summary such as `Discord presence topic summaries`.
Until the model calls this tool, the activity state falls back to the session
origin, such as `Desktop session`.

The tool instructions tell the model not to quote private user text or include
secrets, credentials, personal data, file paths, exact prompts, or sensitive
details. The plugin still treats the supplied topic as public Discord presence
text and truncates it to `topicMaxLength`.

## License

MIT
