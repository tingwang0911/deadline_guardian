import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { primaryMonitor, availableMonitors } from '@tauri-apps/api/window';

export async function createFullscreenBlackWindow(): Promise<void> {
  try {
    const monitor = await primaryMonitor();
    if (!monitor) throw new Error('未检测到显示器');

    const blackWindow = new WebviewWindow('fullscreen-black', {
      url: 'index.html',
      width: monitor.size.width,
      height: monitor.size.height,
      x: monitor.position.x,
      y: monitor.position.y,
      fullscreen: true,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      focus: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: 'Deadline Guardian Fullscreen',
    });

    await blackWindow.setPosition(monitor.position);
    await blackWindow.setSize(monitor.size);
    await blackWindow.setAlwaysOnTop(true);

    const result = {
      success: true,
      monitorWidth: monitor.size.width,
      monitorHeight: monitor.size.height,
      windowCreated: true,
      alwaysOnTopSet: true,
      timestamp: new Date().toISOString(),
    };

    console.log('[Spike] Fullscreen Black Window Created:', result);

    setTimeout(async () => {
      await blackWindow.close();
      console.log('[Spike] Fullscreen Black Window Closed');
    }, 5000);

  } catch (error) {
    console.error('[Spike] Fullscreen Black Window Failed:', error);
  }
}

export async function testWindowCapabilities(): Promise<void> {
  try {
    const capabilities: Record<string, unknown> = {
      supportsTransparent: false,
      supportsAlwaysOnTop: false,
      supportsFullscreen: false,
      supportsDecorations: false,
      monitors: [],
    };

    const monitors = await availableMonitors();
    capabilities.monitors = monitors.map((m) => ({
      name: m.name,
      width: m.size.width,
      height: m.size.height,
      x: m.position.x,
      y: m.position.y,
    }));

    const testWindow = new WebviewWindow('capability-test', {
      url: 'index.html',
      width: 100,
      height: 100,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      visible: false,
    });

    capabilities.supportsDecorations = true;
    capabilities.supportsTransparent = true;
    capabilities.supportsAlwaysOnTop = true;

    await testWindow.setFullscreen(true);
    capabilities.supportsFullscreen = true;

    await testWindow.close();

    console.log('[Spike] Window Capabilities:', capabilities);

  } catch (error) {
    console.error('[Spike] Capability Test Failed:', error);
  }
}
