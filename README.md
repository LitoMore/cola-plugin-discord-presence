# Cola Discord Presence

Discord Rich Presence observer plugin for Cola.

<p align="center"><img width="250" src="./assets/discord-presence.webp" /></p>

> [!NOTE]\
> This plugin is still in early development and may have limited functionality or stability.
> All features and configuration options are subject to change.

It subscribes to Cola session events and publishes the current interaction state to Discord, such as:

- Available
- Reviewing context
- Thinking, or reviewing results
- Replying
- Working with tools
- Organizing context

By default, the plugin does not send user prompts, full assistant responses,
tool inputs, or tool results to Discord. After an assistant message completes,
it uses Cola's configured primary model through the plugin SDK to generate a
short, public-facing activity phrase and a complementary subtitle, then sends
these summaries to Discord.
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

The plugin declares its settings through Cola channel config.

| Key                  | Type    | Default                                  | Description                                                                          |
| -------------------- | ------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `enabled`            | boolean | `true`                                   | Disable without uninstalling.                                                        |
| `clientId`           | string  | built in                                 | Optional Discord application ID override.                                            |
| `activityName`       | string  | `Cola`                                   | Activity name prefix. Leave empty to show only the summary when enabled.              |
| `showActivityInName` | boolean | `true`                                   | Append ` - topic` to `activityName` when a topic is available and the session is not idle. |
| `largeImageKey`      | string  | `https://colaos.ai/apple-touch-icon.png` | Discord application asset key or public image URL for the large image.               |
| `largeImageUrl`      | string  | none                                     | Backward-compatible alias for `largeImageKey`.                                       |
| `smallImageKey`      | string  | none                                     | Discord application asset key.                                                       |
| `smallImageUrl`      | string  | none                                     | Public image URL for the small image.                                                |
| `largeImageText`     | string  | `Cola`                                   | Hover text for the large image.                                                      |
| `smallImageText`     | string  | `Discord Presence`                       | Hover text for the small image.                                                      |
| `showOrigin`         | boolean | `true`                                   | Show only the origin kind, such as desktop or CLI.                                   |
| `showTopic`          | boolean | `true`                                   | Show a short model-generated public activity phrase. Sends that phrase to Discord. |
| `topicMaxLength`     | number  | `72`                                     | Maximum topic summary length, clamped between 20 and 120 characters.                 |
| `reconnectMs`        | number  | `15000`                                  | Retry delay when Discord is not available.                                           |
| `updateDebounceMs`   | number  | `750`                                    | Minimum delay before applying presence updates.                                      |

Discord Rich Presence requires the Discord desktop client to be running.

Every activity, including idle, includes a **Get Cola** button linking to
https://cola.app.

Enable **Show current activity in name** to display the topic directly in the
activity name, for example `Cola - Discussing favourite video games`, without the
interaction phase. Topics are included only when `showTopic` is enabled.
While idle or when no topic is available, the name is the configured
`activityName` (default `Cola`). Leave `activityName` empty to show only the summary,
such as `Discussing favourite video games`, with no prefix or separator. An empty
name falls back to `Cola` while idle, when no summary is available, or when
**Show current activity in name** is disabled. The profile card details and state remain available.

## Topic Summaries

When an assistant message finishes, the plugin asks Cola's configured primary
model to generate a concise public activity phrase describing what you and Cola
are doing together, such as `Discussing favourite video games`,
`Debugging a Discord plugin`, or `Planning a weekend trip`. The phrase starts
with an action verb instead of naming only the topic, so other people can
understand the activity at a glance. The same model call also generates a short
subtitle with a distinct focus or goal, for example `Storytelling, exploration,
and memorable worlds` below `Discussing favourite video games`.
When the topic appears in the activity name, the activity state shows this
subtitle instead of repeating the topic. Otherwise, the state shows the topic.
Missing or identical subtitles fall back to the session origin, such as
`Desktop session`, or a generic session status when origin display is disabled.

The generation prompt tells the model not to quote private user text or include
secrets, credentials, personal data, file paths, exact prompts, or sensitive
details in either field. The plugin treats both generated fields as public Discord
presence text and truncates each to `topicMaxLength`. Topic generation requires Cola plugin
SDK `0.0.4` or newer and a configured primary model provider.

## License

MIT
