const config = require('../config/index');
const demo = require('./demo-data');
const store = require('./store');
const { parseText } = require('../utils/insights');
const { localDate } = require('../utils/date');
const exerciseLibrary = require('./exercise-library');

function request(path, method = 'GET', data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.API_BASE_URL}${path}`,
      method,
      data,
      header: { 'content-type': 'application/json' },
      success: response => response.statusCode >= 200 && response.statusCode < 300 ? resolve(response.data) : reject(new Error(response.data && response.data.error || '请求失败')),
      fail: reject
    });
  });
}

function users() { return config.DEMO_MODE ? Promise.resolve(demo.USERS) : request('/api/users'); }

function records(userId) {
  if (!config.DEMO_MODE) return request(`/api/users/${userId}/records`);
  const entries = store.getEntries(userId);
  const weights = entries.filter(item => item.weightKg !== null && item.weightKg !== undefined).map(item => ({ date: item.localDate, value: item.weightKg }));
  return Promise.resolve({ user: demo.USERS.find(item => item.userId === userId), entries, weights });
}

function parse(userId, rawText, inputMode) {
  return config.DEMO_MODE ? Promise.resolve(parseText(rawText, inputMode, localDate())) : request('/api/parse', 'POST', { userId, rawText, inputMode });
}

function saveEntry(userId, preview) {
  return config.DEMO_MODE ? Promise.resolve(store.saveEntry(userId, preview)) : request('/api/entries', 'POST', { userId, entry: preview });
}

function feedback(userId, preview) {
  if (!config.DEMO_MODE) return request('/api/feedback', 'POST', { userId, entry: preview });
  const preserve = preview.activityText ? '你把今天的运动写得很具体，这会让后续调整更有依据。' : preview.dietText ? '你如实记下了饮食，不需要为了“记录得漂亮”删掉任何一项。' : '你完成了今天的记录，这本身就是持续复盘的基础。';
  return Promise.resolve({ preserve, nextAction: '明天继续用一句话记录即可，先保持低负担。' });
}

function coachFeedback(userId) { return config.DEMO_MODE ? Promise.resolve(userId === 'USR-DEMO-001' ? demo.COACH_FEEDBACK : []) : request(`/api/users/${userId}/coach-feedback`); }
function inbody(userId) { return config.DEMO_MODE ? Promise.resolve(demo.INBODY) : request(`/api/users/${userId}/inbody`); }
function submitQuestion(userId, questionText, inputMode) { return config.DEMO_MODE ? Promise.resolve(store.saveQuestion(userId, questionText, inputMode)) : request('/api/questions', 'POST', { userId, questionText, inputMode }); }

function exerciseList() { return Promise.resolve({ categories: exerciseLibrary.CATEGORIES, exercises: exerciseLibrary.EXERCISES }); }

function training(userId) {
  if (!config.DEMO_MODE) return request(`/api/users/${userId}/training`);
  const assignment = store.getTrainingAssignment(userId);
  if (!assignment) return Promise.resolve(null);
  return Promise.resolve({ ...assignment, exerciseItems: assignment.exerciseIds.map(exerciseLibrary.getExercise).filter(Boolean) });
}

function coachReplies(userId) { return config.DEMO_MODE ? Promise.resolve(store.getReplies(userId)) : request(`/api/users/${userId}/coach-replies`); }

function coachDashboard() {
  if (!config.DEMO_MODE) {
    return Promise.all([request('/api/coach/students'), request('/api/coach/questions')])
      .then(([students, questions]) => ({ students, questions }));
  }
  const students = demo.USERS.filter(user => user.userId !== 'USR-SELF-001').map(user => {
    const entries = store.getEntries(user.userId);
    const latest = entries[entries.length - 1] || null;
    return { ...user, latestDate: latest && latest.localDate, latestWeightKg: latest && latest.weightKg, recordCount: entries.length, hasTrainingToday: !!store.getTrainingAssignment(user.userId) };
  });
  return Promise.resolve({ students, questions: store.getCoachInbox() });
}

function replyQuestion(userId, questionId, replyText) {
  return config.DEMO_MODE ? Promise.resolve(store.saveCoachReply(userId, questionId, replyText)) : request('/api/coach/replies', 'POST', { userId, questionId, replyText });
}

function assignTraining(userId, exerciseIds, prescription, note) {
  return config.DEMO_MODE ? Promise.resolve(store.saveTrainingAssignment(userId, exerciseIds, prescription, note)) : request('/api/coach/training-assignments', 'POST', { userId, exerciseIds, prescription, note });
}

function uploadVoice(userId, tempFilePath, duration, scene) {
  if (config.DEMO_MODE || !config.API_BASE_URL) {
    store.saveRecording(userId, tempFilePath, duration);
    return Promise.resolve({ transcript: '', savedLocally: true });
  }
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${config.API_BASE_URL}/api/voice/parse`,
      filePath: tempFilePath,
      name: 'audio',
      formData: { userId, duration: String(duration), scene },
      success: response => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error('语音识别失败'));
        try { resolve(JSON.parse(response.data)); } catch (error) { reject(error); }
      },
      fail: reject
    });
  });
}

module.exports = {
  users, records, parse, saveEntry, feedback, coachFeedback, inbody, submitQuestion, uploadVoice,
  exerciseList, training, coachReplies, coachDashboard, replyQuestion, assignTraining
};
