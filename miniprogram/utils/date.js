function pad(value) { return String(value).padStart(2, '0'); }

function localDate(input = new Date()) {
  return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
}

function todayLabel() {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
}

function dayLabel(value) {
  const date = new Date(`${value}T00:00:00+08:00`);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${date.getMonth() + 1}.${date.getDate()} ${weekdays[date.getDay()]}`;
}

function recentDays(anchor, length) {
  const base = new Date(`${anchor}T00:00:00+08:00`);
  return Array.from({ length }, (_, index) => {
    const date = new Date(base.getTime() - index * 86400000);
    return localDate(date);
  });
}

module.exports = { localDate, todayLabel, dayLabel, recentDays };
