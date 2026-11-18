const api = require('../../services/api');
const config = require('../../config/index');
const { nutrition, exercise } = require('../../utils/insights');
const { recentDays, dayLabel } = require('../../utils/date');

function rounded(value) { return Number(value.toFixed(1)); }

Page({
  data: {
    userId:'', userAlias:'', mode:'charts', period:'30', metric:'weight',
    loading:true, entries:[], dailyRows:[], rawRows:[], chartPoints:[],
    metricTitle:'体重趋势（kg）', primaryStat:'—', secondaryStat:'—', count:0,
    periods:[['7','7天'],['30','30天'],['all','全部']],
    metrics:[['weight','体重'],['health','健康分'],['exercise','运动分']]
  },
  onShow() {
    if (this.getTabBar) this.getTabBar().setData({ selected: 1 });
    const app=getApp(); const changed=app.globalData.userId!==this.data.userId;
    this.setData({userId:app.globalData.userId,userAlias:app.globalData.userAlias});
    if(changed || !this.data.entries.length) this.load();
  },
  chooseUser() {
    wx.showActionSheet({itemList:['YC','示例学员'],success:result=>{
      const user=result.tapIndex===0?{userId:'USR-SELF-001',displayAlias:'YC'}:{userId:'USR-DEMO-001',displayAlias:'示例学员'};
      getApp().switchUser(user);this.setData({userId:user.userId,userAlias:user.displayAlias});this.load();
    }});
  },
  async load() {
    this.setData({loading:true});
    try {
      const data=await api.records(this.data.userId);
      const entries=data.entries.map(entry=>{
        const food=nutrition(entry);const motion=exercise(entry.activityText);
        return Object.assign({},entry,{food,motion,dietDisplay:entry.dietText||entry.dietScoreRaw||'当天没有填写饮食内容',activityDisplay:entry.activityText||'当天没有填写运动内容'});
      });
      const anchor=entries.length?entries[entries.length-1].localDate:new Date().toISOString().slice(0,10);
      const byDate={};entries.forEach(item=>{byDate[item.localDate]=item});
      const dailyRows=recentDays(anchor,30).map(date=>{
        const entry=byDate[date]||null;
        return {date,dateLabel:dayLabel(date),entry,weightLabel:entry&&entry.weightKg!==null?`${entry.weightKg} kg`:'未记录',food:entry&&entry.food,motion:entry&&entry.motion};
      });
      this.setData({entries,dailyRows,rawRows:dailyRows,loading:false});
      this.refreshChart();
    } catch(error) {this.setData({loading:false});wx.showToast({title:'记录读取失败',icon:'none'});}
  },
  changeMode(event){this.setData({mode:event.currentTarget.dataset.mode});},
  changePeriod(event){this.setData({period:event.currentTarget.dataset.value});this.refreshChart();},
  changeMetric(event){this.setData({metric:event.currentTarget.dataset.value});this.refreshChart();},
  refreshChart(){
    const {entries,period,metric}=this.data;if(!entries.length)return;
    const anchor=new Date(`${entries[entries.length-1].localDate}T00:00:00+08:00`).getTime();
    const days=period==='all'?Infinity:Number(period);
    const selected=entries.filter(entry=>anchor-new Date(`${entry.localDate}T00:00:00+08:00`).getTime()<days*86400000);
    let points=[];
    if(metric==='weight') points=selected.filter(x=>x.weightKg!==null).map(x=>({date:x.localDate,value:x.weightKg}));
    if(metric==='health') points=selected.filter(x=>x.food).map(x=>({date:x.localDate,value:x.food.score}));
    if(metric==='exercise') points=selected.filter(x=>x.motion&&x.motion.score!==null).map(x=>({date:x.localDate,value:x.motion.score}));
    let primary='—',secondary='—';
    if(points.length){
      const values=points.map(x=>x.value);
      if(metric==='weight'){
        const change=points.length>1?rounded(points[points.length-1].value-points[0].value):null;
        primary=change===null?'—':`${change>0?'+':''}${change} kg`;secondary=`最低 ${Math.min(...values)} kg`;
      }else{primary=`${rounded(values.reduce((a,b)=>a+b,0)/values.length)} 分`;secondary=metric==='exercise'?'60 分钟 = 10 分':'满分 10 分';}
    }
    const titles={weight:'体重趋势（kg）',health:'健康分趋势',exercise:'运动分趋势'};
    this.setData({chartPoints:points,metricTitle:titles[metric],primaryStat:primary,secondaryStat:secondary,count:points.length});
  },
  toggleRaw(event){
    const date=event.currentTarget.dataset.date;
    const rawRows=this.data.rawRows.map(row=>Object.assign({},row,{expanded:row.date===date?!row.expanded:row.expanded}));
    this.setData({rawRows});
  },
  openInbody(){wx.navigateTo({url:'/pages/inbody/index'});},
  downloadReport(){
    if(!config.REPORT_BASE_URL){return wx.showModal({title:'报告出口已预留',content:'当前演示版还没有配置 HTTPS 报告服务。接入正式后端后，这里会直接下载 Word 报告。',showCancel:false});}
    wx.showLoading({title:'正在生成'});
    wx.downloadFile({url:`${config.REPORT_BASE_URL}/api/users/${this.data.userId}/report.docx?period=${this.data.period}`,success:res=>wx.openDocument({filePath:res.tempFilePath,fileType:'docx'}),complete:()=>wx.hideLoading()});
  }
});
