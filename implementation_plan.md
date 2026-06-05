# ESP32 VFS 재귀적 목록 조회 및 폴더 업로드 기능 구현 계획

ESP32 보드의 하위 디렉토리를 포함한 전체 파일 시스템을 재귀적으로 조회하고, 로컬 폴더 자체를 선택해 내부 파일 트리 구조 그대로 업로드할 수 있는 기능을 추가합니다.

## User Review Required

> [!NOTE]
> 폴더 업로드 시 하위 디렉토리 자동 생성(`os.mkdir`) 처리가 추가됩니다. 이미 존재하는 폴더명일 경우 예외처리(`try-except: pass`)를 통해 건너뛰므로 기존 파일 손상 우려 없이 안전하게 디렉토리 구조가 생성됩니다.

## Proposed Changes

### VibeESP32 프론트엔드 컴포넌트

#### [MODIFY] [App.tsx](file:///c:/Users/pjs21/Desktop/webapp/Vibe_ESP32/src/App.tsx)

1. **디렉토리 재귀 목록 조회 (`_list_all`) 적용**
   - 기존의 `os.listdir()` 단일 호출은 루트 폴더(`/`) 내의 파일만 가져왔습니다.
   - `refreshBoardFiles`, `uploadFileToBoard`, `deleteBoardFile`에서 실행하는 파일 조회 명령을 재귀 함수(`_list_all`) 스크립트로 대체하여 하위 폴더 내 파일까지 리스트로 구성되도록 변경합니다. (예: `lib/ssd1306.py` 등으로 표시)

2. **파일 경로에 따른 부모 폴더 자동 생성**
   - `uploadFileToBoard` 내부에 파일 경로에 `/`가 포함된 경우 부모 폴더들을 차례대로 생성(`os.mkdir`)하는 로직을 삽입합니다.

3. **폴더 업로드 처리 로직 추가**
   - `selectedFolderFiles` 상태값을 선언합니다.
   - HTML5 `webkitdirectory` 속성을 활용해 사용자가 폴더를 선택할 수 있게 합니다.
   - `handleFolderSelect` 및 `handleFolderUpload` 메소드를 구현하여 선택한 폴더 안의 모든 텍스트 파일(.py, .txt, .json, .html 등)을 단일 Raw REPL 세션 안에서 빠르고 안전하게 연속 업로드합니다.

4. **HTML UI 레이아웃 업데이트**
   - 보드 파일 및 라이브러리 관리자 카드에 "내 컴퓨터에서 폴더 업로드" 입력부 및 업로드 버튼을 추가합니다.

---

## Verification Plan

### Automated / Manual Verification
1. **폴더 업로드 동작 테스트**
   - `lib` 폴더나 센서 관련 폴더(예: 안에 여러 `.py` 파일이 들어있는 폴더)를 선택하여 업로드합니다.
   - ESP32 보드에 `lib/` 폴더가 자동 생성되고 그 내부에 파일들이 올바르게 업로드되는지 확인합니다.

2. **VFS 재귀 표시 기능 검증**
   - 폴더 업로드 완료 후, 파일 목록에 `lib/ssd1306.py` 혹은 `sensors/dht11.py` 형태로 하위 경로가 정상적으로 목록에 렌더링되는지 확인합니다.
   - 목록에서 하위 파일 삭제 클릭 시 `os.remove`가 경로를 찾아 정상 삭제 처리를 수행하는지 검증합니다.
