export { Engine } from "./core/Engine";
export type { EngineOptions } from "./core/Engine";
export { createEngine } from "./createEngine";
export { defaultEngineConfig, resolveEngineConfig, validateEngineConfig, defaultInputMap, hexToNumber } from "./core/EngineConfig";
export type { EngineConfig, ScaleMode, PhysicsConfig, InputActionMap } from "./core/EngineConfig";
export { Time } from "./core/Time";
export type { TimeState } from "./core/Time";
export { Random } from "./core/Random";
export { Scene } from "./core/Scene";
export type { SceneContext, ScenePorts, SpriteOptions, TextOptions, ShapeOptions } from "./core/Scene";
export { SceneManager } from "./core/SceneManager";
export { GameObject } from "./core/GameObject";
export type {
  GameObjectOptions,
  RenderDescriptor,
  SpriteRender,
  TextRender,
  RectRender,
  EllipseRender,
  TextStyleData,
  BodyDescriptor
} from "./core/GameObject";
export { Component, SYSTEM_ORDER, phaseRank } from "./core/Component";
export type { SystemPhase, ComponentClass } from "./core/Component";
export { ObjectIndex, Group } from "./core/ObjectIndex";
export type { ObjectPredicate, TagFilterMode } from "./core/ObjectIndex";
export type {
  RuntimeAdapter,
  DebugLayerState,
  PhysicsStats,
  AdapterDeps,
  AdapterFactory,
  RenderPort,
  PhysicsPort,
  CameraPort,
  InputPort,
  AssetBackend,
  ColliderHandle,
  ColliderPair,
  CollisionHandler,
  PointerPatch,
  Vec2
} from "./core/ports";
export { inactiveCollider } from "./core/ports";
export { Transform } from "./components/Transform";
export type { TransformData } from "./components/Transform";
export { EventBus } from "./systems/EventBus";
export type { EventHandler, EventErrorHandler } from "./systems/EventBus";
export { Logger } from "./systems/Logger";
export type { LogEntry, LogLevel, LogSink } from "./systems/Logger";
export { LOG_LEVELS, isLevelAtLeast, levelRank } from "./systems/Logger";
export { AssetManager, AssetError } from "./systems/AssetManager";
export type {
  AssetDescriptor,
  AssetDiagnostics,
  AssetType,
  AssetLoadProgress,
  AssetStatus,
  AssetPipelineReport
} from "./systems/AssetManager";
export {
  AssetManifest,
  ASSET_TYPES,
  DEFAULT_SIZE_LIMITS,
  animationKey,
  dataUriBytes,
  formatBytes,
  isValidAssetId
} from "./assets/AssetManifest";
export type {
  AssetAnimation,
  AssetIssue,
  AssetIssueCode,
  AssetLicense,
  AssetReferenceMap,
  AssetSizeEntry,
  AssetSizeLimits,
  AssetSizeReport
} from "./assets/AssetManifest";
export { importTiledMap, collectSpawns } from "./assets/TiledMap";
export type {
  TiledImportResult,
  TiledMap,
  TiledObject,
  TiledObjectLayer,
  TiledSpawn,
  TiledTileLayer,
  TiledTileset
} from "./assets/TiledMap";
export { InputManager } from "./systems/InputManager";
export type { PointerState } from "./systems/InputManager";
export { PhysicsManager } from "./systems/PhysicsManager";
export { CameraManager } from "./systems/CameraManager";
export { DebugOverlay } from "./systems/DebugOverlay";
export type { OverlayLabels, OverlayProfileEntry, OverlayStats } from "./systems/DebugOverlay";
export { readMemory, formatMemory, formatMegabytes } from "./systems/Memory";
export type { MemoryInfo } from "./systems/Memory";
export { Profiler } from "./debug/Profiler";
export type { ProfileSnapshot, ProfileStat } from "./debug/Profiler";
export { LogBuffer } from "./debug/LogBuffer";
export type { LogFilter, LogSummary } from "./debug/LogBuffer";
export { LogPanel } from "./debug/LogPanel";
export type { LogPanelLabels, LogPanelOptions } from "./debug/LogPanel";
export { DebugViews, DEFAULT_DEBUG_VIEWS } from "./debug/DebugViews";
export type { DebugViewKey, DebugViewState, DebugViewSupport } from "./debug/DebugViews";
export { Diagnostics } from "./debug/Diagnostics";
export type {
  DiagnosticsEnvironment,
  DiagnosticsFinding,
  DiagnosticsPhysics,
  DiagnosticsReport,
  DiagnosticsScene,
  DiagnosticsSource
} from "./debug/Diagnostics";
export { API_LEVEL, API_STABILITY, ENGINE_VERSION } from "./version";
export {
  STABILITY_CHANNELS,
  FEATURE_STATUS,
  getFeatureStatus,
  listFeatures,
  isStable,
  isExperimental,
  getStabilityReport
} from "./stability";
export type { StabilityChannel, FeatureStatus, StabilityReport } from "./stability";
export {
  registerDeprecation,
  getDeprecations,
  findDeprecation,
  formatDeprecation,
  deprecate,
  resetDeprecationNotices,
  deprecationReport,
  clearDeprecations
} from "./deprecation";
export type { DeprecationRecord, DeprecationSink } from "./deprecation";
export { Scheduler } from "./systems/Scheduler";
export type { TaskHandle, TaskOptions } from "./systems/Scheduler";
export { Timer } from "./systems/Timer";
export type { TimerOptions } from "./systems/Timer";
export { PhaserAdapter } from "./adapters/PhaserAdapter";
export { createPhaserAdapter } from "./adapters/createPhaserAdapter";
export { PhaserRenderLayer } from "./adapters/PhaserRenderLayer";
export { PhaserPhysicsBackend } from "./adapters/PhaserPhysicsBackend";
export { PhaserCameraBackend } from "./adapters/PhaserCameraBackend";
export { PhaserInputBackend } from "./adapters/PhaserInputBackend";
export { PhaserAssetBackend } from "./adapters/PhaserAssetBackend";
export { PhaserAudioBackend } from "./adapters/PhaserAudioBackend";
export { validateProjectConfig, parseProjectJson, CURRENT_FORMAT_VERSION } from "./project-format/ProjectFormat";
export type { ProjectFormatV1, ProjectConfig as LegacyProjectConfig } from "./project-format/ProjectFormat";
export { CURRENT_PROJECT_VERSION, SCALE_MODES, SCENE_ID_PATTERN, createDefaultProject } from "./project/Schema";
export type {
  ProjectConfig,
  ProjectFormatV2,
  ProjectIssue,
  ProjectSettings,
  SceneDefinition,
  SceneObjectDefinition
} from "./project/Schema";
export { validateProject } from "./project/Validate";
export type { ProjectValidationResult } from "./project/Validate";
export { migrateProject, MIGRATIONS } from "./project/Migrate";
export type { MigrationStep, MigrationResult } from "./project/Migrate";
export {
  PROJECT_ENVELOPE_FORMAT,
  canonicalJson,
  checksum,
  exportProject,
  exportProjectEnvelope,
  importProject,
  importProjectValue
} from "./project/Serialize";
export type { ProjectEnvelope, ProjectImportResult } from "./project/Serialize";
export { ProjectRepository } from "./project/Repository";
export type { LoadResult, RepositoryOptions, SaveResult } from "./project/Repository";
export { checksumText } from "./core/Checksum";
export { MemoryStore, LocalStorageStore, IndexedDbStore, FileSystemStore, HttpStore } from "./save/SaveStore";
export type { SaveStore, HttpStoreOptions, IndexedDbOptions } from "./save/SaveStore";
export {
  CURRENT_SAVE_VERSION,
  PROJECT_KEY_PREFIX,
  PlayerSaveRepository,
  SAVE_KEY_PREFIX,
  SaveCorruptionError,
  projectKey,
  saveKey
} from "./save/PlayerSave";
export type { PlayerSave, SaveRepositoryOptions } from "./save/PlayerSave";
export { SqlSaveStore, sqlClear, sqlDelete, sqlGet, sqlKeys, sqlSchema, sqlSet } from "./save/SqlSaveStore";
export type { SqlClient, SqlDialect, SqlQueryResult, SqlStoreOptions } from "./save/SqlSaveStore";
export { WasmBridge } from "./wasm/WasmBridge";
export type { WasmBridgeOptions, WasmModuleState } from "./wasm/WasmBridge";
export { AudioManager, AUDIO_CHANNELS, DEFAULT_AUDIO_VOLUMES, SoundHandle } from "./audio/AudioManager";
export type { AudioChannel, AudioState, HandleStatus, PlaySoundOptions } from "./audio/AudioManager";
export { EASINGS, EASING_NAMES, resolveEasing } from "./animation/Easing";
export type { Easing, EasingFunction, EasingName } from "./animation/Easing";
export { Tween } from "./animation/Tween";
export type { TweenMode, TweenOptions, TweenState, TweenTarget, TweenValues } from "./animation/Tween";
export { TweenManager, TweenSequence } from "./animation/TweenManager";
export type { SequenceOptions, SequenceState, TweenStep } from "./animation/TweenManager";
export type { AnimationPlayOptions, AnimationState, AudioPlaybackOptions, AudioPort } from "./core/ports";

