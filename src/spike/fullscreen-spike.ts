import { window } from '@tauri-apps/api';

export async function createFullscreenBlackWindow(): Promise<void> {
  try {
    const primaryMonitor = await window.getPrimaryMonitor();
    
    const blackWindow = await window.createWindow({
      label: 'fullscreen-black',
      url: 'index.html',
      width: primaryMonitor.size.width,
      height: primaryMonitor.size.height,
      x: primaryMonitor.position.x,
      y: primaryMonitor.position.y,
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

    await blackWindow.setPosition({ x: 0, y: 0 });
    await blackWindow.setSize({ width: primaryMonitor.size.width, height: primaryMonitor.size.height });

    await blackWindow.setAlwaysOnTop(true, 'screen-saver');

    const result = {
      success: true,
      monitorWidth: primaryMonitor.size.width,
      monitorHeight: primaryMonitor.size.height,
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
    const capabilities = {
      supportsTransparent: false,
      supportsAlwaysOnTop: false,
      supportsFullscreen: false,
      supportsDecorations: false,
      monitors: [],
    };

    const monitors = await window.getAllMonitors();
    capabilities.monitors = monitors.map(m => ({
      name: m.name,
      width: m.size.width,
      height: m.size.height,
      x: m.position.x,
      y: m.position.y,
    }));

    const testWindow = await window.createWindow({
      label: 'capability-test',
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