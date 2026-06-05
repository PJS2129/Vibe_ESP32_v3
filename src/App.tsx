import { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Play, 
  Square, 
  Terminal as TerminalIcon, 
  Copy, 
  Check, 
  Zap, 
  CircuitBoard,
  RefreshCw, 
  Send, 
  Code as CodeIcon,
  Eye,
  Trash2,
  AlertCircle,
  Save,
  MessageSquare,
  Download,
  Settings,
  HardDrive,
  Plus,
  LogIn,
  LogOut,
  History,
  Clock,
  User as UserIcon,
  Info
} from 'lucide-react';
import { ESPLoader, Transport } from 'esptool-js';
import { templates } from './templates';

// Firebase imports
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from './firebase';

// Predefined official ssd1306 driver for quick install
const SSD1306_CODE = `# MicroPython SSD1306 OLED driver, I2C and SPI interfaces
from micropython import const
import framebuf

# Register addresses
SET_CONTRAST = const(0x81)
SET_ENTIRE_ON = const(0xA4)
SET_NORM_INV = const(0xA6)
SET_DISP = const(0xAE)
SET_MEM_ADDR = const(0x20)
SET_COL_ADDR = const(0x21)
SET_PAGE_ADDR = const(0x22)
SET_DISP_START_LINE = const(0x40)
SET_SEG_REMAP = const(0xA0)
SET_MUX_RATIO = const(0xA8)
SET_COM_OUT_DIR = const(0xC0)
SET_DISP_OFFSET = const(0xD3)
SET_COM_PIN_CFG = const(0xDA)
SET_DISP_CLK_DIV = const(0xD5)
SET_PRECHARGE = const(0xD9)
SET_VCOM_DESEL = const(0xDB)
SET_CHARGE_PUMP = const(0x8D)

class SSD1306(framebuf.FrameBuffer):
    def __init__(self, width, height, external_vcc):
        self.width = width
        self.height = height
        self.external_vcc = external_vcc
        self.pages = self.height // 8
        self.buffer = bytearray(self.pages * self.width)
        super().__init__(self.buffer, self.width, self.height, framebuf.MONO_VLSB)
        self.init_display()

    def init_display(self):
        for cmd in (
            SET_DISP | 0x00,  # off
            SET_MEM_ADDR,
            0x00,  # horizontal
            SET_DISP_START_LINE | 0x00,
            SET_SEG_REMAP | 0x01,
            SET_MUX_RATIO,
            self.height - 1,
            SET_COM_OUT_DIR | 0x08,
            SET_DISP_OFFSET,
            0x00,
            SET_COM_PIN_CFG,
            0x02 if self.width > 2 * self.height else 0x12,
            SET_DISP_CLK_DIV,
            0x80,
            SET_PRECHARGE,
            0x22 if self.external_vcc else 0xF1,
            SET_VCOM_DESEL,
            0x30,
            SET_CONTRAST,
            0xFF,
            SET_ENTIRE_ON,
            SET_NORM_INV,
            SET_CHARGE_PUMP,
            0x10 if self.external_vcc else 0x14,
            SET_DISP | 0x01,  # on
        ):
            self.write_cmd(cmd)
        self.fill(0)
        self.show()

    def poweroff(self):
        self.write_cmd(SET_DISP | 0x00)

    def poweron(self):
        self.write_cmd(SET_DISP | 0x01)

    def contrast(self, contrast):
        self.write_cmd(SET_CONTRAST)
        self.write_cmd(contrast)

    def invert(self, invert):
        self.write_cmd(SET_NORM_INV | (1 if invert else 0))

    def show(self):
        x0 = 0
        x1 = self.width - 1
        if self.width == 64:
            x0 += 32
            x1 += 32
        self.write_cmd(SET_COL_ADDR)
        self.write_cmd(x0)
        self.write_cmd(x1)
        self.write_cmd(SET_PAGE_ADDR)
        self.write_cmd(0)
        self.write_cmd(self.pages - 1)
        self.write_framebuf()

class SSD1306_I2C(SSD1306):
    def __init__(self, width, height, i2c, addr=0x3C, external_vcc=False):
        self.i2c = i2c
        self.addr = addr
        self.temp = bytearray(2)
        self.write_list = [b"\\x40", None]
        super().__init__(width, height, external_vcc)

    def write_cmd(self, cmd):
        self.temp[0] = 0x00
        self.temp[1] = cmd
        self.i2c.writeto(self.addr, self.temp)

    def write_framebuf(self):
        self.write_list[1] = self.buffer
        self.i2c.writevto(self.addr, self.write_list)
`;

const TCS34725_CODE = `# MicroPython TCS34725 Color Sensor Driver
import time
import ustruct

class TCS34725:
    def __init__(self, i2c, address=0x29):
        self.i2c = i2c
        self.address = address
        # Check sensor ID (ID register: 0x12 | 0x80 = 0x92)
        sensor_id = self.i2c.readfrom_mem(self.address, 0x92, 1)[0]
        if sensor_id not in (0x44, 0x4D, 0x10):
            raise RuntimeError("Could not find TCS34725 sensor. ID: " + hex(sensor_id))
        # Power ON (0x01) and RGBC enable (0x02) = 0x03
        self.i2c.writeto_mem(self.address, 0x80, b'\\x03')
        self.integration_time(24)
        self.gain(4)

    def integration_time(self, value=None):
        if value is None:
            return getattr(self, '_integration_time', 24.0)
        reg = 256 - int(value / 2.4)
        reg = min(max(reg, 0), 255)
        self.i2c.writeto_mem(self.address, 0x81, bytes([reg]))
        self._integration_time = value

    def gain(self, value=None):
        if value is None:
            return getattr(self, '_gain', 4)
        gains = {1: 0x00, 4: 0x01, 16: 0x02, 60: 0x03}
        if value not in gains:
            raise ValueError("Gain must be 1, 4, 16, or 60")
        reg = gains[value]
        self.i2c.writeto_mem(self.address, 0x8F, bytes([reg]))
        self._gain = value

    def read(self, raw=True):
        # Read 8 bytes: Clear, Red, Green, Blue (0x14 | 0x80 = 0x94)
        data = self.i2c.readfrom_mem(self.address, 0x94, 8)
        c = ustruct.unpack('<H', data[0:2])[0]
        r = ustruct.unpack('<H', data[2:4])[0]
        g = ustruct.unpack('<H', data[4:6])[0]
        b = ustruct.unpack('<H', data[6:8])[0]
        return r, g, b, c
`;