export { PluginHost } from "./plugins/host";
export type { PluginHostOptions, PluginServices } from "./plugins/host";
export { PluginError, PluginPermissionError } from "./plugins/errors";
export type { PluginErrorCode } from "./plugins/errors";
export { ImporterRegistry, PanelRegistry, SystemRegistry } from "./plugins/registries";
export type { SystemRunError } from "./plugins/registries";
export {
  PLUGIN_PERMISSIONS,
  isPluginPermission,
  normalizePluginManifest,
  validatePluginManifest
} from "./plugins/manifest";
export type {
  PluginManifest,
  PluginManifestIssue,
  PluginManifestIssueCode,
  PluginPermission
} from "./plugins/manifest";
export { compareVersions, isValidRange, parseVersion, satisfiesRange } from "./plugins/semver";
export type { ParsedVersion } from "./plugins/semver";
export type {
  PluginAssetApi,
  PluginAuditEntry,
  PluginContext,
  PluginDefinition,
  PluginEventApi,
  PluginImporter,
  PluginImporterApi,
  PluginImporterDescriptor,
  PluginLogger,
  PluginPanel,
  PluginPanelApi,
  PluginPanelDescriptor,
  PluginSceneApi,
  PluginState,
  PluginStatus,
  PluginStorageApi,
  PluginSummary,
  PluginSystemApi,
  PluginSystemDescriptor,
  PluginSystemHandler,
  PluginSystemOptions
} from "./plugins/types";

export { DEFAULT_PROJECT_LIMITS, mergeLimits, measureDepth, findUnsafeKey, byteLength } from "./project/Limits";
export type { ProjectLimits } from "./project/Limits";
export type { ProjectValidateOptions } from "./project/Validate";
export type { ProjectImportOptions } from "./project/Serialize";
