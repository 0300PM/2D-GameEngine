import type { GameObject } from "./GameObject";

export type TagFilterMode = "any" | "all";

export type ObjectPredicate = (object: GameObject) => boolean;

export class Group {
  readonly name: string;
  private objects = new Set<GameObject>();

  constructor(name: string) {
    this.name = name;
  }

  get size(): number {
    return this.objects.size;
  }

  add(object: GameObject): this {
    if (this.objects.has(object)) return this;
    this.objects.add(object);
    object.groups.add(this.name);
    object.scene?.internalGroupChanged(object, this.name, true);
    return this;
  }

  remove(object: GameObject): boolean {
    if (!this.objects.delete(object)) return false;
    object.groups.delete(this.name);
    object.scene?.internalGroupChanged(object, this.name, false);
    return true;
  }

  has(object: GameObject): boolean {
    return this.objects.has(object);
  }

  get all(): GameObject[] {
    return Array.from(this.objects.values());
  }

  count(): number {
    return this.objects.size;
  }

  each(fn: (object: GameObject) => void): void {
    for (const object of this.objects) fn(object);
  }

  clear(): void {
    for (const object of this.objects) object.groups.delete(this.name);
    this.objects.clear();
  }

  internalDelete(object: GameObject): void {
    this.objects.delete(object);
  }
}

export class ObjectIndex {
  private byId = new Map<string, GameObject>();
  private byTag = new Map<string, Set<GameObject>>();
  private byGroup = new Map<string, Set<GameObject>>();
  private groups = new Map<string, Group>();

  add(object: GameObject): void {
    if (this.byId.has(object.id)) throw new Error(`Object "${object.id}" already exists`);
    this.byId.set(object.id, object);
    for (const tag of object.tags) this.tagSet(tag).add(object);
    for (const group of object.groups) this.groupSet(group).add(object);
  }

  remove(object: GameObject): void {
    this.byId.delete(object.id);
    for (const tag of object.tags) this.byTag.get(tag)?.delete(object);
    for (const group of object.groups) {
      this.byGroup.get(group)?.delete(object);
      this.groups.get(group)?.internalDelete(object);
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): GameObject | undefined {
    return this.byId.get(id);
  }

  all(): GameObject[] {
    return Array.from(this.byId.values());
  }

  count(): number {
    return this.byId.size;
  }

  tagChanged(object: GameObject, tag: string, added: boolean): void {
    if (added) this.tagSet(tag).add(object);
    else this.byTag.get(tag)?.delete(object);
  }

  groupChanged(object: GameObject, group: string, added: boolean): void {
    if (added) this.groupSet(group).add(object);
    else this.byGroup.get(group)?.delete(object);
  }

  byTagName(tag: string): GameObject[] {
    const set = this.byTag.get(tag);
    return set ? Array.from(set) : [];
  }

  byTags(tags: readonly string[], mode: TagFilterMode = "any"): GameObject[] {
    if (tags.length === 0) return [];
    const match = mode === "all" ? "hasAllTags" : "hasAnyTag";
    return this.all().filter((object) => object[match](tags));
  }

  byName(name: string): GameObject | undefined {
    for (const object of this.byId.values()) {
      if (object.name === name) return object;
    }
    return undefined;
  }

  find(predicate: ObjectPredicate): GameObject | undefined {
    for (const object of this.byId.values()) {
      if (predicate(object)) return object;
    }
    return undefined;
  }

  filter(predicate: ObjectPredicate): GameObject[] {
    return this.all().filter(predicate);
  }

  group(name: string): Group {
    let group = this.groups.get(name);
    if (!group) {
      group = new Group(name);
      this.groups.set(name, group);
    }
    return group;
  }

  getGroup(name: string): Group | undefined {
    return this.groups.get(name);
  }

  groupMembers(name: string): GameObject[] {
    const set = this.byGroup.get(name);
    return set ? Array.from(set) : [];
  }

  groupNames(): string[] {
    return Array.from(this.groups.keys());
  }

  clear(): void {
    for (const group of this.groups.values()) group.clear();
    this.byId.clear();
    this.byTag.clear();
    this.byGroup.clear();
    this.groups.clear();
  }

  private tagSet(tag: string): Set<GameObject> {
    let set = this.byTag.get(tag);
    if (!set) {
      set = new Set();
      this.byTag.set(tag, set);
    }
    return set;
  }

  private groupSet(group: string): Set<GameObject> {
    let set = this.byGroup.get(group);
    if (!set) {
      set = new Set();
      this.byGroup.set(group, set);
    }
    return set;
  }
}
