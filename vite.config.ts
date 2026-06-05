import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Helper to load Gemini API Key from .env.local
function getGeminiApiKey() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('GEMINI_API_KEY=')) {
          const val = line.substring(line.indexOf('=') + 1).trim();
          return val.replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (e) {
    console.error('Error loading API Key from .env.local:', e);
  }
  return process.env.GEMINI_API_KEY || '';
}

const SYSTEM_PROMPT = `You are an expert MicroPython firmware engineer specializing in ESP32 hardware programming.
Your task is to generate production-quality, immediately executable MicroPython code.

STRICT OUTPUT FORMAT — follow exactly, no exceptions:
1. Begin your response with the VERY FIRST LINE of Python code. No introduction, no greeting, no "Here's the code".
2. Do NOT use markdown. No backticks, no code fences (no \`\`\`python or \`\`\`).
3. After the last line of code, output this exact delimiter on its own line: __EXPLANATION__
4. After the delimiter, write a step-by-step explanation in Korean. No code blocks in the explanation.

EXPLANATION FORMAT (strict structure, no deviation):
The explanation must have exactly two sections in this order:

[2-3줄의 전체 동작 요약. 어떤 하드웨어를 어떻게 제어하는지 간결하게.]

**핵심 문법**
- \`코드\`: 한 줄 설명
- \`코드\`: 한 줄 설명
(중요한 문법/API 3~6개만. 당연한 것은 생략.)

EXAMPLE of correct output format:
import machine
import time
led = machine.Pin(2, machine.Pin.OUT)
while True:
    led.value(1)
    time.sleep(0.5)
__EXPLANATION__
GPIO 2번 내장 LED를 0.5초 간격으로 켜고 끄는 코드입니다. machine 모듈로 핀을 제어하고 while True 루프로 무한 반복합니다.

**핵심 문법**
- \`machine.Pin(2, Pin.OUT)\`: GPIO 2번을 출력 모드로 설정
▶️ led.value(1) / led.value(0) 핀에 High(3.3V) / Low(0V) 신호 출력
- \`time.sleep(0.5)\`: 0.5초 대기

ESP32 / MICROPYTHON HARDWARE CONSTRAINTS (follow strictly):
- No threading module — use time.ticks_ms() based non-blocking loops instead of blocking sleep in time-sensitive code
- RAM is ~300KB — avoid large list allocations, heavy string concatenation in loops, or redundant imports
- Always use SoftI2C (from machine import SoftI2C) over hardware I2C for better reliability
- Always declare modified globals with the 'global' keyword inside functions
- Every while True loop must contain time.sleep_ms(10) or equivalent to prevent watchdog timer resets
- Wrap all hardware I/O (sensors, I2C, SPI, network, file) in try-except blocks
- Available built-in libraries: machine, time, network, socket, random, os, sys, ubinascii, neopixel, dht
- Valid ESP32 GPIO pins: 0,2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39
- GPIO 34, 35, 36, 39 are INPUT ONLY — never configure them as output
- GPIO 6–11 are reserved for internal flash — never use them
- Built-in LED is GPIO 2 on standard ESP32 dev boards
- Use time.ticks_diff(current, last) for elapsed time — never subtract ticks directly (handles 32-bit rollover correctly)

DEFAULT PIN ASSIGNMENTS (use when user does not specify):
- Built-in LED: GPIO 2
- DHT11 / DHT22 data pin: GPIO 27
- NeoPixel data pin: GPIO 14 (default 12 LEDs)
- I2C SDA: GPIO 21, SCL: GPIO 22
- PWM / Servo signal: GPIO 13

CODE QUALITY RULES:
- Define pin numbers and config values as named constants (ALL_CAPS) at the top
- Initialize all hardware objects before the main loop
- Add Korean comments that explain WHY, not just what each section does
- Print [시스템] prefixed status messages to serial for key events and errors
- For sensor values, validate ranges before using (e.g. temperature between -40 and 80 for DHT11)
- Prefer concise, flat scripts over unnecessary class abstractions for simple tasks

CRITICAL MICROPYTHON-SPECIFIC RULES:
- NEVER reimplement existing libraries (ssd1306, dht, neopixel, machine, etc.) — always import them directly
- The ssd1306 library IS already installed on the board: always use "import ssd1306" and "ssd1306.SSD1306_I2C(...)"
- NEVER use "if __name__ == '__main__':" — it does not work when code is run via exec(). Write flat top-level code only
- NEVER use f-strings (f"...") — use str.format() or string concatenation for MicroPython compatibility
- For geometric calculations (circles, stars, angles), use the math module: import math, math.sin(), math.cos(), math.radians()
- A proper 5-pointed star requires 10 alternating points (outer/inner radius) at 36-degree intervals using trigonometry`;

// Static templates for quick dev-server suggestions with descriptions
const LED_CODE = `# VibeESP32 - 내장 LED 깜빡이기 (GPIO 2)
import machine
import time

# GPIO 2번 핀을 출력용으로 설정 (ESP32 내장 LED)
led = machine.Pin(2, machine.Pin.OUT)

print("[시스템] LED 깜빡이기 시작 (Pin: 2)")
while True:
    led.value(1)  # LED 켜기 (High)
    time.sleep(0.5)
    led.value(0)  # LED 끄기 (Low)
    time.sleep(0.5)
__EXPLANATION__
💡 1. 전체 알고리즘 구조
📌 내장 LED 점멸 제어 알고리즘
  ESP32의 내장 LED가 연결된 GPIO 2번 핀을 디지털 출력 모드로 초기화한 후, while True 무한 루프를 통해 0.5초 주기로 LED 출력 상태를 켜짐(High, 3.3V)과 꺼짐(Low, 0V)으로 번갈아 전환하며 상태를 주기적으로 유지(sleep)하는 구조로 동작합니다.

🔍 2. 주요 코드 라인별 세부 설명
▶️ led = machine.Pin(2, machine.Pin.OUT)
  machine 모듈의 Pin 클래스 생성자를 호출하여 객체를 생성합니다. 첫 번째 인자 2는 제어할 GPIO 핀 번호를 지정하며, 두 번째 인자 Pin.OUT은 핀을 전류를 내보내는 디지털 출력 모드로 설정하는 상수입니다.
▶️ led.value(1)
  Pin 객체의 value() 메서드를 호출하여 출력 전압을 3.3V(High) 상태로 인가합니다. 이를 통해 연결된 회로에 전류가 흘러 LED를 켭니다.
▶️ time.sleep(0.5)
  time 모듈의 sleep() 함수를 호출하여 프로그램을 0.5초 동안 일시적으로 블로킹(대기) 상태로 만듭니다. LED의 현재 상태를 유지하여 육안으로 점멸을 확인할 수 있게 지연을 생성합니다.
▶️ led.value(0)
  Pin 객체의 value() 메서드를 호출하여 출력 전압을 0V(Low) 상태로 내립니다. 회로의 전류 흐름을 차단하여 LED를 끕니다.`;

