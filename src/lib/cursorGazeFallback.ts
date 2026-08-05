// 커서(마우스) 좌표를 시선 데이터 대신 사용하는 폴백 스위치 (opt-in).
// 실 배포에서는 꺼 두어(기본값) 마우스 움직임이 실제 시선 데이터로 백엔드에 저장되는 것을 막는다.
// 로컬 데모에서 마우스로 시선을 흉내 내려면 VITE_CURSOR_GAZE_FALLBACK=true 를 설정한다.
// 가상 아이트래커(개발자 치트)는 iread:gaze 이벤트를 직접 발생시키므로 이 스위치와 무관하게 동작한다.
export const cursorGazeFallbackEnabled: boolean =
  import.meta.env.VITE_CURSOR_GAZE_FALLBACK === 'true'
