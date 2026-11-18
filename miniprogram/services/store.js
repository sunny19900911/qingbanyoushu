const demo = require('./demo-data');
const { localDate } = require('../utils/date');

const KEYS = {
  selectedUser: 'qbys:selected-user',
  entries: userId => `qbys:entries:${userId}`,
  questions: userId => `qbys:questions:${userId}`,
  replies: userId => `qbys:replies:${userId}`,
  training: userId => `qbys:training:${userId}`,
  recordings: userId => `qbys:recordings:${userId}`
};

function getSelectedUser() {
  return wx.getStorageSync(KEYS.selectedUser) || demo.USERS[0];
}

function setSelectedUser(user) { wx.setStorageSync(KEYS.selectedUser, user); }

function getEntries(userId) {
  const runtime = wx.getStorageSync(KEYS.entries(userId)) || [];
  return [...(demo.ENTRIES[userId] || []), ...runtime].sort((a, b) => a.localDate.localeCompare(b.localDate));
}

function saveEntry(userId, preview) {
  const runtime = wx.getStorageSync(KEYS.entries(userId)) || [];
  const now = new Date();
  const entry = {
    entryId: `LOCAL-${now.getTime()}`,
    sourceId: null,
    userId,
    localDate: preview.localDate,
    weightKg: preview.weightKg,
    weightRaw: preview.weightRaw,
    dietText: preview.dietText,
    dietScoreRaw: preview.dietScoreRaw || null,
    activityText: preview.activityText,
    rawText: preview.rawText,
    origin: 'prototype',
    createdAt: now.toISOString()
  };
  runtime.push(entry);
  wx.setStorageSync(KEYS.entries(userId), runtime);
  return entry;
}

function saveQuestion(userId, questionText, inputMode) {
  const questions = wx.getStorageSync(KEYS.questions(userId)) || [];
  const question = { questionId: `Q-${Date.now()}`, userId, questionText, inputMode, status: 'new', createdAt: new Date().toISOString() };
  questions.unshift(question);
  wx.setStorageSync(KEYS.questions(userId), questions);
  return question;
}

function getQuestions(userId) { return wx.getStorageSync(KEYS.questions(userId)) || []; }

function getCoachInbox() {
  return demo.USERS
    .filter(user => user.userId !== 'USR-SELF-001')
    .flatMap(user => getQuestions(user.userId).map(question => ({ ...question, displayAlias: user.displayAlias })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function saveCoachReply(userId, questionId, replyText) {
  const replies = wx.getStorageSync(KEYS.replies(userId)) || [];
  const reply = { replyId: `R-${Date.now()}`, userId, questionId, replyText, coachAlias: 'YC', createdAt: new Date().toISOString() };
  replies.unshift(reply);
  wx.setStorageSync(KEYS.replies(userId), replies);
  const questions = getQuestions(userId).map(item => item.questionId === questionId ? { ...item, status: 'replied' } : item);
  wx.setStorageSync(KEYS.questions(userId), questions);
  return reply;
}

function getReplies(userId) { return wx.getStorageSync(KEYS.replies(userId)) || []; }

function saveTrainingAssignment(userId, exerciseIds, prescription, note) {
  const assignments = wx.getStorageSync(KEYS.training(userId)) || [];
  const assignment = {
    assignmentId: `TRAIN-${Date.now()}`,
    userId,
    localDate: localDate(),
    exerciseIds,
    prescription,
    note,
    status: 'assigned',
    createdAt: new Date().toISOString()
  };
  assignments.unshift(assignment);
  wx.setStorageSync(KEYS.training(userId), assignments);
  return assignment;
}

function getTrainingAssignment(userId, date = localDate()) {
  const assignments = wx.getStorageSync(KEYS.training(userId)) || [];
  return assignments.find(item => item.localDate === date) || null;
}

function saveRecording(userId, tempFilePath, duration) {
  const list = wx.getStorageSync(KEYS.recordings(userId)) || [];
  const item = { tempFilePath, duration, createdAt: new Date().toISOString() };
  list.unshift(item);
  wx.setStorageSync(KEYS.recordings(userId), list.slice(0, 10));
  return item;
}

module.exports = {
  getSelectedUser, setSelectedUser, getEntries, saveEntry,
  saveQuestion, getQuestions, getCoachInbox, saveCoachReply, getReplies,
  saveTrainingAssignment, getTrainingAssignment, saveRecording
};