export default function App() {
  // Main Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tools' | 'history'>('dashboard');

  // Firebase auth & history states
  const [user, setUser] = useState<User | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Web Serial states
  const [port, setPort] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [portInfo, setPortInfo] = useState<string>('');
  const [terminalOutput, setTerminalOutput] = useState<string>(
    '[시스템] 보드를 USB 포트에 연결하고 [ESP32 보드 연결] 버튼을 눌러주세요.\n'
  );
  
  // Board Files State
  const [boardFiles, setBoardFiles] = useState<string[]>([]);
  const [isRefreshingFiles, setIsRefreshingFiles] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<File[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // Flashing States
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashingStatus, setFlashingStatus] = useState('대기 중...');
  const [flashProgress, setFlashProgress] = useState(0);
  const [shouldEraseFlash, setShouldEraseFlash] = useState(true);
  const [flashSuccess, setFlashSuccess] = useState(false);

  // AI Chat states
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState<string>(
    '# 여기에 생성된 MicroPython 코드가 표시됩니다.\n# 좌측의 자연어 입력을 통해 코드를 생성하거나 직접 코드를 편집할 수 있습니다.\n\nimport machine\nimport time\n\nled = machine.Pin(2, machine.Pin.OUT)\nwhile True:\n    led.value(1)\n    time.sleep(0.5)\n    led.value(0)\n    time.sleep(0.5)\n'
  );
  const [explanation, setExplanation] = useState<string>(
    '이 코드는 ESP32 보드의 내장 LED(일반적으로 GPIO 2번에 연결됨)를 0.5초 간격으로 켜고 끄는 가장 기본적인 \'Blink\' 예제입니다.\n\n1. **라이브러리 불러오기**:\n   - `machine`: ESP32의 하드웨어 핀을 직접 제어하기 위한 MicroPython 모듈입니다.\n   - `time`: 시간 지연(sleep)을 처리하기 위한 모듈입니다.\n\n2. **하드웨어 핀 제어**:\n   - `machine.Pin(2, machine.Pin.OUT)`: GPIO 2번 핀을 신호를 내보내는 출력(OUT) 모드로 활성화합니다.\n\n3. **무한 루프 제어**:\n   - `while True:` 블록을 통해 꺼짐과 켜짐 동작을 무한히 반복합니다.\n   - `led.value(1)`은 핀에 High(3.3V) 신호를 주어 LED를 켜고, `led.value(0)`은 Low(0V) 신호를 주어 LED를 끕니다.\n   - 각 상태 변화 사이에 `time.sleep(0.5)`를 주어 0.5초(500ms) 동안 대기하게 합니다.'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // UI states
  const [editorTab, setEditorTab] = useState<'preview' | 'edit' | 'explain'>('preview');
  const [copied, setCopied] = useState(false);
  
  // Refs for scroll and connection control
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(true);
  const isUploadingRef = useRef<boolean>(false);
  const previewCodeRef = useRef<HTMLDivElement>(null);
  const explanationContainerRef = useRef<HTMLDivElement>(null);
  const terminalPreRef = useRef<HTMLPreElement>(null);

  // Sync terminal scroll
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalOutput]);

  // Sync scroll between textarea and line numbers in edit mode
  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineRef.current) {
      lineRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Intercept Ctrl+A or Cmd+A key combinations to select only code/explanation content
  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      if (editorTab === 'edit' && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      } else if (editorTab === 'preview' && previewCodeRef.current) {
        const range = document.createRange();
        range.selectNodeContents(previewCodeRef.current);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else if (editorTab === 'explain' && explanationContainerRef.current) {
        const range = document.createRange();
        range.selectNodeContents(explanationContainerRef.current);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  };

  // Intercept Ctrl+A or Cmd+A key combinations inside terminal to select only terminal output
  const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      if (terminalPreRef.current) {
        const range = document.createRange();
        range.selectNodeContents(terminalPreRef.current);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  };

  // Predefined suggestion tags
  const suggestions = [
    { label: '💡 내장 LED 깜빡이기', text: 'ESP32 내장 LED(GPIO 2번)를 0.5초 간격으로 깜빡이는 무한 루프 코드를 작성해줘.' },
    { label: '📡 WiFi 연결', text: 'ESP32를 특정 WiFi SSID와 Password에 연결하고, 연결에 성공하면 IP 주소를 터미널에 출력하는 코드를 작성해줘.' },
    { label: '🌡️ 온습도 센서 DHT11', text: 'GPIO 27번에 연결된 DHT11 센서에서 온도와 습도를 2초 간격으로 읽어와서 터미널에 출력해줘. 센서 오류 예외 처리도 포함해줘.' },
    { label: '🌈 NeoPixel 무지개', text: 'GPIO 14번에 연결된 12구 NeoPixel LED 바에 무지개 회전 효과(Rainbow Cycle)를 내는 코드를 작성해줘.' },
    { label: '🌐 웹 서버 구동', text: 'ESP32가 WiFi에 접속한 후 간단한 웹 서버를 열어서, 접속한 클라이언트에게 "Hello from VibeESP32!" 메시지를 담은 HTML 페이지를 반환하는 코드를 작성해줘.' },
    { label: '🎮 테트리스 게임', text: 'SoftI2C와 ssd1306을 사용해 128x64 OLED 디스플레이에서 구동되는 테트리스 게임 코드를 작성해줘.' },
    { label: '🌤️ 서울 날씨 & OLED & NeoPixel', text: '오픈웨더맵 API를 활용하여 서울의 실시간 날씨를 가져와 시리얼 모니터와 OLED 디스플레이에 출력하고, 날씨 정보에 따라 NeoPixel 색상을 파란색(비/눈), 주황색(맑음), 흰색(흐림) 등으로 제어하는 코드를 작성해줘.' },
    { label: '🔮 TCS34725 컬러센서 Mood Light', text: 'GPIO 17(SDA)과 GPIO 16(SCL)에 연결된 TCS34725 컬러센서에서 컬러 값을 읽어와, 감지한 색상과 동일한 색으로 GPIO 14에 연결된 NeoPixel LED를 켜는 스마트 무드등 코드를 작성해줘.' }
  ];

  // Firebase Google Login & Logout handlers
  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      alert("Firebase 설정이 활성화되지 않았습니다. 루트 폴더의 .env.local 파일에 설정 정보를 등록해 주세요.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      alert(`로그인 실패: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setHistoryList([]);
    } catch (error: any) {
      console.error("Sign-Out Error:", error);
    }
  };

  // Real-time listener for Firestore History Logs or Local Storage Fallback
  useEffect(() => {
    if (!user) {
      // Load from localStorage for non-logged-in users
      try {
        const localData = localStorage.getItem('vibe_local_history');
        if (localData) {
          setHistoryList(JSON.parse(localData));
        } else {
          setHistoryList([]);
        }
      } catch (e) {
        console.error("Failed to parse local history:", e);
        setHistoryList([]);
      }
      setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true);
    const q = query(
      collection(db, `users/${user.uid}/history`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setHistoryList(list);
      setIsLoadingHistory(false);
    }, (error) => {
      console.error("Firestore history listener error:", error);
      setIsLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Save history log helper
  const saveHistory = async (type: 'generate' | 'run', historyCode: string, historyExplanation: string, historyPrompt?: string) => {
    // 1. 중복 기록 방지: 직전 저장된 코드와 동일한 코드는 연속으로 저장하지 않음
    if (historyList.length > 0 && historyList[0].code.trim() === historyCode.trim()) {
      return;
    }

    const newLog = {
      type,
      prompt: historyPrompt || (type === 'run' ? '직접 작성 및 실행' : 'AI 코드 생성'),
      code: historyCode,
      // 2. 단순 실행(run) 로그는 불필요하게 큰 설명글(explanation)을 저장하지 않아 DB 경량화
      explanation: type === 'run' ? '' : historyExplanation,
      createdAt: new Date().toISOString()
    };

    if (!user) {
      // Save to localStorage for non-logged-in users
      try {
        const updatedList = [
          { id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9), ...newLog },
          ...historyList
        ].slice(0, 50); // limit to 50 logs
        setHistoryList(updatedList);
        localStorage.setItem('vibe_local_history', JSON.stringify(updatedList));
      } catch (e) {
        console.error("Failed to save local history:", e);
      }
      return;
    }

    try {
      await addDoc(collection(db, `users/${user.uid}/history`), newLog);
    } catch (error) {
      console.error("Error saving history:", error);
    }
  };

  // Delete history item
  const deleteHistoryItem = async (historyId: string) => {
    if (!confirm("정말 이 작업 기록을 삭제하시겠습니까?")) return;

    if (!user) {
      // Delete from localStorage
      try {
        const updatedList = historyList.filter(item => item.id !== historyId);
        setHistoryList(updatedList);
        localStorage.setItem('vibe_local_history', JSON.stringify(updatedList));
      } catch (e) {
        console.error("Failed to delete local history:", e);
      }
      return;
    }

    try {
      await deleteDoc(doc(db, `users/${user.uid}/history`, historyId));
    } catch (error) {
      console.error("Error deleting history:", error);
    }
  };

  // Clear all history logs
  const clearAllHistory = async () => {
    if (historyList.length === 0) {
      alert("삭제할 기록이 없습니다.");
      return;
    }
    if (!confirm(`정말 전체 히스토리 기록(${historyList.length}개)을 모두 삭제하시겠습니까?`)) {
      return;
    }
    
    if (!user) {
      // Clear localStorage
      try {
        setHistoryList([]);
        localStorage.removeItem('vibe_local_history');
        alert("모든 로컬 히스토리 기록이 성공적으로 삭제되었습니다.");
      } catch (e) {
        console.error("Failed to clear local history:", e);
      }
      return;
    }

    try {
      const deletePromises = historyList.map(item => 
        deleteDoc(doc(db, `users/${user.uid}/history`, item.id))
      );
      await Promise.all(deletePromises);
      alert("모든 기록이 성공적으로 삭제되었습니다.");
    } catch (error) {
      console.error("Error clearing all history:", error);
      alert("전체 히스토리 삭제 중 오류가 발생했습니다.");
    }
  };

  // Web Serial API - Connect to ESP32
  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) {
        alert('이 브라우저는 Web Serial API를 지원하지 않습니다. Chrome, Edge 또는 Opera를 사용해 주세요.');
        return;
      }
      
      setErrorMsg(null);
      const selectedPort = await (navigator as any).serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });
      
      setPort(selectedPort);
      setIsConnected(true);
      
      const info = selectedPort.getInfo();
      const portDesc = `USB (Vendor ID: 0x${(info.usbVendorId || 0).toString(16)}, Product ID: 0x${(info.usbProductId || 0).toString(16)})`;
      setPortInfo(portDesc);
      
      setTerminalOutput(prev => prev + `[시스템] ESP32 보드에 연결되었습니다.\n`);
      
      // Start reading data stream
      keepReadingRef.current = true;
      readFromSerial(selectedPort);

      // Auto-load files on board connection after a brief delay (extended to 1200ms for boot safety)
      setTimeout(() => {
        refreshBoardFiles(selectedPort);
      }, 1200);
    } catch (err: any) {
      console.error(err);
      if (err.name !== 'NotFoundError') {
        setErrorMsg(`보드 연결 실패: ${err.message}`);
        setTerminalOutput(prev => prev + `[시스템] 연결 실패: ${err.message}\n`);
      }
    }
  };

  // Web Serial API - Disconnect
  const disconnectSerial = async () => {
    keepReadingRef.current = false;
    
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (e) {
        console.error('Reader cancel error:', e);
      }
    }
    
    if (port) {
      try {
        await port.close();
      } catch (e) {
        console.error('Port close error:', e);
      }
    }
    
    setPort(null);
    setIsConnected(false);
    setPortInfo('');
    setBoardFiles([]);
    setTerminalOutput(prev => prev + '[시스템] 연결이 해제되었습니다.\n');
  };

  // Web Serial API - Read loop
  const readFromSerial = async (activePort: any) => {
    const decoder = new TextDecoder();
    let serialLineBuffer = '';
    
    while (activePort.readable && keepReadingRef.current) {
      try {
        const reader = activePort.readable.getReader();
        readerRef.current = reader;
        
        try {
          while (keepReadingRef.current) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            if (value) {
              const text = decoder.decode(value);

              // Always accumulate into line buffer for system file parsing (handles fragment splits)
              serialLineBuffer += text;

              // Direct regex matching for FILES: [...] regardless of newlines
              const match = serialLineBuffer.match(/FILES:\s*(\[.*?\])/);
              if (match) {
                try {
                  const filesJson = match[1].replace(/'/g, '"');
                  const files = JSON.parse(filesJson);
                  setBoardFiles(files);
                } catch (e) {
                  console.error('Board files list parse error:', e);
                } finally {
                  // Remove the parsed portion from buffer to prevent reprocessing
                  const matchEndIndex = match.index! + match[0].length;
                  serialLineBuffer = serialLineBuffer.substring(matchEndIndex);
                }
              }

              // Prevent line buffer from growing indefinitely
              if (serialLineBuffer.length > 4096) {
                if (serialLineBuffer.indexOf('FILES:') === -1) {
                  serialLineBuffer = serialLineBuffer.slice(-1024);
                } else if (serialLineBuffer.length > 16384) {
                  serialLineBuffer = serialLineBuffer.slice(-2048);
                }
              }

              // 2. Logging to Terminal if not actively uploading raw files
              if (!isUploadingRef.current) {
                const lines = text.split(/[\r\n]+/);
                const filteredLines = lines.filter(line => {
                  const trimmed = line.trim();
                  return (
                    !trimmed.startsWith('===') && 
                    !trimmed.startsWith('>>>') && 
                    trimmed !== '>' &&
                    trimmed !== 'raw REPL; CTRL-B to exit' &&
                    trimmed !== 'OK' &&
                    !/^[Jj\s]>*$/.test(trimmed)
                  );
                });

                if (filteredLines.length > 0) {
                  setTerminalOutput(prev => prev + filteredLines.join('\n') + '\n');
                }
              }
            }
          }
        } catch (readErr) {
          console.error('Serial read error within loop:', readErr);
        } finally {
          reader.releaseLock();
          readerRef.current = null;
        }
      } catch (err: any) {
        console.error('Serial reader start error:', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // Web Serial API - Send helper
  const writeToSerialPort = async (data: string | Uint8Array, activePort: any = port) => {
    if (!activePort || !activePort.writable) {
      throw new Error('시리얼 포트가 연결되어 있지 않습니다.');
    }
    
    const writer = activePort.writable.getWriter();
    try {
      const encoder = new TextEncoder();
      const bytes = typeof data === 'string' ? encoder.encode(data) : data;
      
      const chunkSize = 64;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        await writer.write(chunk);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      writer.releaseLock();
    }
  };

  // Web Serial API - Run MicroPython Code
  const runCode = async (codeToRun: string = code, explanationToSave: string = explanation, promptToSave: string = prompt) => {
    if (!isConnected || !port) {
      alert('먼저 ESP32 보드를 연결해 주세요.');
      return;
    }
    
    try {
      setTerminalOutput('[시스템] 코드를 보드에 전송하고 있습니다...\n');
      
      // Convert code to base64 (supporting Unicode characters in comments)
      const base64Data = btoa(unescape(encodeURIComponent(codeToRun)));

      // Upload the code as '_run.py' using our stable upload function (do not refresh board files list here)
      await uploadFileToBoard('_run.py', base64Data, false);

      // Add a 300ms safety buffer after upload completes and exits Raw REPL
      await new Promise(resolve => setTimeout(resolve, 300));

      // Clear terminal and start execution log
      setTerminalOutput('[시스템] 코드 전송 완료. 실행을 시작합니다...\n');
      
      // Send Ctrl+C to clear any dirty characters on the normal REPL line before executing
      await writeToSerialPort(new Uint8Array([3]));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await writeToSerialPort("exec(open('_run.py', 'rb').read().decode('utf-8'), globals())\r\n");
      if (auth.currentUser) {
        saveHistory('run', codeToRun, explanationToSave, promptToSave);
      }
    } catch (err: any) {
      console.error(err);
      setTerminalOutput(prev => prev + `[시스템] 코드 전송 및 실행 실패: ${err.message}\n`);
    }
  };

  const handleLoadHistory = (item: any) => {
    setCode(item.code);
    setExplanation(item.explanation || '');
    setPrompt(item.prompt === '직접 작성 및 실행' ? '' : item.prompt || '');
    setEditorTab('preview');
    setActiveTab('dashboard');
  };

  const handleLoadAndRunHistory = async (item: any) => {
    setCode(item.code);
    setExplanation(item.explanation || '');
    setPrompt(item.prompt === '직접 작성 및 실행' ? '' : item.prompt || '');
    setEditorTab('preview');
    setActiveTab('dashboard');
    
    setTimeout(() => {
      if (isConnected && port) {
        runCode(item.code, item.explanation || '', item.prompt || '');
      } else {
        alert('코드를 에디터에 로드했습니다. 보드가 연결되면 실행해 주세요.');
      }
    }, 150);
  };

  // Web Serial API - Stop Execution
  const stopCode = async () => {
    if (!isConnected || !port) {
      alert('연결된 ESP32 보드가 없습니다.');
      return;
    }
    
    try {
      await writeToSerialPort(new Uint8Array([3]));
      setTerminalOutput('[시스템] 실행을 중지했습니다.\n');
    } catch (err: any) {
      console.error(err);
      setTerminalOutput(`[시스템] 중지 오류: ${err.message}\n`);
    }
  };

  // Helper to reliably stop execution and enter Raw REPL
  const enterRawREPL = async (activePort: any = port) => {
    // Send Ctrl+C twice to stop any active infinite loops
    await writeToSerialPort(new Uint8Array([3]), activePort);
    await new Promise(resolve => setTimeout(resolve, 150));
    await writeToSerialPort(new Uint8Array([3]), activePort);
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // Send Ctrl+A to enter Raw REPL
    await writeToSerialPort(new Uint8Array([1]), activePort);
    await new Promise(resolve => setTimeout(resolve, 250));
  };

  // MicroPython File Explorer - Refresh Files
  const refreshBoardFiles = async (activePort: any = port) => {
    if (!activePort) {
      return;
    }
    setIsRefreshingFiles(true);
    try {
      isUploadingRef.current = true;
      // 1. Enter Raw REPL reliably
      await enterRawREPL(activePort);
      
      // 2. Command print list recursively
      const listCmd = "import os\ndef _list_all(d=''):\n  r = []\n  try:\n    for f in os.listdir(d if d else '.'):\n      p = d + '/' + f if d else f\n      try:\n        os.listdir(p)\n        r.extend(_list_all(p))\n      except:\n        r.append(p)\n  except: pass\n  return r\nprint('FILES:', _list_all())\n";
      await writeToSerialPort(listCmd, activePort);
      await new Promise(resolve => setTimeout(resolve, 300));
      // 3. Send Ctrl+D (execute)
      await writeToSerialPort(new Uint8Array([4]), activePort);
      await new Promise(resolve => setTimeout(resolve, 400));
      // 4. Send Ctrl+B (Exit Raw REPL)
      await writeToSerialPort(new Uint8Array([2]), activePort);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for REPL to be ready
      
      setTimeout(() => {
        isUploadingRef.current = false;
        setIsRefreshingFiles(false);
      }, 200);
    } catch (e) {
      console.error(e);
      isUploadingRef.current = false;
      setIsRefreshingFiles(false);
    }
  };

  // MicroPython File Explorer - Upload file over Base64 chunked streams
  const uploadFileToBoard = async (fileName: string, base64Data: string, shouldRefresh: boolean = true) => {
    if (!isConnected || !port) {
      alert('보드가 연결되어 있지 않습니다.');
      return;
    }
    
    setIsUploadingFile(true);
    isUploadingRef.current = true;
    setTerminalOutput(prev => prev + `[시스템] 파일 업로드 중: ${fileName}...\n`);

    try {
      // 1. Enter Raw REPL reliably
      await enterRawREPL(port);

      // Create directories recursively if the filename contains folders
      const parts = fileName.split('/');
      if (parts.length > 1) {
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
          const mkdirCmd = `import os\ntry: os.mkdir('${currentPath}')\nexcept: pass\n`;
          await writeToSerialPort(mkdirCmd);
          await new Promise(resolve => setTimeout(resolve, 100));
          await writeToSerialPort(new Uint8Array([4])); // execute mkdir
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 2. Write in one go using a single python execution in Raw REPL to avoid loops and dramatic delays
      const pythonCommand = `import ubinascii\n` +
        `b64 = """${base64Data}"""\n` +
        `with open('${fileName}', 'wb') as f: f.write(ubinascii.a2b_base64(b64.strip()))\n`;
      await writeToSerialPort(pythonCommand);
      await new Promise(resolve => setTimeout(resolve, 150));
      await writeToSerialPort(new Uint8Array([4])); // execute write
      await new Promise(resolve => setTimeout(resolve, 400)); // wait for write to finish

      // 3. Send Ctrl+B (Exit Raw REPL)
      await writeToSerialPort(new Uint8Array([2]));
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for REPL to be ready
      
      isUploadingRef.current = false;
      setIsUploadingFile(false);
      setTerminalOutput(prev => prev + `[시스템] 파일 업로드 완료: ${fileName}\n`);

      // 4. Refresh files list synchronously if requested
      if (shouldRefresh) {
        await refreshBoardFiles();
      }
    } catch (err: any) {
      console.error(err);
      isUploadingRef.current = false;
      setIsUploadingFile(false);
      alert(`파일 업로드 오류: ${err.message}`);
    }
  };

  // Trigger file selection upload
  const handleLocalFileUpload = () => {
    if (!uploadFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const binaryString = reader.result as string;
      const base64 = btoa(binaryString);
      await uploadFileToBoard(uploadFile.name, base64, true);
      setUploadFile(null);
    };
    reader.readAsBinaryString(uploadFile);
  };

  // Select folder files and filter
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const pyFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const name = files[i].name.toLowerCase();
      if (
        name.endsWith('.py') || 
        name.endsWith('.txt') || 
        name.endsWith('.json') || 
        name.endsWith('.html') ||
        name.endsWith('.xml')
      ) {
        pyFiles.push(files[i]);
      }
    }
    setSelectedFolderFiles(pyFiles);
  };

  // Upload multiple folder files in a single Raw REPL session
  const handleFolderUpload = async () => {
    if (selectedFolderFiles.length === 0) {
      alert('업로드할 폴더 또는 파일이 없습니다.');
      return;
    }
    if (!isConnected || !port) {
      alert('보드가 연결되어 있지 않습니다.');
      return;
    }

    setIsUploadingFile(true);
    isUploadingRef.current = true;
    setTerminalOutput(prev => prev + `[시스템] 폴더 업로드 시작: 총 ${selectedFolderFiles.length}개 파일\n`);

    try {
      // 1. Enter Raw REPL once
      await writeToSerialPort(new Uint8Array([3]));
      await new Promise(resolve => setTimeout(resolve, 250));
      await writeToSerialPort(new Uint8Array([1]));
      await new Promise(resolve => setTimeout(resolve, 250));

      for (let fileIndex = 0; fileIndex < selectedFolderFiles.length; fileIndex++) {
        const file = selectedFolderFiles[fileIndex];
        const relativePath = file.webkitRelativePath || file.name;
        
        setTerminalOutput(prev => prev + `[시스템] (${fileIndex + 1}/${selectedFolderFiles.length}) 파일 업로드 중: ${relativePath}...\n`);
        
        // Read file contents as Base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const binaryString = reader.result as string;
            resolve(btoa(binaryString));
          };
          reader.onerror = reject;
          reader.readAsBinaryString(file);
        });

        // 2. Ensure parent directories exist on the ESP32
        const parts = relativePath.split('/');
        if (parts.length > 1) {
          let currentPath = '';
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            const mkdirCmd = `import os\ntry: os.mkdir('${currentPath}')\nexcept: pass\n`;
            await writeToSerialPort(mkdirCmd);
            await new Promise(resolve => setTimeout(resolve, 100));
            await writeToSerialPort(new Uint8Array([4])); // execute mkdir
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // 3. Write in one go using a single python execution in Raw REPL to avoid loops and dramatic delays
        const pythonCommand = `import ubinascii\n` +
          `b64 = """${base64Data}"""\n` +
          `with open('${relativePath}', 'wb') as f: f.write(ubinascii.a2b_base64(b64.strip()))\n`;
        await writeToSerialPort(pythonCommand);
        await new Promise(resolve => setTimeout(resolve, 150));
        await writeToSerialPort(new Uint8Array([4])); // execute write chunk
        await new Promise(resolve => setTimeout(resolve, 400)); // wait for write to finish
      }

      // 4. Exit Raw REPL
      await writeToSerialPort(new Uint8Array([2]));
      await new Promise(resolve => setTimeout(resolve, 500));
      
      isUploadingRef.current = false;
      setIsUploadingFile(false);
      setSelectedFolderFiles([]);
      setTerminalOutput(prev => prev + `[시스템] 폴더 업로드 완료!\n`);

      // 5. Refresh files list synchronously
      await refreshBoardFiles();
    } catch (err: any) {
      console.error(err);
      isUploadingRef.current = false;
      setIsUploadingFile(false);
      alert(`폴더 업로드 중 오류 발생: ${err.message}`);
    }
  };

  // MicroPython File Explorer - Quick Install Preset Libraries
  const installPresetLibrary = async (libName: string, libCode: string) => {
    // Standard MicroPython library path must be inside '/lib' folder
    const targetPath = `lib/${libName}`;

    // Clean up any legacy, duplicate, or broken versions from root/lib folders
    try {
      setTerminalOutput(prev => prev + `[시스템] 기존의 중복되거나 손상된 라이브러리 정리 중...\n`);
      await enterRawREPL(port);
      
      // Clean up commands for both ssd1306 and tcs34725
      const cleanCmd = `import os\n` + 
        `for p in ['${libName}', 'lib/${libName}', '/lib/${libName}']:\n` +
        `  try: os.remove(p)\n` +
        `  except: pass\n`;
        
      await writeToSerialPort(cleanCmd);
      await new Promise(resolve => setTimeout(resolve, 200));
      await writeToSerialPort(new Uint8Array([4])); // execute cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      await writeToSerialPort(new Uint8Array([2])); // exit Raw REPL
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error("Cleanup error:", e);
    }

    const base64 = btoa(unescape(encodeURIComponent(libCode)));
    // Upload without immediate refresh
    await uploadFileToBoard(targetPath, base64, false);

    // After uploading, soft reboot the board to clear MicroPython import cache
    try {
      setTerminalOutput(prev => prev + `[시스템] 라이브러리 인식 장치 재부팅 중...\n`);
      await writeToSerialPort(new Uint8Array([3])); // Ctrl+C
      await new Promise(resolve => setTimeout(resolve, 150));
      await writeToSerialPort(new Uint8Array([4])); // Ctrl+D (Soft reboot)
      await new Promise(resolve => setTimeout(resolve, 500)); // wait for reboot stabilization
      setTerminalOutput(prev => prev + `[시스템] 라이브러리 설치 및 재부팅 완료!\n`);
    } catch (e) {
      console.error("Soft reboot error:", e);
    }

    // Refresh files list synchronously after all tasks are completed
    await refreshBoardFiles();
  };

  // MicroPython File Explorer - Delete File
  const deleteBoardFile = async (fileName: string) => {
    if (!isConnected || !port) {
      alert('보드가 연결되어 있지 않습니다.');
      return;
    }
    if (!confirm(`정말 보드에서 ${fileName} 파일을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      isUploadingRef.current = true;
      setTerminalOutput(prev => prev + `[시스템] 파일 삭제 중: ${fileName}...\n`);
      
      // 1. Enter Raw REPL reliably
      await enterRawREPL(port);

      const cmd = `import os\ntry:\n    os.remove('${fileName}')\n    print("[시스템] ${fileName} 삭제 성공")\nexcept Exception as e:\n    print("[에러] 삭제 실패:", e)\n`;
      await writeToSerialPort(cmd);
      await new Promise(resolve => setTimeout(resolve, 250));
      await writeToSerialPort(new Uint8Array([4])); // execute delete
      await new Promise(resolve => setTimeout(resolve, 400));

      // 2. Exit Raw REPL
      await writeToSerialPort(new Uint8Array([2]));
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for REPL to be ready
      isUploadingRef.current = false;

      // 3. Refresh files list synchronously
      await refreshBoardFiles();
    } catch (err: any) {
      console.error(err);
      isUploadingRef.current = false;
      alert(`파일 삭제 실패: ${err.message}`);
    }
  };

  // Browser-based Firmware Flashing (Thonny Flasher Engine)
  const flashFirmware = async () => {
    if (isConnected) {
      alert('펌웨어를 설치하기 전에 상단의 [보드 연결 해제]를 완료해 주세요.');
      return;
    }
    
    setIsFlashing(true);
    setFlashSuccess(false); // Reset success state
    setFlashingStatus('준비 중...');
    setFlashProgress(0);

    let transport: any = null;

    try {
      // 1. Fetch Firmware Bin
      setFlashingStatus('서버에서 MicroPython 펌웨어 파일 다운로드 중...');
      const response = await fetch('/firmware/esp32_micropython.bin');
      if (!response.ok) {
        throw new Error('esp32_micropython.bin 파일을 서버에서 다운로드할 수 없습니다. public/firmware 폴더 내에 배치되어 있는지 확인해 주세요.');
      }
      const arrayBuffer = await response.arrayBuffer();
      const firmwareData = new Uint8Array(arrayBuffer);

      // 2. Request Port for Flashing
      setFlashingStatus('보드 연결 포트를 선택해 주세요...');
      const flashPort = await (navigator as any).serial.requestPort();
      
      setFlashingStatus('부트로더 연결 준비 중...');
      transport = new Transport(flashPort);
      
      let logOutput = '';
      const appendLog = (text: string) => {
        logOutput += text + '\n';
        setFlashingStatus(logOutput);
      };

      const esploader = new ESPLoader({
        transport: transport,
        baudrate: 115200,
        terminal: {
          clean: () => { logOutput = ''; setFlashingStatus(''); },
          writeLine: (data) => appendLog(data),
          write: (data) => appendLog(data),
        }
      });

      setFlashingStatus('ESP32 ROM 부트로더 통신 핸드셰이크 시도 중...\n(보드의 BOOT/IO0 버튼을 잠시 누르고 있어 주세요)');
      await esploader.main();
      appendLog('\n[성공] ESP32 보드와 부트로더 연결이 성립되었습니다.');

      // Erase flash if selected
      if (shouldEraseFlash) {
        appendLog('Flash 메모리 전체 초기화(Erase) 중... 약 5~10초 소요됩니다.');
        await esploader.eraseFlash();
        appendLog('[성공] Flash 초기화 완료.');
      }

      // Write flash
      appendLog('MicroPython 펌웨어 바이너리 라이팅 시작...');
      const fileArray = [
        {
          data: firmwareData,
          address: 0x1000,
        }
      ];

      await esploader.writeFlash({
        fileArray: fileArray,
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (_fileIndex, written, total) => {
          const percent = Math.round((written / total) * 100);
          setFlashProgress(percent);
        }
      });

      appendLog('\n[성공] MicroPython 펌웨어 설치가 완료되었습니다!');
      setFlashProgress(100);
      setFlashSuccess(true); // Flashing succeeded!
      alert('MicroPython 펌웨어가 성공적으로 설치되었습니다!\n보드의 EN/RST 버튼을 한 번 눌러 리부팅해 주시기 바랍니다.');
    } catch (err: any) {
      console.error(err);
      setFlashSuccess(false);
      setFlashingStatus(prev => prev + `\n[에러] 설치 실패: ${err.message}`);
    } finally {
      if (transport) {
        try {
          await transport.disconnect();
        } catch (closeErr) {}
      }
      setIsFlashing(false);
    }
  };

  // AI Code Generation Streaming Handler
  const generateAICode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setEditorTab('preview'); 
    
    let generatedCodeBuffer = '';
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `서버 에러 (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('스트리밍을 지원하지 않는 브라우저입니다.');
      }

      const decoder = new TextDecoder();
      let streamBuffer = '';
      setCode(''); 
      setExplanation('');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || ''; 

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          if (trimmed.startsWith('data: ')) {
            const dataVal = trimmed.slice(6).trim();
            if (dataVal === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(dataVal);
              const content = parsed.choices[0]?.delta?.content || '';
              generatedCodeBuffer += content;
              
              const stripFences = (text: string) => {
                // 프리앰블 텍스트(코드 펜스 이전 설명문) 제거
                const fencePos = text.indexOf('```');
                if (fencePos > 0) text = text.slice(fencePos);
                // 여는 펜스 제거 (```python, ```micropython 등 모든 언어 태그)
                text = text.replace(/^```[\w]*\r?\n?/, '');
                // 닫는 펜스 제거 (뒤에 공백/개행이 있어도 처리)
                text = text.replace(/```\s*$/, '');
                return text.trim();
              };

              const parts = generatedCodeBuffer.split('__EXPLANATION__');
              if (parts.length > 1) {
                setCode(stripFences(parts[0]));
                setExplanation(parts[1].replace(/^```[\w]*\r?\n?/, '').replace(/```\s*$/, '').trim());
              } else {
                setCode(stripFences(parts[0]));
              }
            } catch (jsonErr) {
              // Ignore partial JSON
            }
          }
        }
      }

      if (auth.currentUser) {
        const stripFences = (text: string) => {
          const fencePos = text.indexOf('```');
          if (fencePos > 0) text = text.slice(fencePos);
          text = text.replace(/^```[\w]*\r?\n?/, '');
          text = text.replace(/```\s*$/, '');
          return text.trim();
        };

        const parts = generatedCodeBuffer.split('__EXPLANATION__');
        const finalCode = stripFences(parts[0]);
        const finalExplanation = parts.length > 1 ? parts[1].replace(/^```[\w]*\r?\n?/, '').replace(/```\s*$/, '').trim() : '';
        saveHistory('generate', finalCode, finalExplanation, prompt);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '코드 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Light-themed Python syntax highlighters
  const colorizePythonLight = (sourceCode: string) => {
    if (!sourceCode.trim()) {
      return <span className="text-slate-400 italic"># 생성된 코드가 여기에 표시됩니다...</span>;
    }
    
    const lines = sourceCode.split('\n');
    const keywords = [
      'import', 'from', 'def', 'return', 'while', 'for', 'in', 'if', 'else', 'elif', 
      'try', 'except', 'True', 'False', 'None', 'as', 'pass', 'break', 'class', 'global'
    ];
    
    return lines.map((line, lineIdx) => {
      const commentIdx = line.indexOf('#');
      let codePart = commentIdx === -1 ? line : line.slice(0, commentIdx);
      const commentPart = commentIdx === -1 ? '' : line.slice(commentIdx);
      
      const tokens: React.ReactNode[] = [];
      let lastIdx = 0;
      
      const regex = /("[^"]*"|'[^']*'|\b\d+\b|\b\w+\b)/g;
      let match;
      
      while ((match = regex.exec(codePart)) !== null) {
        const matchIdx = match.index;
        if (matchIdx > lastIdx) {
          tokens.push(codePart.slice(lastIdx, matchIdx));
        }
        
        const token = match[0];
        const key = `token-${lineIdx}-${matchIdx}`;
        
        if (keywords.includes(token)) {
          tokens.push(<span key={key} className="text-indigo-600 font-bold">{token}</span>);
        } else if (token.startsWith('"') || token.startsWith("'")) {
          tokens.push(<span key={key} className="text-amber-700 font-medium">{token}</span>);
        } else if (!isNaN(Number(token))) {
          tokens.push(<span key={key} className="text-pink-600 font-semibold">{token}</span>);
        } else if (['Pin', 'ADC', 'PWM', 'I2C', 'SPI', 'neopixel', 'time', 'machine', 'sleep', 'sleep_ms', 'print'].includes(token)) {
          tokens.push(<span key={key} className="text-teal-600 font-bold">{token}</span>);
        } else {
          tokens.push(token);
        }
        
        lastIdx = regex.lastIndex;
      }
      
      if (lastIdx < codePart.length) {
        tokens.push(codePart.slice(lastIdx));
      }
      
      return (
        <div key={lineIdx} className="min-h-[1.5rem] flex items-center leading-normal">
          <span className="flex-1 whitespace-pre text-slate-700 font-mono text-[13px]">{tokens}{commentPart && <span className="text-slate-400 italic font-normal font-sans">{commentPart}</span>}</span>
        </div>
      );
    });
  };

  // Copy helper
  const copyCode = () => {
    const textToCopy = editorTab === 'explain' ? explanation : code;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // File Download Helper
  const downloadFile = () => {
    let content = '';
    let filename = '';
    let mimeType = 'text/plain';

    if (editorTab === 'explain') {
      content = explanation;
      filename = 'explanation.txt';
    } else {
      content = code;
      filename = 'main.py';
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Beautiful code explanation formatter (removes markdown hashes/asterisks/backticks and adds emojis)
  const renderExplanation = (text: string) => {
    if (!text) return <span className="text-slate-500 italic font-title">코드 설명이 아직 생성되지 않았습니다. 자연어 명령으로 코드를 생성해 보세요.</span>;
    
    // Format the text by lines
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // 0. Pre-clean escaped markdown characters and trim whitespace
      let content = line.trim().replace(/\\`/g, '`').replace(/\\\*/g, '*').replace(/\\_/g, '_');
      
      // 1. Heading 1 format: ### 1. 전체 알고리즘 구조 -> 💡 1. 전체 알고리즘 구조
      if (content.startsWith('### 1.') || content.startsWith('1. 전체 알고리즘 구조') || content.startsWith('💡 1.')) {
        content = content.replace(/💡\s*/g, '').replace(/###\s*/g, '').replace(/1\.\s*/g, '').replace(/#/g, '').replace(/\*/g, '').trim();
        content = '💡 1. ' + content;
        return (
          <div key={idx} className="font-title font-black text-sm sm:text-base text-slate-900 mt-4 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1.5 flex-wrap">
            {content}
          </div>
        );
      }
      
      // 2. Heading 2 format: ### 2. 주요 코드 라인별 세부 설명 -> 🔍 2. 주요 코드 라인별 세부 설명
      if (content.startsWith('### 2.') || content.startsWith('2. 주요 코드 라인별 세부 설명') || content.startsWith('🔍 2.')) {
        content = content.replace(/🔍\s*/g, '').replace(/###\s*/g, '').replace(/2\.\s*/g, '').replace(/#/g, '').replace(/\*/g, '').trim();
        content = '🔍 2. ' + content;
        return (
          <div key={idx} className="font-title font-black text-sm sm:text-base text-slate-900 mt-6 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1.5 flex-wrap">
            {content}
          </div>
        );
      }

      // 3. Generic Heading format: ### Title -> 📌 Title
      if (content.startsWith('###')) {
        content = content.replace(/###\s*/, '📌 ').replace(/#/g, '').replace(/\*/g, '').trim();
        return (
          <div key={idx} className="font-title font-bold text-xs sm:text-sm text-slate-900 mt-4 mb-2 flex items-center gap-1">
            {content}
          </div>
        );
      }
      
      // 4. Algorithm name item format: - **Name**: or 📌 Name -> 📌 Name
      if (content.startsWith('- **') || content.startsWith('-**') || content.startsWith('📌')) {
        content = content.replace(/-\s*\*\*/, '').replace(/\*\*/g, '').replace(/^-/, '').replace(/^📌\s*/, '').trim();
        content = content.replace(/`/g, '').replace(/\*/g, '').replace(/#/g, '').replace(/\\/g, '');
        content = '📌 ' + content;
        return (
          <div key={idx} className="font-extrabold text-[13px] text-slate-800 mt-2 mb-1.5 font-title">
            {content}
          </div>
        );
      }

      // 5. Code line item format: - `code`: or ▶️ code -> ▶️ code
      if (content.startsWith('- `') || content.startsWith('-`') || content.startsWith('▶️')) {
        content = content.replace(/-\s*`/, '').replace(/`/g, '').replace(/^-/, '').replace(/^▶️\s*/, '').trim();
        content = content.replace(/\\/g, '');
        content = '▶️ ' + content;
        return (
          <div key={idx} className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50/50 p-2 px-3 rounded-xl border border-indigo-100/50 mt-3.5 mb-1.5 whitespace-pre-wrap leading-normal">
            {content}
          </div>
        );
      }

      // 6. Generic bullet points: - content -> ▪️ content
      if (content.startsWith('- ')) {
        content = content.replace(/^-\s*/, '▪️ ').replace(/\*/g, '').replace(/`/g, '').replace(/#/g, '').replace(/\\/g, '').trim();
      } else {
        content = content.replace(/`/g, '').replace(/\*/g, '').replace(/#/g, '').replace(/\\/g, '');
      }

      // General paragraph
      return (
        <div key={idx} className="text-slate-700 leading-relaxed font-sans font-medium text-[13px] my-1 pl-1 whitespace-pre-wrap">
          {content}
        </div>
      );
    });
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Top Header Bar */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl shadow-md shadow-indigo-500/10">
            <Cpu className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-title">
              VibeESP32
            </h1>
            <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase font-title">
              바이브코딩 IoT 제어 플랫폼
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-slate-100 border border-slate-200 rounded-xl">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base md:text-lg font-black font-title tracking-wide rounded-lg transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🔌 바이브 대시보드
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base md:text-lg font-black font-title tracking-wide rounded-lg transition-all ${
              activeTab === 'tools'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ⚙️ 보드 도구 (Tools)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base md:text-lg font-black font-title tracking-wide rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            📜 히스토리
          </button>
        </div>

        {/* Board Serial Port Connection Panel & Google Auth */}
        <div className="flex items-center gap-3">
          {/* Firebase Authentication UI */}
          {user ? (
            <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 px-3 rounded-2xl shadow-sm">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-5.5 h-5.5 rounded-full border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5.5 h-5.5 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                  <UserIcon className="w-3 h-3 text-indigo-600" />
                </div>
              )}
              <span className="text-xs font-bold text-slate-700 hidden lg:inline max-w-[100px] truncate">
                {user.displayName || '사용자'}
              </span>
              <div className="h-4 w-px bg-slate-200" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-slate-600 hover:text-rose-600 text-xs font-black font-title transition-all active:scale-95 cursor-pointer"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-black font-title text-slate-700 shadow-sm transition-all active:scale-95 hover:border-slate-300 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-500" />
              Google 로그인
            </button>
          )}

          {/* Board Serial Connection Panel */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 p-1.5 px-3.5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 connected-glow' : 'bg-rose-400'}`} />
              <span className="text-xs font-extrabold text-slate-700 hidden sm:inline">
                {isConnected ? '연결됨' : '미연결'}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            {isConnected ? (
              <button
                onClick={disconnectSerial}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-extrabold font-title text-slate-700 transition-all active:scale-95 cursor-pointer"
              >
                <CircuitBoard className="w-3.5 h-3.5 text-slate-500" />
                연결 해제
              </button>
            ) : (
              <button
                onClick={connectSerial}
                disabled={activeTab === 'tools' && isFlashing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-extrabold font-title text-white transition-all shadow-sm active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <CircuitBoard className="w-3.5 h-3.5" />
                ESP32 연결
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout (Fixed heights and items-start layout alignment) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        
        {activeTab === 'dashboard' ? (
          /* Dashboard Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column */}
            <section className="lg:col-span-7 flex flex-col gap-6">
              
              {/* AI Prompter Card - Pastel Lavender */}
              <div className="bg-violet-50/80 border border-violet-100/90 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                <div className="flex items-center gap-2 text-violet-700">
                  <Zap className="w-5.5 h-5.5" />
                  <h2 className="text-lg sm:text-xl font-black tracking-wide font-title">
                    자연어 명령 입력
                  </h2>
                </div>
                
                <form onSubmit={generateAICode} className="flex items-end gap-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="내장 LED를 0.5초 간격으로 깜빡이게 해줘..."
                    disabled={isGenerating}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (prompt.trim() && !isGenerating) {
                          generateAICode();
                        }
                      }
                    }}
                    className="flex-1 bg-white border border-violet-200/60 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner resize-y min-h-[60px] max-h-[150px] overflow-y-auto leading-relaxed"
                  />
                  <button
                    type="submit"
                    disabled={isGenerating || !prompt.trim()}
                    className="px-4 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed enabled:active:scale-95 flex-shrink-0 h-[46px] mb-0.5"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    생성
                  </button>
                </form>

                {/* Suggestions */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-violet-500/80 font-bold uppercase tracking-wider">추천 템플릿</span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPrompt(sug.text);
                          const matched = templates.find(t => t.label === sug.label);
                          if (matched) {
                            setCode(matched.code);
                            setExplanation(matched.explanation);
                          }
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-white hover:bg-violet-100/50 border border-violet-100 text-violet-700 font-medium transition-all shadow-sm text-left"
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* MicroPython Code Editor Card - Pastel Mint */}
              <div className="bg-emerald-50/80 border border-emerald-100/90 rounded-2xl flex flex-col shadow-sm h-[520px] overflow-hidden">
                
                {/* Editor Toolbar */}
                <div className="px-5 py-3 border-b border-emerald-100 flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CodeIcon className="w-5.5 h-5.5" />
                    <h2 className="text-lg sm:text-xl font-black tracking-wide font-title">
                      MicroPython 소스코드
                    </h2>
                  </div>

                  {/* Editor Tabs, Download & Copy */}
                  <div className="flex items-center gap-2">
                    <div className="flex p-0.5 bg-white border border-emerald-100 rounded-lg shadow-sm">
                      <button
                        onClick={() => setEditorTab('preview')}
                        className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md transition-all ${
                          editorTab === 'preview'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        프리뷰
                      </button>
                      <button
                        onClick={() => setEditorTab('edit')}
                        className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md transition-all ${
                          editorTab === 'edit'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <CodeIcon className="w-3 h-3" />
                        직접 수정
                      </button>
                      <button
                        onClick={() => setEditorTab('explain')}
                        className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md transition-all ${
                          editorTab === 'explain'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        코드 설명
                      </button>
                    </div>

                    <div className="h-4 w-px bg-emerald-200" />

                    {/* Save Button */}
                    <button
                      onClick={downloadFile}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 bg-white hover:bg-emerald-100/50 border border-emerald-100 rounded-lg text-emerald-700 transition-all active:scale-95 shadow-sm"
                      title={editorTab === 'explain' ? '설명 다운로드 (.txt)' : '코드 다운로드 (.py)'}
                    >
                      <Save className="w-3.5 h-3.5" />
                      저장
                    </button>

                    {/* Copy Button */}
                    <button
                      onClick={copyCode}
                      className="p-1.5 bg-white hover:bg-emerald-100/50 border border-emerald-100 rounded-lg text-emerald-700 transition-all active:scale-90 shadow-sm"
                      title="클립보드 복사"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Code Content View */}
                <div 
                  onKeyDown={handleEditorKeyDown}
                  tabIndex={0}
                  className="flex-1 flex overflow-hidden bg-white/90 border border-emerald-100/60 rounded-b-2xl p-4 focus:outline-none"
                >
                  
                  {editorTab === 'preview' && (
                    <div className="flex-1 flex overflow-auto h-full">
                      {/* Line Numbers */}
                      <div className="text-slate-400 text-right pr-4 select-none border-r border-slate-100 mr-4 font-mono text-xs flex flex-col justify-start flex-shrink-0">
                        {Array.from({ length: lineCount }, (_, i) => (
                          <div key={i} className="min-h-[1.5rem] leading-normal">{i + 1}</div>
                        ))}
                      </div>
                      {/* Code Block Content */}
                      <div ref={previewCodeRef} className="flex-1 text-slate-800 font-mono text-xs outline-none">
                        {colorizePythonLight(code)}
                      </div>
                    </div>
                  )}

                  {editorTab === 'edit' && (
                    <div className="flex-grow flex h-full overflow-hidden">
                      <pre
                        ref={lineRef}
                        className="text-slate-400 text-right pr-4 select-none border-r border-slate-100 mr-4 font-mono text-xs overflow-hidden leading-normal flex flex-col pt-0.5"
                      >
                        {lineNumbers}
                      </pre>
                      <textarea
                        ref={textareaRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onScroll={handleEditorScroll}
                        spellCheck={false}
                        className="flex-grow bg-transparent text-slate-800 outline-none resize-none font-mono text-xs overflow-y-auto leading-normal whitespace-pre pt-0.5 tab-size-4 focus:ring-0 h-full"
                        placeholder="# 소스코드를 직접 작성할 수 있습니다."
                      />
                    </div>
                  )}

                  {editorTab === 'explain' && (
                    <div ref={explanationContainerRef} className="flex-grow overflow-y-auto h-full p-2 text-slate-700 leading-relaxed font-sans text-sm outline-none">
                      {renderExplanation(explanation)}
                    </div>
                  )}

                  {/* Streaming Overlay Indicator */}
                  {isGenerating && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      AI 스트리밍 중...
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Right Column */}
            <section className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Action Control Panel - Pastel Coral */}
              <div className="bg-rose-50/80 border border-rose-100/90 rounded-2xl p-5 flex flex-col gap-4 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2 text-rose-700">
                  <Play className="w-5.5 h-5.5" />
                  <h2 className="text-lg sm:text-xl font-black tracking-wide font-title">
                    보드 동작 제어
                  </h2>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => runCode()}
                    disabled={!isConnected}
                    className="flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-black font-title text-base transition-all shadow-sm active:scale-95 disabled:pointer-events-none cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    코드 실행 (Run)
                  </button>

                  <button
                    onClick={stopCode}
                    disabled={!isConnected}
                    className="flex items-center justify-center gap-2 py-3.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-black font-title text-base transition-all shadow-sm active:scale-95 disabled:pointer-events-none cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    실행 중지 (Stop)
                  </button>
                </div>

                {/* Connection Information Footer */}
                {isConnected ? (
                  <div className="text-[11px] bg-white border border-rose-100/50 rounded-xl p-3 text-rose-800/80 flex flex-col gap-1">
                    <span className="text-emerald-600 font-bold">● ESP32 연결 활성화됨</span>
                    <span>장치 정보: {portInfo}</span>
                  </div>
                ) : (
                  <div className="text-[11px] bg-white border border-rose-100/50 rounded-xl p-3 text-rose-800/80 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-rose-600 font-bold block mb-0.5">ESP32 보드가 연결되지 않았습니다.</span>
                      상단의 보드 연결 단계를 마치고 포트가 열린 상태에서 코드 업로드가 가능합니다.
                    </div>
                  </div>
                )}
              </div>

              {/* Serial Terminal Monitor Card - Pastel Sky Blue (Strictly fixed height h-[450px]) */}
              <div className="bg-sky-50/80 border border-sky-100/90 rounded-2xl flex flex-col h-[450px] shadow-sm overflow-hidden flex-shrink-0">
                
                {/* Terminal Window Header */}
                <div className="px-4 py-3 border-b border-sky-100 flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center gap-2 text-sky-700">
                    <TerminalIcon className="w-5.5 h-5.5" />
                    <span className="text-lg sm:text-xl font-black tracking-wide font-title">시리얼 모니터</span>
                  </div>

                  <button
                    onClick={() => setTerminalOutput('')}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-white border border-sky-100 hover:bg-sky-100 text-sky-700 transition-all rounded-md shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                    비우기
                  </button>
                </div>

                {/* Terminal Logging Window */}
                <div 
                  tabIndex={0}
                  onKeyDown={handleTerminalKeyDown}
                  className="flex-grow p-4 m-4 mt-2 bg-white/90 border border-sky-100/60 rounded-xl overflow-y-auto font-mono text-xs text-sky-950 leading-relaxed shadow-inner focus:outline-none focus:ring-1 focus:ring-sky-200"
                >
                  <pre ref={terminalPreRef} className="whitespace-pre-wrap select-text font-mono">
                    {terminalOutput}
                    <span className="terminal-cursor ml-0.5 text-sky-600" />
                  </pre>
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </section>
          </div>
        ) : activeTab === 'tools' ? (
          /* Tools & Setup Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column (Drivers & Firmware Flasher) */}
            <section className="lg:col-span-6 flex flex-col gap-6">
              
              {/* 1. USB Driver Download Card - Pastel Lavender */}
              <div className="bg-violet-50/80 border border-violet-100/90 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                <div className="flex items-center gap-2 text-violet-700">
                  <Download className="w-5.5 h-5.5" />
                  <h2 className="text-lg sm:text-xl font-black tracking-wide font-title">
                    1. CP210x USB 드라이버 설치
                  </h2>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  ESP32 보드를 PC에 USB 케이블로 연결한 뒤 Web Serial 포트 목록에 나타나지 않거나 통신이 되지 않는다면, 보드의 시리얼 칩셋(CP210x 등)에 알맞은 가상 COM 포트(VCP) 드라이버 설치가 필요합니다.
                </p>

                <div className="flex items-center gap-3">
                  <a
                    href="/drivers/CP210x_Universal_Windows_Driver.zip"
                    download
                    className="flex items-center gap-1.5 px-4 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold text-white transition-all shadow-sm active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CP210x 드라이버 다운로드 (.ZIP)
                  </a>
                </div>

                <div className="bg-white/80 rounded-xl p-3 border border-violet-100 text-[11px] text-slate-500 leading-relaxed">
                  <span className="font-bold text-violet-700 block mb-1">설치 가이드 (Windows):</span>
                  1. 다운로드 버튼을 눌러 압축파일을 받습니다.<br />
                  2. 다운로드 폴더에서 압축을 풀어 줍니다.<br />
                  3. `silabser.inf` 파일 마우스 우클릭 ➡️ **[설치]** 클릭, 혹은 압축 해제 폴더 내 인스톨러 프로그램(`CP210xVCPInstaller_x64.exe`)을 실행해 설치를 마칩니다.
                </div>
              </div>

              {/* 2. MicroPython Firmware Flasher Card - Pastel Coral */}
              <div className="bg-rose-50/80 border border-rose-100/90 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                <div className="flex items-center gap-2 text-rose-700">
                  <Settings className="w-5.5 h-5.5" />
                  <h2 className="text-lg sm:text-xl font-black tracking-wide font-title">
                    2. MicroPython 펌웨어 설치 (Web Flasher)
                  </h2>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  새 공장 출하 ESP32 보드를 쓰거나 칩 전체를 포맷하고 MicroPython 환경을 새로 굽고 싶을 때, Thonny를 사용하지 않고도 크롬 브라우저에서 다이렉트로 바이너리를 올립니다.
                </p>

                {isConnected && (
                  <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-100/80 border border-rose-200 rounded-xl p-3 leading-relaxed">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      **경고**: 현재 대시보드 보드 연결이 활성화되어 있어 펌웨어 플래시가 불가능합니다. 상단 헤더의 **[연결 해제]** 버튼을 먼저 실행해 주십시오.
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-3 border border-rose-100 rounded-xl">
                  <input
                    type="checkbox"
                    id="erase-flash"
                    checked={shouldEraseFlash}
                    onChange={(e) => setShouldEraseFlash(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <label htmlFor="erase-flash" className="font-bold cursor-pointer">
                    Flash 전체 초기화 (Erase Flash) - 권장
                  </label>
                </div>

                {/* Progress Bar */}
                {isFlashing && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] font-bold text-rose-700">
                      <span>플래싱 진행률...</span>
                      <span>{flashProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 transition-all duration-150"
                        style={{ width: `${flashProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Flashing Status Log Area */}
                <div className="bg-slate-900 text-slate-200 font-mono text-[10px] p-3 rounded-xl h-[180px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {flashingStatus}
                </div>

                <button
                  onClick={flashFirmware}
                  disabled={isFlashing || isConnected}
                  className={`flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 disabled:pointer-events-none text-white ${
                    flashSuccess 
                      ? 'bg-emerald-600 hover:bg-emerald-500' 
                      : 'bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:text-slate-400'
                  }`}
                >
                  {isFlashing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : flashSuccess ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <CircuitBoard className="w-4 h-4" />
                  )}
                  {isFlashing ? '설치 중...' : flashSuccess ? '설치 완료' : '설치 시작 (Flash)'}
                </button>
              </div>

            </section>

            {/* Right Column (Files and Libraries Explorer) */}
            <section className="lg:col-span-6 flex flex-col gap-6">
              
              {/* 3. Board Files & Libraries Manager Card - Pastel Mint */}
              <div className="bg-emerald-50/80 border border-emerald-100/90 rounded-2xl p-5 flex flex-col gap-4 shadow-sm min-h-[500px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <HardDrive className="w-5.5 h-5.5" />
                    <h2 className="text-lg sm:text-xl font-black tracking-wide font-title">
                      3. 보드 파일 및 라이브러리 관리자
                    </h2>
                  </div>

                  <button
                    onClick={() => refreshBoardFiles()}
                    disabled={!isConnected || isRefreshingFiles}
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 transition-all rounded-md shadow-sm disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingFiles ? 'animate-spin' : ''}`} />
                    목록 새로고침
                  </button>
                </div>

                {!isConnected ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-emerald-200 bg-white/50 rounded-xl p-8 text-center text-xs text-slate-500 gap-2">
                    <AlertCircle className="w-8 h-8 text-emerald-500/50" />
                    <div>
                      <span className="font-bold text-emerald-700 block mb-1">보드가 연결되지 않았습니다.</span>
                      상단 헤더에서 보드를 연결한 후 리스트 목록 조회와 파일 업로드 관리가 가능합니다.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 flex-1">
                    {/* Local File & Folder Upload Input */}
                    <div className="bg-white p-3 border border-emerald-100 rounded-xl flex flex-col gap-3 shadow-sm">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">내 컴퓨터에서 파일 업로드</span>
                        <div className="flex gap-2">
                          <input
                            type="file"
                            accept=".py"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                            className="flex-1 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100/80 cursor-pointer border border-slate-200 rounded-lg p-1 bg-slate-50"
                          />
                          <button
                            onClick={handleLocalFileUpload}
                            disabled={!uploadFile || isUploadingFile}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 disabled:pointer-events-none"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            업로드
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-emerald-50 pt-2 flex flex-col gap-1.5">
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">내 컴퓨터에서 폴더 업로드</span>
                        <div className="flex gap-2">
                          <input
                            type="file"
                            {...({ webkitdirectory: "", directory: "" } as any)}
                            multiple
                            onChange={handleFolderSelect}
                            className="flex-1 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100/80 cursor-pointer border border-slate-200 rounded-lg p-1 bg-slate-50"
                          />
                          <button
                            onClick={handleFolderUpload}
                            disabled={selectedFolderFiles.length === 0 || isUploadingFile}
                            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 disabled:pointer-events-none"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            폴더 업로드
                          </button>
                        </div>
                        {selectedFolderFiles.length > 0 && (
                          <span className="text-[10px] text-emerald-700 font-bold px-1 animate-pulse">
                            대기 중인 라이브러리 파일: {selectedFolderFiles.length}개
                          </span>
                        )}
                      </div>
                    </div>

                     {/* Predefined library quick install buttons */}
                    <div className="bg-white p-3 border border-emerald-100 rounded-xl flex flex-col gap-3 shadow-sm">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">인기 센서 라이브러리 원클릭 설치</span>
                      <div className="flex flex-col gap-2.5">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => installPresetLibrary('ssd1306.py', SSD1306_CODE)}
                            disabled={isUploadingFile}
                            className="w-full flex items-center justify-center gap-1 text-[11px] font-semibold px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100 rounded-lg transition-all active:scale-95 disabled:opacity-40"
                          >
                            ⚙️ ssd1306.py (OLED 디스플레이) 설치
                          </button>
                          <span className="text-[10px] text-slate-400 pl-1">
                            * 사용 추천 템플릿: 🎮 테트리스 게임, 🌤️ 서울 날씨 & OLED & NeoPixel
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 border-t border-emerald-50 pt-2">
                          <button
                            onClick={() => installPresetLibrary('tcs34725.py', TCS34725_CODE)}
                            disabled={isUploadingFile}
                            className="w-full flex items-center justify-center gap-1 text-[11px] font-semibold px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100 rounded-lg transition-all active:scale-95 disabled:opacity-40"
                          >
                            ⚙️ tcs34725.py (컬러센서) 설치
                          </button>
                          <span className="text-[10px] text-slate-400 pl-1">
                            * 사용 추천 템플릿: 🔮 TCS34725 컬러센서 Mood Light
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Files on the Board List */}
                    <div className="bg-white border border-emerald-100 rounded-xl flex-1 flex flex-col min-h-[180px] p-3 shadow-inner">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">보드 내부 파일 목록 (VFS)</span>
                      
                      {isRefreshingFiles || isUploadingFile ? (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-400 gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                          보드 파일 통신 중...
                        </div>
                      ) : boardFiles.length === 0 ? (
                        <div className="flex-grow flex items-center justify-center text-xs text-slate-400 italic">
                          조회된 파일이 없습니다. (새 펌웨어 설치 직후이거나 빈 저장소)
                        </div>
                      ) : (
                        <div className="flex-grow overflow-y-auto max-h-[220px] flex flex-col gap-1.5 pr-1">
                          {boardFiles.map((file, idx) => (
                            <div 
                              key={idx} 
                              className="flex justify-between items-center bg-slate-50 border border-slate-100 hover:border-slate-200 px-3.5 py-2 rounded-xl transition-all"
                            >
                              <span className="text-xs font-mono text-slate-700 font-medium">📄 {file}</span>
                              {file !== 'boot.py' && (
                                <button
                                  onClick={() => deleteBoardFile(file)}
                                  className="p-1 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-all rounded-md active:scale-90"
                                  title="보드에서 삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </section>
          </div>
        ) : (
          /* History Layout */
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5 text-slate-800">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <History className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight font-title">작업 히스토리</h2>
                  <p className="text-xs text-slate-500">생성한 코드와 실행 로그를 확인하고 재실행합니다.</p>
                </div>
              </div>

              {historyList.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearAllHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    전체 기록 삭제
                  </button>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    총 {historyList.length}개의 기록
                  </span>
                </div>
              )}
            </div>

            {isLoadingHistory ? (
              /* Loading State */
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-xs font-bold">작업 기록을 불러오는 중...</span>
              </div>
            ) : historyList.length === 0 ? (
              /* Empty State */
              !user ? (
                /* Not Logged In & No History State */
                <div className="bg-white border border-slate-200 rounded-2xl p-8 py-16 text-center shadow-sm flex flex-col items-center justify-center gap-4 max-w-md mx-auto my-8">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                    <History className="w-10 h-10" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-lg font-black text-slate-800 font-title">로그인이 필요합니다</h3>
                    <p className="text-xs text-slate-500 leading-relaxed px-4">
                      Google 계정으로 로그인하시면 VibeESP32에서 작업한 소스코드와 AI 프롬프트 생성 이력을 안전하게 클라우드에 보관하고 불러올 수 있습니다.
                    </p>
                  </div>
                  <button
                    onClick={signInWithGoogle}
                    className="mt-2 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    Google 계정으로 로그인
                  </button>
                </div>
              ) : (
                /* Logged In & No History State */
                <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 py-16 text-center flex flex-col items-center justify-center gap-3">
                  <Clock className="w-10 h-10 text-slate-300" />
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-black text-slate-700 font-title">저장된 기록이 없습니다</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      대시보드 탭에서 인공지능으로 새로운 코드를 생성하거나, 작성된 코드를 ESP32 보드에 실행하면 기록이 이곳에 자동으로 기록됩니다!
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-500 hover:underline cursor-pointer"
                  >
                    대시보드로 가기 &rarr;
                  </button>
                </div>
              )
            ) : (
              /* History List State */
              <div className="flex flex-col gap-4">
                {/* Local storage history info banner for guest users */}
                {!user && (
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-indigo-900 shadow-sm mb-1 text-left">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm flex-shrink-0">
                        <Info className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black font-title">임시 로컬 히스토리 모드</h4>
                        <p className="text-xs text-indigo-700/80 mt-0.5">현재 브라우저에 임시 저장 중입니다. 로그인하시면 클라우드에 평생 보관하실 수 있습니다.</p>
                      </div>
                    </div>
                    <button
                      onClick={signInWithGoogle}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex-shrink-0"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      구글 로그인
                    </button>
                  </div>
                )}
                {historyList.map((item) => (
                  <div 
                    key={item.id}
                    className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-all hover:shadow-md flex flex-col gap-3.5 relative overflow-hidden border-l-4 ${
                      item.type === 'generate' ? 'border-l-violet-500' : 'border-l-emerald-500'
                    }`}
                  >
                    {/* Top Row: Type badge, Date, and Delete Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.type === 'generate' ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                            <Zap className="w-3 h-3" />
                            AI 코드 생성
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <Play className="w-3 h-3" />
                            보드 직접 실행
                          </span>
                        )}
                        
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <Clock className="w-3 h-3" />
                          {(() => {
                            try {
                              return new Date(item.createdAt).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              });
                            } catch(e) {
                              return item.createdAt;
                            }
                          })()}
                        </span>
                      </div>

                      <button
                        onClick={() => deleteHistoryItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-lg active:scale-90 cursor-pointer"
                        title="기록 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Prompt/Content Row */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-title">명령 및 내용</span>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-line">
                        {item.prompt}
                      </p>
                    </div>

                    {/* Code Preview (Max-height scrollable window) */}
                    <div className="relative">
                      <div className="bg-slate-900 text-slate-200 font-mono text-xs rounded-xl p-3 max-h-[120px] overflow-y-auto leading-relaxed border border-slate-800 whitespace-pre scrollbar-thin">
                        {item.code}
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.code);
                            alert('코드가 클립보드에 복사되었습니다.');
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 shadow-sm border border-slate-700 cursor-pointer"
                          title="코드 복사"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => handleLoadHistory(item)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-all active:scale-95 cursor-pointer"
                      >
                        에디터에 로드
                      </button>
                      <button
                        onClick={() => handleLoadAndRunHistory(item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                          item.type === 'generate' 
                            ? 'bg-violet-600 hover:bg-violet-500 shadow-sm shadow-violet-500/10' 
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-500/10'
                        }`}
                      >
                        <Play className="w-3 h-3" />
                        이 코드로 바로 실행
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Page Footer */}
      <footer className="py-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
        <p>© 2026 VibeESP32 - Web Serial API & MicroPython IoT Control Dashboard</p>
      </footer>
    </div>
  );
}
