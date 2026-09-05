export const fontFamilies = {
  sans: [
    'Inter',
    'PingFang SC',
    'Microsoft YaHei',
    'Microsoft JhengHei',
    'Helvetica Neue',
    'Helvetica',
    'Arial',
    'sans-serif',
  ].join(', '),

  serif: [
    'Georgia',
    'Times New Roman',
    'Times',
    'serif',
  ].join(', '),

  mono: [
    'JetBrains Mono',
    'Fira Code',
    'SF Mono',
    'Menlo',
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'Courier New',
    'monospace',
  ].join(', '),
};

export const getSystemFont = (): string => {
  if (typeof window !== 'undefined') {
    const userAgent = window.navigator.userAgent;
    if (userAgent.includes('Windows')) {
      return 'Microsoft YaHei, Microsoft JhengHei, sans-serif';
    }
    if (userAgent.includes('Mac')) {
      return 'PingFang SC, Helvetica Neue, sans-serif';
    }
    if (userAgent.includes('Linux')) {
      return 'Inter, Ubuntu, sans-serif';
    }
  }
  return fontFamilies.sans;
};

export default fontFamilies;