const WIFI_CODE = `# VibeESP32 - WiFi 연결 및 IP 출력
import network
import time

ssid = "Your_WiFi_SSID"
password = "Your_WiFi_Password"

wlan = network.WLAN(network.STA_IF)
wlan.active(True)

print("[시스템] WiFi 연결 시도 중: {}...".format(ssid))
wlan.connect(ssid, password)

# 연결될 때까지 대기 (최대 10초)
max_wait = 10
while max_wait > 0:
    if wlan.isconnected():
        break
    max_wait -= 1
    print("연결 대기 중...")
    time.sleep(1)

if wlan.isconnected():
    print("[시스템] WiFi 연결 성공!")
    print("네트워크 정보:", wlan.ifconfig())
else:
    print("[시스템] WiFi 연결 실패. SSID와 비밀번호를 확인해 주세요.")
__EXPLANATION__
💡 1. 전체 알고리즘 구조
📌 WiFi 연결 및 접속 대기 알고리즘
  ESP32의 WiFi 모듈을 Station(클라이언트) 모드로 활성화하여 주변 공유기(AP)의 무선망을 검색하고, 미리 정의된 SSID와 비밀번호를 통해 연결 요청을 보냅니다. 이후 접속에 성공할 때까지 최대 10초 동안 1초 주기로 연결 여부를 반복하여 확인하고, 최종적으로 연결이 완료되면 할당받은 IP 등의 정보를 조회하여 네트워크에 안전하게 접속하는 구조입니다.

🔍 2. 주요 코드 라인별 세부 설명
▶️ wlan = network.WLAN(network.STA_IF)
  network 모듈의 WLAN 클래스 생성자를 호출합니다. 인자 STA_IF는 ESP32가 무선 클라이언트로 동작하는 Station 모드를 활성화하는 네트워크 전용 상수입니다.
▶️ wlan.active(True)
  WLAN 객체의 active() 메서드를 호출하고 인자로 True를 전달하여 ESP32 내부의 WiFi 무선 하드웨어 인터페이스 활성화 및 전원을 공급합니다.
▶️ wlan.connect(ssid, password)
  WLAN 객체의 connect() 메서드를 사용하여 지정한 무선 공유기(AP)의 ssid와 접속 password를 인자로 넘겨주어 무선 인증 및 결합을 백그라운드에서 요청합니다.
▶️ wlan.isconnected()
  WiFi 장치가 공유기에 성공적으로 연결되어 IP 주소를 할당받았는지 확인하는 메서드입니다. 성공 시 True, 진행 중이거나 실패 시 False인 부울(Boolean) 값을 반환합니다.
▶️ wlan.ifconfig()
  현재 장치에 설정된 네트워크 매개변수 정보를 얻어오는 메서드입니다. (IP 주소, 서브넷 마스크, 게이트웨이, DNS 서버) 형태의 4개 요소를 가진 튜플(Tuple) 자료형을 반환합니다.`;

const DHT11_CODE = `# VibeESP32 - DHT11 온습도 센서 측정 (GPIO 27)
import machine
import dht
import time

# GPIO 27번 핀에 DHT11 센서 데이터 핀 연결 설정
sensor = dht.DHT11(machine.Pin(27))

print("[시스템] DHT11 온습도 측정 시작 (Pin: 27)")
while True:
    try:
        sensor.measure()
        temp = sensor.temperature()
        hum = sensor.humidity()
        print("온도: {} C, 습도: {} %".format(temp, hum))
    except OSError as e:
        # 온습도 센서 읽기 실패 시 예외 처리
        print("[에러] DHT11 센서 데이터를 읽을 수 없습니다:", e)
    
    time.sleep(2)  # DHT11 센서는 최소 2초 간격 측정 권장
__EXPLANATION__
💡 1. 전체 알고리즘 구조
📌 실시간 온습도 모니터링 및 예외 처리 알고리즘
  ESP32의 GPIO 27번 핀을 온습도 데이터 전송용으로 사용하기 위해 dht 라이브러리로 센서 객체를 생성합니다. 이후 while True 무한 루프에서 2초 단위로 센서에 측정을 명령하고, 내부 레지스터에서 디지털 온도와 습도 값을 가져와 출력합니다. 이때 통신 불량 및 센서 분리 현상으로 발생할 수 있는 하드웨어 에러(OSError)에 대비하여 try-except 예외 처리 구문으로 안정적인 구동을 유지하는 구조입니다.

🔍 2. 주요 코드 라인별 세부 설명
▶️ sensor = dht.DHT11(machine.Pin(27))
  dht 모듈 of DHT11 클래스 생성자를 사용해 객체를 선언합니다. 인자로 전달하는 machine.Pin(27)은 GPIO 27번 핀을 사용해 센서와 단선 통신(1-Wire)을 개시하겠다는 의미입니다.
▶️ sensor.measure()
  DHT11 객체의 measure() 메서드를 호출하여 센서 물리 칩에 온도 및 습도의 현재 상황 측정을 지시하고 결과값을 내부 메모리에 버퍼링합니다.
▶️ sensor.temperature()
  최근 성공적으로 측정되어 센서 내부 레지스터에 기록된 섭씨 온도 수치를 가져오는 메서드이며, 정수(Integer) 형태의 온도 데이터를 반환합니다.
▶️ sensor.humidity()
  최근 측정된 대기 중의 상대 습도 수치를 가져오는 메서드이며, 정수(Integer) 형태의 백분율(%) 데이터를 반환합니다.
▶️ except OSError as e
  try 블록 내부에서 발생할 수 있는 입출력(I/O) 및 통신 하드웨어 계통의 오류인 OSError 예외를 감지하여 포착하고 변수 e에 할당합니다. 프로그램이 강제 종료되지 않도록 방지하는 역할을 합니다.`;

