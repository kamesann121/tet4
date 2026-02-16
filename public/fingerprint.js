// ブラウザフィンガープリント生成
class BrowserFingerprint {
  constructor() {
    this.components = {};
  }

  async generate() {
    await this.collectComponents();
    return this.hash(JSON.stringify(this.components));
  }

  async collectComponents() {
    // 画面解像度
    this.components.screenResolution = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    
    // タイムゾーン
    this.components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // 言語
    this.components.language = navigator.language;
    
    // プラットフォーム
    this.components.platform = navigator.platform;
    
    // User Agent
    this.components.userAgent = navigator.userAgent;
    
    // ハードウェア並行性
    this.components.hardwareConcurrency = navigator.hardwareConcurrency;
    
    // デバイスメモリ
    this.components.deviceMemory = navigator.deviceMemory || 'unknown';
    
    // Canvas フィンガープリント
    this.components.canvas = await this.getCanvasFingerprint();
    
    // WebGL フィンガープリント
    this.components.webgl = this.getWebGLFingerprint();
    
    // オーディオコンテキスト
    this.components.audio = await this.getAudioFingerprint();
    
    // フォントリスト
    this.components.fonts = this.getFonts();
    
    // タッチサポート
    this.components.touchSupport = 'ontouchstart' in window;
  }

  async getCanvasFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 200;
    canvas.height = 50;
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Browser Fingerprint 🔒', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Browser Fingerprint 🔒', 4, 17);
    
    return canvas.toDataURL();
  }

  getWebGLFingerprint() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return 'no-webgl';
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';
    
    return {
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    };
  }

  async getAudioFingerprint() {
    return new Promise((resolve) => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          resolve('no-audio-context');
          return;
        }

        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const analyser = context.createAnalyser();
        const gainNode = context.createGain();
        const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

        gainNode.gain.value = 0;
        oscillator.type = 'triangle';
        oscillator.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(gainNode);
        gainNode.connect(context.destination);
        
        scriptProcessor.onaudioprocess = function(event) {
          const output = event.outputBuffer.getChannelData(0);
          const fingerprint = Array.from(output.slice(0, 30)).join(',');
          oscillator.disconnect();
          scriptProcessor.disconnect();
          gainNode.disconnect();
          context.close();
          resolve(fingerprint);
        };

        oscillator.start(0);
      } catch (error) {
        resolve('audio-error');
      }
    });
  }

  getFonts() {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Verdana', 'Times New Roman', 'Courier New',
      'Georgia', 'Palatino', 'Garamond', 'Bookman',
      'Comic Sans MS', 'Trebuchet MS', 'Impact'
    ];
    
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    const baseFontWidths = {};
    baseFonts.forEach(font => {
      context.font = `${testSize} ${font}`;
      baseFontWidths[font] = context.measureText(testString).width;
    });
    
    const detectedFonts = [];
    testFonts.forEach(font => {
      let detected = false;
      baseFonts.forEach(baseFont => {
        context.font = `${testSize} ${font}, ${baseFont}`;
        const width = context.measureText(testString).width;
        if (width !== baseFontWidths[baseFont]) {
          detected = true;
        }
      });
      if (detected) {
        detectedFonts.push(font);
      }
    });
    
    return detectedFonts.join(',');
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// グローバルに公開
window.BrowserFingerprint = BrowserFingerprint;
