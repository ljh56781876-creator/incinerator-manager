// Scriptable에 "소각로 위젯"이라는 이름으로 저장하세요.
const fm = FileManager.local();
const path = fm.joinPath(fm.documentsDirectory(), 'incinerator-widget-v1.json');
const kinds = {work: '업무', operation: '가동', stop: '정지', check: '점검', maintenance: '보수'};
const colors = {work: '#C4B5FD', operation: '#86EFAC', stop: '#FDA4AF', check: '#FDE68A', maintenance: '#7DD3FC'};
const incoming = args.queryParameters.snapshot;
const dateKey = date => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return [value('year'), value('month'), value('day')].join('-');
};
const validURL = value => typeof value === 'string' && /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s?#]*)?$/i.test(value);
function parseSnapshot(raw) {
  if (typeof raw !== 'string' || raw.length > 8000) throw Error('일정 전송값이 올바르지 않습니다.');
  const data = JSON.parse(raw);
  if (data.version !== 1 || !validURL(data.url) || !Array.isArray(data.days) || data.days.length !== 3 ||
    !data.days.every(day => /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
      Array.isArray(day.items) && day.items.length <= 3 && Number.isInteger(day.more) && day.more >= 0 &&
      day.items.every(item => typeof item.name === 'string' && item.name.length <= 14 &&
        Object.hasOwn(kinds, item.kind) && /^[1-4]$|^all$/.test(item.unit) && /^(?:\d{2}:\d{2})?$/.test(item.time)))) {
    throw Error('일정 전송값을 읽을 수 없습니다.');
  }
  return data;
}
let data;
if (incoming && !config.runsInWidget) {
  try {
    data = parseSnapshot(incoming);
    fm.writeString(path, incoming);
  } catch (error) {
    const alert = new Alert();
    alert.title = '위젯 업데이트 실패';
    alert.message = error.message;
    alert.addAction('확인');
    await alert.presentAlert();
  }
}
if (!data && fm.fileExists(path)) {
  try { data = parseSnapshot(fm.readString(path)); } catch (_) {}
}
const small = config.widgetFamily === 'small';
const widget = new ListWidget();
widget.backgroundColor = new Color('#101827');
widget.setPadding(13, 14, 13, 14);
const now = new Date();
const today = dateKey(now);
const tomorrow = dateKey(new Date(now.getTime() + 86400000));
const todayData = data?.days.find(day => day.date === today);
const tomorrowData = data?.days.find(day => day.date === tomorrow);
if (data) widget.url = data.url;
widget.refreshAfterDate = new Date(now.getTime() + 30 * 60000);

function line(parent, value, color, size, bold = false) {
  const text = parent.addText(value);
  text.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  text.textColor = new Color(color);
  text.lineLimit = 1;
  text.minimumScaleFactor = 0.75;
}
line(widget, '소각로 일정', '#F8FAFC', 15, true);
widget.addSpacer(6);
function addDay(day, label, limit) {
  line(widget, label + ' ' + day.date.slice(5).replace('-', '/'), '#94A3B8', 10, true);
  if (!day.items.length) line(widget, '등록된 일정 없음', '#CBD5E1', 11);
  for (const item of day.items.slice(0, limit)) {
    const unit = item.unit === 'all' ? '전체' : item.unit + '호기';
    const prefix = small ? unit : [item.time, unit, kinds[item.kind]].filter(Boolean).join(' ');
    line(widget, prefix + ' · ' + item.name, colors[item.kind], 11);
  }
  const remaining = day.more + Math.max(day.items.length - limit, 0);
  if (remaining) line(widget, '외 ' + remaining + '건', '#94A3B8', 10);
}
if (todayData) {
  addDay(todayData, '오늘', small ? 3 : 2);
  if (!small && tomorrowData) {
    widget.addSpacer(5);
    addDay(tomorrowData, '내일', 2);
  }
} else {
  line(widget, data ? '일정 갱신 필요' : '연결 대기 중', '#FDE68A', 12, true);
  line(widget, '앱 → 위젯 업데이트', '#CBD5E1', 11);
}
widget.addSpacer();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