const NEOPIXEL_CODE = `# VibeESP32 - NeoPixel 무지개 회전 효과 (GPIO 14, 12개 LED)
from machine import Pin
from neopixel import NeoPixel
import time

# GPIO 14번 핀에 12개의 LED를 가진 NeoPixel 바 설정
pin = Pin(14, Pin.OUT)
np = NeoPixel(pin, 12) 

def wheel(pos):
    # 0부터 255 사이의 값을 입력받아 R-G-B 색상 튜플을 반환하는 함수
    if pos < 85:
        return (255 - pos * 3, pos * 3, 0)
    if pos < 170:
        pos -= 85
        return (0, 255 - pos * 3, pos * 3)
    else:
        pos -= 170
        return (pos * 3, 0, 255 - pos * 3)

print("[시스템] NeoPixel 무지개 효과 동작 중 (Pin: 14, LEDs: 12)")
while True:
    for j in range(255):
        for i in range(12):
            # 12개의 LED에 고르게 분산된 색상 인덱스 계산
            rc_index = (i * 256 // 12) + j
            np[i] = wheel(rc_index & 255)
        np.write()
        time.sleep_ms(15)  # 부드러운 회전 효과를 위한 지연 시간
__EXPLANATION__
💡 1. 전체 알고리즘 구조
📌 NeoPixel 무지개 스펙트럼 회전 알고리즘
  GPIO 14번 핀에 연결된 12구 NeoPixel LED 바를 제어하기 위해 전용 객체를 메모리에 생성합니다. 0~255 범위의 입력값에 따라 3원색(Red, Green, Blue)의 강도를 유기적으로 변화시켜 부드러운 색 변화를 만들어내는 wheel() 함수를 구성합니다. 이후 프레임 오프셋 루프와 12개 LED에 색상을 분배하는 이중 루프를 돌면서 순차적으로 색상값을 버퍼에 기록하고, 15ms 간격으로 출력 데이터를 갱신하여 무지개빛이 회전하는 시각적 효과를 구현하는 구조입니다.

🔍 2. 주요 코드 라인별 세부 설명
▶️ np = NeoPixel(pin, 12)
  neopixel 모듈에서 가져온 NeoPixel 클래스의 생성자를 호출합니다. 인자로 전달된 디지털 출력 설정 핀 객체(pin)와 결합된 LED 소자 수인 12를 설정하여 픽셀 상태를 제어할 가상 버퍼 배열을 초기화합니다.
▶️ rc_index = (i * 256 // 12) + j
  12개의 LED 소자 전체에 무지개 스펙트럼의 다른 파장이 고르게 분산되도록 인덱스를 분할 계산하는 수식입니다. 나눗셈의 몫 연산(//)을 적용해 정수 값을 도출하고, 프레임 오프셋 j를 더해 색상 위치를 이동시킵니다.
▶️ np[i] = wheel(rc_index & 255)
  비트 연산자 & 255를 통해 인덱스가 255를 넘어갈 때 자동으로 순환하도록 나머지 연산 처리를 하고, wheel 함수의 리턴 값인 (R, G, B) 튜플을 np 객체의 i번째 인덱스 버퍼에 할당합니다.
▶️ np.write()
  NeoPixel 객체의 메모리 버퍼에 기록된 12구의 RGB 값 데이터를 일선 직렬 통신 신호로 바꾸어 실제 LED 물리 칩셋으로 일괄 송신하고, 빛깔을 물리적으로 반영합니다.`;

const WEBSERVER_CODE = `# VibeESP32 - 간단한 웹 서버 구동
import machine
import network
import socket
import time

# WiFi 접속 설정
ssid = "Your_WiFi_SSID"
password = "Your_WiFi_Password"

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(ssid, password)

print("[시스템] WiFi 연결 대기 중...")
for _ in range(10):
    if wlan.isconnected():
        break
    time.sleep(1)

if not wlan.isconnected():
    print("[시스템] WiFi 연결 실패. 웹 서버 실행을 위해 WiFi 설정이 필요합니다.")
else:
    ip = wlan.ifconfig()[0]
    print("[시스템] WiFi 연결 성공! IP 주소:", ip)
    
    # 80번 포트로 TCP 소켓 개방
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('', 80))
    s.listen(5)
    print("[시스템] 웹 서버가 80 포트에서 실행 중입니다. 브라우저로 접속해 보세요.")
    
    while True:
        try:
            conn, addr = s.accept()
            print("[시스템] 클라이언트 접속 감지:", addr)
            request = conn.recv(1024)
            
            # HTML 반응 메시지 전송
            response = """HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\nConnection: close\\r\\n\\r\\n
            <html>
            <head>
                <meta charset="utf-8">
                <title>VibeESP32 Web Server</title>
                <style>
                    body { font-family: sans-serif; text-align: center; margin-top: 50px; background: #f0f2f5; }
                    .card { background: white; padding: 30px; border-radius: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    h1 { color: #4f46e5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Hello from VibeESP32!</h1>
                    <p>MicroPython 웹 서버가 성공적으로 동작하고 있습니다.</p>
                </div>
            </body>
            </html>
            """
            conn.send(response)
            conn.close()
        except Exception as e:
            print("[에러] 소켓 통신 오류:", e)
__EXPLANATION__
💡 1. 전체 알고리즘 구조
📌 TCP 소켓 기반 경량 웹 서버 구동 알고리즘
  WiFi에 연결하여 ESP32의 로컬 IP 주소를 할당받은 뒤, 네트워크 소켓 API를 사용해 웹의 표준 포트인 80번 대역에서 대기하는 TCP 서버를 개방합니다. 이후 while True 루프 내에서 클라이언트(브라우저)의 접속 요청을 대기하다가 연결이 수립되면 클라이언트의 HTTP 요청 헤더를 수집하고, 미리 작성된 HTML 문서 및 스타일 정보가 담긴 HTTP 응답 프레임을 소켓을 통해 전송한 후 소켓 연결을 닫아 리소스를 환원하는 방식으로 작동하는 구조입니다.

🔍 2. 주요 코드 라인별 세부 설명
▶️ s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  socket 모듈의 socket 생성자를 호출하여 네트워크 소켓 객체를 빌드합니다. AF_INET은 IPv4 인터넷 프로토콜 패밀리를 정의하고, SOCK_STREAM은 안정적인 데이터 전송을 보장하는 TCP(Transmission Control Protocol) 타입을 사용하도록 지정합니다.
▶️ s.bind(('', 80))
  socket 객체의 bind() 메서드를 호출하여 소켓에 IP 주소와 포트 번호를 지정 결합합니다. 주소를 빈 문자열('')로 설정하면 들어오는 모든 인터페이스의 IP로부터 접속을 허용하며, 80은 웹 통신 표준 포트 번호를 가리킵니다.
▶️ s.listen(5)
  listen() 메서드를 통해 소켓을 외부 접속 요청을 수신 대기할 수 있는 서버 소켓 상태로 활성화합니다. 인자로 넘겨진 5는 최대 동시 대기 가능한 클라이언트 연결 요청 대기열(Backlog Queue)의 크기입니다.
▶️ conn, addr = s.accept()
  클라이언트의 접속이 있을 때까지 동기적으로 프로그램을 정지(블로킹)하고 기다리는 메서드입니다. 연결이 성공적으로 이루어지면 통신용 신규 소켓 객체 conn과 접속한 상대방 IP/포트 튜플인 addr을 반환합니다.
▶️ conn.send(response)
  통신 연결 소켓 conn을 통해 원격지 브라우저 클라이언트 방향으로 준비된 HTML 콘텐츠 및 HTTP 응답 규격 텍스트 문자열을 바이트 스트림으로 송신하는 메서드입니다.
▶️ conn.close()
  전송 처리가 마무리된 통신용 개별 소켓 conn을 닫고 접속을 해제합니다. 이를 통해 시스템 소켓 파일 디스크립터 및 사용된 내부 힙 메모리를 해제하여 장치 오동작을 예방합니다.`;

