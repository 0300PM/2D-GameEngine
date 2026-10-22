import type { PluginContext, PluginDefinition, PluginManifest } from "@engine";

export const manifest: PluginManifest = {
  id: "your-plugin",
  version: "0.1.0",
  engine: "^0.1.0",
  name: "Your plugin",
  description: "What the plugin does, in one sentence",
  author: "Your name",
  permissions: []
};

export const createPlugin = (): PluginDefinition => ({
  manifest,
  activate(context: PluginContext): void {
    context.logger.info("plugin activated");
    context.onDispose(() => context.logger.info("plugin disposed"));
  },
  deactivate(): void {
    return undefined;
  }
});
