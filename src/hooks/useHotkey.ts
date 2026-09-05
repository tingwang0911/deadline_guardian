import { onMount, onCleanup } from "solid-js";

type HotkeyCallback = () => void;

interface HotkeyConfig {
  key: string;
  callback: HotkeyCallback;
  enabled?: boolean;
}

export const useHotkey = (config: HotkeyConfig): void => {
  const { key, callback, enabled = true } = config;

  onMount(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const keyParts = key.split("+").map((k) => k.trim().toLowerCase());
      const ctrl = keyParts.includes("ctrl");
      const shift = keyParts.includes("shift");
      const alt = keyParts.includes("alt");
      const meta = keyParts.includes("meta") || keyParts.includes("cmd");

      const keyCode = keyParts.find((k) => !["ctrl", "shift", "alt", "meta", "cmd"].includes(k));

      const matches =
        (ctrl === event.ctrlKey) &&
        (shift === event.shiftKey) &&
        (alt === event.altKey) &&
        (meta === event.metaKey) &&
        (event.key.toLowerCase() === keyCode);

      if (matches) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });
};

export const useHotkeys = (configs: HotkeyConfig[]): void => {
  configs.forEach((config) => {
    useHotkey(config);
  });
};

export default useHotkey;