const WEATHER_CODE = `# VibeESP32 - 서울 날씨 정보 가져오기 & OLED & NeoPixel 제어
import machine
import network
import time
import urequests
import json
from machine import Pin, SoftI2C
import ssd1306
import neopixel

# WiFi 설정 및 OpenWeatherMap API 키 설정
SSID = "Your_WiFi_SSID"
PASSWORD = "Your_WiFi_Password"
API_KEY = "Your_OpenWeatherMap_API_Key"  # OpenWeatherMap에서 발급받은 API 키 입력
CITY = "Seoul"
URL = "http://api.openweathermap.org/data/2.5/weather?q={}&appid={}&units=metric".format(CITY, API_KEY)

# 하드웨어 설정 (I2C OLED & NeoPixel)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

# NeoPixel 설정 (GPIO 14번, 12개 LED)
np_pin = Pin(14, Pin.OUT)
np = neopixel.NeoPixel(np_pin, 12)

def set_np_color(r, g, b):
    for i in range(12):
        np[i] = (r, g, b)
    np.write()

# WiFi 연결 함수
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
print("[시스템] WiFi 연결 시도 중...")
wlan.connect(SSID, PASSWORD)

# 연결 대기
for _ in range(10):
    if wlan.isconnected():
        break
    time.sleep(1)

if not wlan.isconnected():
    print("[에러] WiFi 연결 실패.")
    oled.fill(0)
    oled.text("WiFi Connect Fail", 0, 20)
    oled.show()
    set_np_color(255, 0, 0) # 빨간색으로 에러 표시
else:
    print("[시스템] WiFi 연결 성공! IP:", wlan.ifconfig()[0])
    oled.fill(0)
    oled.text("WiFi Connected!", 0, 20)
    oled.show()
    set_np_color(0, 255, 0) # 초록색으로 성공 표시
    time.sleep(1)

    while True:
        try:
            print("[시스템] 서울 날씨 정보 요청 중...")
            response = urequests.get(URL)
            if response.status_code == 200:
                data = response.json()
                temp = data['main']['temp']
                weather_main = data['weather'][0]['main']
                
                print("도시: Seoul")
                print("날씨: {}, 온도: {} C".format(weather_main, temp))
                
                # OLED 출력
                oled.fill(0)
                oled.text("Seoul Weather", 10, 5, 1)
                oled.text("----------------", 0, 18, 1)
                oled.text("Temp: {} C".format(temp), 10, 30, 1)
                oled.text("State: {}".format(weather_main), 10, 45, 1)
                oled.show()
                
                # 날씨 상태에 따른 네오픽셀 색상 변경
                # 1. 맑음 (Clear) -> 주황/빨강 (따뜻함/태양)
                # 2. 비/눈 (Rain/Drizzle/Snow) -> 파랑 (물/눈)
                # 3. 흐림/안개 등 (Clouds/Mist/Haze) -> 노랑/보라
                if "clear" in weather_main.lower():
                    set_np_color(255, 50, 0) # 주황빛 빨간색
                    print("[날씨: 맑음] NeoPixel 색상: 주황색")
                elif any(x in weather_main.lower() for x in ["rain", "drizzle", "snow", "thunderstorm"]):
                    set_np_color(0, 0, 255) # 파란색
                    print("[날씨: 비/눈] NeoPixel 색상: 파란색")
                else:
                    set_np_color(80, 80, 80) # 백색/흐린 흰빛
                    print("[날씨: 흐림/기타] NeoPixel 색상: 흐린 흰색")
            else:
                print("[에러] 날씨 데이터를 가져올 수 없습니다. Status Code:", response.status_code)
                oled.fill(0)
                oled.text("HTTP Error: {}".format(response.status_code), 0, 20)
                oled.show()
            response.close()
        except Exception as e:
            print("[에러] 날씨 조회 중 오류 발생:", e)
            
        time.sleep(300) # 5분 간격 갱신
__EXPLANATION__
💡 1. 전체 알고리즘 구조
📌 실시간 날씨 API 연동 및 하드웨어 시각화 알고리즘
  SoftI2C 통신으로 OLED 디스플레이를 초기화하고, GPIO 14번 핀에 NeoPixel LED 모듈을 연결한 후 무선 네트워크에 연결합니다. 이후 5분 간격의 무한 루프 내에서 OpenWeatherMap의 날씨 정보 REST API로 HTTP GET 요청을 보내고, 반환된 JSON 데이터에서 서울의 기온 및 기상 상태 키워드를 파싱합니다. 파싱된 텍스트 정보는 OLED 디스플레이 화면에 정렬하여 표시하고, 기상 키워드(Clear, Rain 등)에 따라 NeoPixel의 조명 색상을 동적으로 매핑 변경하여 물리적인 피드백을 사용자에게 보여주는 연동식 구조입니다.

🔍 2. 주요 코드 라인별 세부 설명
▶️ i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
  machine 모듈의 SoftI2C 클래스를 호출해 가상 I2C 인터페이스를 선언합니다. 하드웨어 의존성이 배제된 소프트웨어 방식이며, 22번 핀을 클럭(SCL), 21번 핀을 데이터(SDA) 전송용으로 사용하도록 지정합니다.
▶️ response = urequests.get(URL)
  urequests 모듈의 get() 메서드를 호출하여 지정된 날씨 웹 서버 API URL로 HTTP GET 요청 패킷을 전달하고, 통신 소켓을 생성하여 서버로부터의 응답 결과를 저장한 객체를 반환받습니다.
▶️ data = response.json()
  response 객체의 json() 메서드를 호출하여 원격지 서버가 리턴한 JSON 포맷의 문자열 바이트를 파이썬의 중첩 딕셔너리(Dictionary) 및 리스트 구조체 객체로 변환하여 로드합니다.
▶️ temp = data['main']['temp']
  변환된 딕셔너리 data 구조체에서 키 체인을 순차 추적하여 최하위 데이터 필드인 현재 섭씨 온도 실수(Float) 값을 추출하고 변수 temp에 저장합니다.
▶️ if "clear" in weather_main.lower()
  날씨 상태 정보 문자열인 weather_main을 소문자로 일치시킨(lower()) 다음, 멤버십 연산자 in을 활용해 문자열 내부에 특정 키워드("clear")가 포함되어 있는지 진단하는 조건부 제어식입니다.
▶️ response.close()
  수신에 사용한 HTTP 응답 커넥션 리소스와 소켓을 완전히 제거하는 메서드입니다. 시스템 자원의 고갈을 초래하는 메모리 누수를 원천 차단하기 위해 작업 종료 즉시 소켓을 파괴합니다.`;

