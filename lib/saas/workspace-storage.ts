import { localStoreKeys } from "../persistence/export";
type Bridge = Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
  serverExecutionDisabled?: boolean;
  flush?: () => Promise<void>;
};
let bridge: Bridge | null = null;
export function bindWorkspaceStorage(value: Bridge | null) {
  bridge = value;
}
export function lockWorkspaceStorage() {
  bridge = {
    serverExecutionDisabled: true,
    getItem: () => null,
    setItem: () => {
      throw Error("WorkspaceClosed");
    },
    removeItem: () => {
      throw Error("WorkspaceClosed");
    },
  };
}
function selectedStorage(): Bridge {
  if (bridge) return bridge;
  if (typeof document !== "undefined" && document.documentElement.dataset.appMode === "local") return window.localStorage;
  throw Error("فضای شرکت آماده نیست؛ صفحه را تازه کنید.");
}
export const businessStorage: Bridge = {
  getItem: (key) => selectedStorage().getItem(key),
  setItem: (key, value) => selectedStorage().setItem(key, value),
  removeItem: (key) => selectedStorage().removeItem(key),
  get serverExecutionDisabled() {
    return !!bridge?.serverExecutionDisabled;
  },
};
export async function flushWorkspace() {
  await bridge?.flush?.();
}
export function createWorkspaceStorage(
  initial: {
    stores: Record<string, string | null>;
    organizationId: string;
    sharedVersion: number;
    privateVersion: number;
  },
  notify: (status: string, error?: string) => void,
) {
  let stores = { ...initial.stores },
    sharedVersion = initial.sharedVersion,
    privateVersion = initial.privateVersion;
  let dirty = false,
    blocked = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    running: Promise<void> | null = null;
  async function flush() {
    if (timer) clearTimeout(timer);
    if (running) await running;
    if (blocked) throw Error("ذخیره متوقف شده است؛ صفحه را تازه کنید.");
    if (!dirty) return;
    const snapshot = { ...stores };
    dirty = false;
    running = (async () => {
      const response = await fetch("/api/saas?operation=workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: location.origin,
          "x-organization-id": initial.organizationId,
        },
        body: JSON.stringify({
          operation: "workspace",
          organizationId: initial.organizationId,
          sharedVersion,
          privateVersion,
          stores: snapshot,
        }),
      });
      if (!response.ok) {
        blocked = true;
        notify(
          "error",
          response.status === 409
            ? "اطلاعات یا شرکت فعال تغییر کرده است. صفحه را تازه کنید."
            : "ذخیره مجاز یا ممکن نیست. صفحه را تازه کنید.",
        );
        throw Error("WorkspaceSaveFailed");
      }
      const saved = await response.json();
      sharedVersion = saved.sharedVersion;
      privateVersion = saved.privateVersion;
      notify(dirty ? "pending" : "saved");
    })()
      .catch((error) => {
        blocked = true;
        notify(
          "error",
          "ذخیره تأیید نشد؛ تغییرات این صفحه موقت‌اند. صفحه را تازه کنید.",
        );
        throw error;
      })
      .finally(() => {
        running = null;
      });
    await running;
    if (dirty) await flush();
  }
  function changed() {
    dirty = true;
    notify("pending");
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush().catch(() => {}), 150);
  }
  return {
    serverExecutionDisabled: true,
    getItem(key: string) {
      if (!localStoreKeys.includes(key as (typeof localStoreKeys)[number]))
        return null;
      return stores[key] ?? null;
    },
    setItem(key: string, value: string) {
      if (blocked) throw Error("ذخیره متوقف شده است.");
      if (!localStoreKeys.includes(key as (typeof localStoreKeys)[number]))
        throw Error("UnsupportedWorkspaceKey");
      if (
        key === "growth-engine.agent.execution.v1" ||
        key === "growth-engine.agent.v1"
      )
        throw Error("اجرای سروری اقدامات هنوز فعال نیست.");
      if (stores[key] === value) return;
      stores[key] = value;
      changed();
    },
    removeItem(key: string) {
      if (blocked) throw Error("ذخیره متوقف شده است.");
      if (!localStoreKeys.includes(key as (typeof localStoreKeys)[number]))
        throw Error("UnsupportedWorkspaceKey");
      if (stores[key] == null) return;
      stores[key] = null;
      changed();
    },
    flush,
    dispose() {
      if (timer) clearTimeout(timer);
    },
  };
}