const TCS34725_CODE = `# VibeESP32 - TCS34725 컬러센서를 이용한 NeoPixel 무드등 (SDA: 17, SCL: 16)
from machine import Pin, SoftI2C
import neopixel
import time
import ustruct

# [TCS34725 컬러 센서 내부 드라이버 클래스 정의]
class TCS34725:
    def __init__(self, i2c, address=0x29):
        self.i2c = i2c
        self.address = address
        # 센서 ID 확인 (ID 레지스터: 0x12 | 0x80 = 0x92)
        sensor_id = self.i2c.readfrom_mem(self.address, 0x92, 1)[0]
        if sensor_id not in (0x44, 0x4D, 0x10):
            raise RuntimeError("Could not find TCS34725 sensor.")
        # 센서 전원 켜기 (Power ON) 및 RGBC 활성화
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

    def read(self):
        # 8바이트 (Clear, Red, Green, Blue) 데이터 한번에 읽어오기
        data = self.i2c.readfrom_mem(self.address, 0x94, 8)
        c = ustruct.unpack('<H', data[0:2])[0]
        r = ustruct.unpack('<H', data[2:4])[0]
        g = ustruct.unpack('<H', data[4:6])[0]
        b = ustruct.unpack('<H', data[6:8])[0]
        return r, g, b, c

# TCS34725 컬러센서 I2C 설정 (SDA: GPIO 17, SCL: GPIO 16)
i2c = SoftI2C(sda=Pin(17), scl=Pin(16))
sensor = TCS34725(i2c)

# 조도 감도 및 정확도 향상을 위한 설정 반영
sensor.gain(1)
sensor.integration_time(240)

# NeoPixel 설정 (GPIO 14번, 12개 LED)
np = neopixel.NeoPixel(Pin(14, Pin.OUT), 12)

print("[시스템] TCS34725 무드등 구동 시작 (SDA: 17, SCL: 16)")

while True:
    try:
        # 센서로부터 R, G, B, Clear(C) 값 읽기
        r, g, b, c = sensor.read()
        
        if c > 0:
            # 8비트 RGB 값으로 변환 (밝기 비례 스케일링)
            r_scale = int((r / c) * 255 * 1.5) # 눈에 잘 띄도록 가중치 부여
            g_scale = int((g / c) * 255 * 1.5)
            b_scale = int((b / c) * 255 * 1.5)
            
            # 0~255 범위 제한
            red = min(max(r_scale, 0), 255)
            green = min(max(g_scale, 0), 255)
            blue = min(max(b_scale, 0), 255)
        else:
            red = green = blue = 0
            
        print("측정값 - Clear: {}, R: {}, G: {}, B: {} -> 매핑 RGB: ({}, {}, {})".format(c, r, g, b, red, green, blue))
        
        # NeoPixel 무드등 색상 켜기 (12개 LED 전체 반영)
        for i in range(12):
            np[i] = (red, green, blue)
        np.write()
        
    except Exception as e:
        print("[에러] 센서 읽기 오류:", e)
        
    time.sleep(0.5) # 0.5초 간격으로 컬러 센싱 및 무드등 갱신
__EXPLANATION__
💡 1. 전체 알고리즘 구조
📌 컬러 센싱 기반 실시간 Mood Light 제어 알고리즘
  I2C 버스를 사용하여 TCS34725 컬러 센서와 통신하는 커스텀 파이썬 드라이버 클래스를 인스턴스화하고, 14번 핀에 연결된 NeoPixel을 준비합니다. 0.5초 단위의 제어 루프를 가동하여 센서 레지스터로부터 적색(Red), 녹색(Green), 청색(Blue), 밝기(Clear) 채널의 16비트 물리 광량 데이터를 독출합니다. 취득한 원시 데이터를 전체 조도 값에 비례하여 8비트(0~255) RGB 영역으로 정규화 및 크기 보정을 거치고, 최종 도출된 색상 정보를 12구 NeoPixel LED 전체에 실시간 동기화하여 투사하는 구조입니다.

🔍 2. 주요 코드 라인별 세부 설명
▶️ sensor_id = self.i2c.readfrom_mem(self.address, 0x92, 1)[0]
  SoftI2C 객체의 readfrom_mem() 메서드를 사용하여 센서 주소(0x29)의 레지스터 주소 0x92(ID 레지스터)로부터 1바이트 크기의 값을 조회합니다. 이 반환된 바이트 리스트의 첫 번째 요소([0])를 검증하여 칩의 고유 식별 번호가 유효한지 확인합니다.
▶️ self.i2c.writeto_mem(self.address, 0x80, b'\\x03')
  센서의 내부 0x80 제어 레지스터 메모리에 1바이트 바이너리 데이터 0x03을 직접 입력하는 메서드입니다. 센서 내부의 RGBC 적분기(ADC) 및 내부 전원을 깨워 실질적인 동작(Active)을 지시합니다.
▶️ ustruct.unpack('<H', data[0:2])[0]
  ustruct 모듈의 unpack() 함수를 활용하여 2바이트 크기의 원시 바이너리 스트림 데이터를 튜플 형태로 변환 디코딩합니다. 포맷 지시자 <H는 리틀 엔디언(Little-Endian) 방식의 부호 없는 2바이트 정수형(Unsigned Short) 형식임을 나타냅니다.
▶️ r_scale = int((r / c) * 255 * 1.5)
  수집된 원시 적색 조도값(r)을 전체 수광 광량(c)으로 나누어 명도 변화에 중립적인 순수 색상비를 추출합니다. 여기에 8비트 상한 상수인 255와 시인성 보정을 위한 상수 1.5를 곱해 형변환(int)을 가하는 색상 보정 수식입니다.
▶️ red = min(max(r_scale, 0), 255)
  수치 처리된 데이터가 8비트 가용 컬러 범위(0~255)를 벗어나 오버플로우나 언더플로우를 일으키지 않도록 최소 제한(max)과 최대 제한(min) 중첩 함수를 사용하여 데이터를 안전한 한계 내로 고정 및 클리핑합니다.`;

const TETRIS_CODE = `import machine
import time
import random
from machine import Pin, SoftI2C
import ssd1306

# 1. 하드웨어 설정
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

touch_left  = Pin(33, Pin.IN)
touch_right = Pin(32, Pin.IN)
touch_rot   = Pin(35, Pin.IN)
touch_drop  = Pin(34, Pin.IN)

# 2. 게임 영역 및 그래픽 크기 정의 (화면 절반 크기로 확장)
BOARD_WIDTH = 10
BOARD_HEIGHT = 20

BLOCK_SIZE_X = 6
BLOCK_SIZE_Y = 3

OFFSET_X = 2
OFFSET_Y = 2

# 3. 테트리스 미노(블록) 모양 정의
SHAPES = [
    [[1, 1, 1, 1]],
    [[1, 1, 1], [0, 1, 0]],
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1]],
    [[1, 1], [1, 1]],
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]]
]

board = [[0] * BOARD_WIDTH for _ in range(BOARD_HEIGHT)]
score = 0
game_over = False

current_piece = None
piece_x = 0
piece_y = 0

def get_new_piece():
    global current_piece, piece_x, piece_y
    current_piece = random.choice(SHAPES)
    piece_x = BOARD_WIDTH // 2 - len(current_piece[0]) // 2
    piece_y = 0

def rotate_piece(shape):
    return [list(x) for x in zip(*shape[::-1])]

def check_collision(piece, offset_x, offset_y):
    for r, row in enumerate(piece):
        for c, val in enumerate(row):
            if val:
                new_x = offset_x + c
                new_y = offset_y + r
                if new_x < 0 or new_x >= BOARD_WIDTH or new_y >= BOARD_HEIGHT:
                    return True
                if new_y >= 0 and board[new_y][new_x]:
                    return True
    return False

def lock_piece(piece, offset_x, offset_y):
    global score
    for r, row in enumerate(piece):
        for c, val in enumerate(row):
            if val and offset_y + r >= 0:
                board[offset_y + r][offset_x + c] = 1

    new_board = [row for row in board if any(v == 0 for v in row)]
    lines_cleared = BOARD_HEIGHT - len(new_board)
    score += lines_cleared * 100

    while len(new_board) < BOARD_HEIGHT:
        new_board.insert(0, [0] * BOARD_WIDTH)

    for i in range(BOARD_HEIGHT):
        board[i] = new_board[i]

def draw_game():
    oled.fill(0)

    game_w = BOARD_WIDTH * BLOCK_SIZE_X + 2
    game_h = BOARD_HEIGHT * BLOCK_SIZE_Y + 2
    oled.rect(OFFSET_X - 1, OFFSET_Y - 1, game_w, game_h, 1)

    for r in range(BOARD_HEIGHT):
        for c in range(BOARD_WIDTH):
            if board[r][c]:
                oled.fill_rect(OFFSET_X + c * BLOCK_SIZE_X, OFFSET_Y + r * BLOCK_SIZE_Y, BLOCK_SIZE_X - 1, BLOCK_SIZE_Y - 1, 1)

    if current_piece:
        for r, row in enumerate(current_piece):
            for c, val in enumerate(row):
                if val:
                    py = piece_y + r
                    px = piece_x + c
                    if py >= 0:
                        oled.fill_rect(OFFSET_X + px * BLOCK_SIZE_X, OFFSET_Y + py * BLOCK_SIZE_Y, BLOCK_SIZE_X - 1, BLOCK_SIZE_Y - 1, 1)

    text_x = 70
    oled.text("TETRIS", text_x, 5, 1)
    oled.text("SCORE:", text_x, 25, 1)
    oled.text(str(score), text_x, 38, 1)

    if game_over:
        oled.fill_rect(5, 20, 118, 25, 0)
        oled.rect(5, 20, 118, 25, 1)
        oled.text("GAME OVER", 28, 28, 1)

    oled.show()

# 4. 초기 구동 설정
get_new_piece()
last_fall_time = time.ticks_ms()
fall_interval = 600

last_left_state = False
last_right_state = False
last_rot_state = False
last_loop_time = time.ticks_ms()

draw_game()

# 5. 메인 루프
while not game_over:
    current_time = time.ticks_ms()

    pressed_left  = (touch_left.value() == 1)
    pressed_right = (touch_right.value() == 1)
    pressed_rot   = (touch_rot.value() == 1)
    pressed_drop  = (touch_drop.value() == 1)

    if pressed_left and not last_left_state:
        if not check_collision(current_piece, piece_x - 1, piece_y):
            piece_x -= 1
    last_left_state = pressed_left

    if pressed_right and not last_right_state:
        if not check_collision(current_piece, piece_x + 1, piece_y):
            piece_x += 1
    last_right_state = pressed_right

    if pressed_rot and not last_rot_state:
        rotated = rotate_piece(current_piece)
        if not check_collision(rotated, piece_x, piece_y):
            current_piece = rotated
    last_rot_state = pressed_rot

    if pressed_drop:
        current_fall_interval = 60
    else:
        current_fall_interval = fall_interval

    if time.ticks_diff(current_time, last_fall_time) > current_fall_interval:
        if not check_collision(current_piece, piece_x, piece_y + 1):
            piece_y += 1
        else:
            lock_piece(current_piece, piece_x, piece_y)
            get_new_piece()
            if check_collision(current_piece, piece_x, piece_y):
                game_over = True
        last_fall_time = current_time

    if time.ticks_diff(current_time, last_loop_time) > 40:
        draw_game()
        last_loop_time = current_time

    time.sleep_ms(10)

draw_game()__EXPLANATION__
💡 1. 전체 알고리즘 구조
📌 OLED 디스플레이 기반 테트리스 게임 알고리즘
  OLED를 SoftI2C로 마운트하고 4개의 GPIO 입력 핀을 조작용 풀다운 스위치로 초기 설정한 뒤, 가로 10 x 세로 20의 2차원 배열 격자 공간을 게임 보드로 정의합니다. while not game_over 메인 루프를 통해 입력 핀의 상태를 체크해 블록을 좌우 이동 및 회전시키고, 내부 타이머(ticks_ms)를 측정해 주기적으로 블록을 자동 하강시킵니다. 하강하는 블록이 바닥이나 잔해와 겹치면 충돌 감지(check_collision) 루틴으로 하강을 멈추고 고정(lock_piece)시키며, 가득 찬 행이 감지되면 배열 연산으로 해당 행을 삭제하고 점수를 올리면서 OLED 화면에 초당 25회 화면 프레임을 갱신하여 렌더링하는 게임 루프 구조입니다.

🔍 2. 주요 코드 라인별 세부 설명
▶️ touch_left = Pin(33, Pin.IN)
  machine 모듈의 Pin 클래스를 사용해 GPIO 33번 단자를 디지털 입력을 받는 핀(Pin.IN)으로 객체화합니다. 유저가 왼쪽 이동 버튼을 눌러 공급한 전압 변화 신호를 감지합니다.
▶️ rotated = [list(x) for x in zip(*shape[::-1])]
  행렬의 축을 전환하여 회전 상태를 얻어내는 파이썬 리스트 컴프리헨션 구문입니다. shape[::-1]을 통해 2차원 배열 행의 순서를 뒤집고, 언패킹 연산자 *와 zip 함수를 묶어 열 단위 요소들을 하나의 튜플로 결합한 후, 각 튜플들을 다시 리스트 형태로 환원하여 시계 방향 90도 회전을 완수합니다.
▶️ check_collision(piece, offset_x, offset_y)
  인자로 들어온 블록 데이터(piece)와 이동하고자 하는 가상 위치(offset_x, offset_y) 정보를 게임 보드 격자 배열 및 외곽선 벽 좌표 범위와 겹치는지 비교 연산하여, 충돌이 발생하면 True, 통과 시 False를 리턴하는 충돌 판별 사용자 정의 함수입니다.
▶️ lines_cleared = BOARD_HEIGHT - len(new_board)
  현재 게임 공간 내에서 수평 라인 내부에 빈 셀(0)이 없는 완결된 라인들을 삭제하고 축소된 임시 보드인 new_board의 행 개수와 본래의 크기 상수를 차감 연산합니다. 이 뺄셈 수식의 격차를 통하여 몇 개의 라인이 지워졌는지 파악합니다.
▶️ time.ticks_diff(current_time, last_fall_time)
  time 모듈에서 제공하는 ticks_diff() 메서드입니다. 시스템 틱 카운터 정밀 레지스터가 오버플로우되어 마이너스 음수 혹은 0으로 리셋(롤오버)되는 환경에서도 두 입력 시간 인자의 실제 경과 편차(오프셋)를 하드웨어 단에서 정밀하게 연산해 줍니다.`;

async function writeStaticCodeStream(res: any, code: string) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  const chunks = code.match(/[\s\S]{1,16}/g) || [code];
  for (const chunk of chunks) {
    const payload = {
      choices: [{
        delta: { content: chunk }
      }]
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    await new Promise(resolve => setTimeout(resolve, 8));
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    {
      name: 'api-chat-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/chat' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { prompt } = JSON.parse(body);
                if (!prompt) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Prompt is required' }));
                  return;
                }

                const cleanPrompt = prompt.toLowerCase().replace(/\s+/g, '');
                
                // Intercept suggestions locally - check specific modules first to prevent general keywords (like wifi or neopixel) from intercepting them
                if (cleanPrompt.includes('tcs34725') || cleanPrompt.includes('컬러센서')) {
                  await writeStaticCodeStream(res, TCS34725_CODE);
                  return;
                }
                if (cleanPrompt.includes('서울날씨') || cleanPrompt.includes('서울의실시간날씨') || (cleanPrompt.includes('날씨') && cleanPrompt.includes('서울'))) {
                  await writeStaticCodeStream(res, WEATHER_CODE);
                  return;
                }
                if (cleanPrompt.includes('테트리스') || cleanPrompt.includes('tetris') || cleanPrompt.includes('게임')) {
                  await writeStaticCodeStream(res, TETRIS_CODE);
                  return;
                }

                if (cleanPrompt.includes('dht11') || cleanPrompt.includes('온습도') || cleanPrompt.includes('dht') || cleanPrompt.includes('27번')) {
                  await writeStaticCodeStream(res, DHT11_CODE);
                  return;
                }
                if (cleanPrompt.includes('neopixel') || cleanPrompt.includes('네오픽셀') || cleanPrompt.includes('무지개') || cleanPrompt.includes('14번')) {
                  await writeStaticCodeStream(res, NEOPIXEL_CODE);
                  return;
                }
                if (cleanPrompt.includes('웹서버') || cleanPrompt.includes('webserver') || cleanPrompt.includes('웹페이지') || cleanPrompt.includes('소켓') || cleanPrompt.includes('서버')) {
                  await writeStaticCodeStream(res, WEBSERVER_CODE);
                  return;
                }
                if (cleanPrompt.includes('led') && (cleanPrompt.includes('깜빡') || cleanPrompt.includes('반복') || cleanPrompt.includes('1초'))) {
                  await writeStaticCodeStream(res, LED_CODE);
                  return;
                }
                if (cleanPrompt.includes('wifi') || cleanPrompt.includes('와이파이') || cleanPrompt.includes('인터넷')) {
                  await writeStaticCodeStream(res, WIFI_CODE);
                  return;
                }

                // Gemini API 호출
                const apiKey = getGeminiApiKey();
                if (!apiKey) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Gemini API Key가 설정되지 않았습니다. .env.local 파일에 GEMINI_API_KEY를 추가해 주세요.' }));
                  return;
                }

                // Few-shot 예시: 모델에게 올바른 출력 패턴을 직접 보여줌
                const fewShotExamples = [
                  {
                    role: 'user',
                    parts: [{ text: '내장 LED를 1초마다 깜빡이게 해줘' }]
                  },
                  {
                    role: 'model',
                    parts: [{ text: [
                      'import machine',
                      'import time',
                      '',
                      'LED_PIN = 2',
                      'BLINK_INTERVAL = 1.0',
                      '',
                      'led = machine.Pin(LED_PIN, machine.Pin.OUT)',
                      "print('[시스템] LED 깜빡이기 시작 (GPIO {})'.format(LED_PIN))",
                      'while True:',
                      '    led.value(1)',
                      '    time.sleep(BLINK_INTERVAL)',
                      '    led.value(0)',
                      '    time.sleep(BLINK_INTERVAL)',
                      '__EXPLANATION__',
                      'GPIO 2번 내장 LED를 1초 간격으로 켜고 끄는 코드입니다. machine 모듈로 핀을 출력 모드로 설정하고 while True 루프에서 켜고/끄기를 반복합니다.',
                      '',
                      '**핵심 문법**',
                      '- `machine.Pin(LED_PIN, machine.Pin.OUT)`: GPIO 핀을 출력 모드로 초기화',
                      '- `led.value(1) / led.value(0)`: 핀에 High/Low 신호 출력으로 LED 제어',
                      '- `time.sleep(BLINK_INTERVAL)`: 지정한 초 동안 실행 일시 정지',
                    ].join('\n') }]
                  },
                  {
                    role: 'user',
                    parts: [{ text: 'ssd1306 OLED 화면 중앙에 별을 그려줘' }]
                  },
                  {
                    role: 'model',
                    parts: [{ text: [
                      'import machine',
                      'import math',
                      'import ssd1306',
                      'from machine import SoftI2C, Pin',
                      '',
                      'I2C_SDA = 21',
                      'I2C_SCL = 22',
                      'OLED_W = 128',
                      'OLED_H = 64',
                      'STAR_OUTER_R = 25',
                      'STAR_INNER_R = 10',
                      '',
                      'i2c = SoftI2C(sda=Pin(I2C_SDA), scl=Pin(I2C_SCL))',
                      'oled = ssd1306.SSD1306_I2C(OLED_W, OLED_H, i2c)',
                      '',
                      'def draw_star(cx, cy, outer_r, inner_r, color):',
                      '    # 외곽/내부 반지름 교대, 36도 간격, 꼭대기(-90도)부터 시작',
                      '    points = []',
                      '    for i in range(10):',
                      '        angle = math.radians(-90 + i * 36)',
                      '        r = outer_r if i % 2 == 0 else inner_r',
                      '        points.append((int(cx + r * math.cos(angle)), int(cy + r * math.sin(angle))))',
                      '    for i in range(10):',
                      '        x1, y1 = points[i]',
                      '        x2, y2 = points[(i + 1) % 10]',
                      '        oled.line(x1, y1, x2, y2, color)',
                      '',
                      "print('[시스템] 별 그리기 시작')",
                      'oled.fill(0)',
                      'draw_star(OLED_W // 2, OLED_H // 2, STAR_OUTER_R, STAR_INNER_R, 1)',
                      'oled.show()',
                      "print('[시스템] 완료')",
                      '__EXPLANATION__',
                      'ssd1306 라이브러리로 OLED를 초기화한 뒤 삼각함수로 5각별 10개 꼭지점을 계산해 선으로 연결합니다. 외곽/내부 반지름이 36도마다 교대하여 별 모양이 만들어집니다.',
                      '',
                      '**핵심 문법**',
                      '- `SoftI2C(sda=Pin(21), scl=Pin(22))`: 소프트웨어 I2C 버스 초기화',
                      '- `ssd1306.SSD1306_I2C(W, H, i2c)`: 설치된 라이브러리로 OLED 객체 생성 (직접 구현 금지)',
                      '- `math.radians(-90 + i*36)`: 각도를 라디안으로 변환, 꼭대기(-90도)부터 36도 간격',
                      '- `i % 2 == 0`: 짝수 인덱스=외곽, 홀수=내부로 교대하여 별 윤곽 생성',
                      '- `oled.line(x1,y1,x2,y2,1)`: 두 꼭지점 사이를 흰색 선으로 연결',
                    ].join('\n') }]
                  },
                  {
                    role: 'user',
                    parts: [{ text: prompt }]
                  }
                ];

                const geminiResponse = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: fewShotExamples,
                      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                      generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 8192,
                        thinkingConfig: { thinkingBudget: 0 },
                      },
                    }),
                  }
                );

                if (!geminiResponse.ok) {
                  const errorText = await geminiResponse.text();
                  res.writeHead(geminiResponse.status, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Gemini API 오류: ${errorText}` }));
                  return;
                }

                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive',
                });

                // Gemini SSE → OpenAI SSE 포맷 변환
                const reader = geminiResponse.body?.getReader();
                const decoder = new TextDecoder();
                if (reader) {
                  let buffer = '';
                  while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                      const trimmed = line.trim();
                      if (!trimmed.startsWith('data: ')) continue;
                      const dataVal = trimmed.slice(6).trim();
                      if (!dataVal || dataVal === '[DONE]') continue;
                      try {
                        const parsed = JSON.parse(dataVal);
                        const parts = parsed.candidates?.[0]?.content?.parts || [];
                        // thinking 토큰 제외하고 실제 텍스트만 합산
                        const text = parts
                          .filter((p: any) => !p.thought)
                          .map((p: any) => p.text || '')
                          .join('');
                        if (text) {
                          const openaiFormat = { choices: [{ delta: { content: text } }] };
                          res.write(`data: ${JSON.stringify(openaiFormat)}\n\n`);
                        }
                      } catch {}
                    }
                  }
                }
                res.write('data: [DONE]\n\n');
                res.end();
              } catch (e: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
          next();
        });
      }
    }
  ],
})
