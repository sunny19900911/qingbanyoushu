const api = require('../../services/api');
const config = require('../../config/index');

function signed(value, unit){const number=Number(value.toFixed(1));return `${number>0?'+':''}${number} ${unit}`;}

Page({
  data:{loading:true,report:null,cards:[],charts:[],latest:null,leanPercent:0,rows:[]},
  async onLoad(){
    try{
      const report=await api.inbody('USR-DEMO-001');const first=report.measurements[0];const latest=report.measurements[report.measurements.length-1];
      const cards=[
        {label:'体重',value:`${latest.weightKg} kg`,change:signed(latest.weightKg-first.weightKg,'kg'),tone:'green'},
        {label:'体脂肪',value:`${latest.bodyFatMassKg} kg`,change:signed(latest.bodyFatMassKg-first.bodyFatMassKg,'kg'),tone:'orange'},
        {label:'骨骼肌',value:`${latest.skeletalMuscleKg} kg`,change:signed(latest.skeletalMuscleKg-first.skeletalMuscleKg,'kg'),tone:'blue'},
        {label:'身体总水分',value:`${latest.totalBodyWater} L`,change:signed(latest.totalBodyWater-first.totalBodyWater,'L'),tone:'purple'}
      ];
      const chartDefs=[['体重','weightKg'],['体脂肪量','bodyFatMassKg'],['骨骼肌量','skeletalMuscleKg'],['身体总水分','totalBodyWater']];
      const charts=chartDefs.map(([label,key])=>({label,points:report.measurements.map(item=>({date:item.date,value:item[key]}))}));
      const rowDefs=[['体重 kg','weightKg'],['体脂肪量 kg','bodyFatMassKg'],['骨骼肌量 kg','skeletalMuscleKg'],['身体总水分 L','totalBodyWater'],['体脂率 %','bodyFatPercent'],['BMI','bmi'],['腰臀比','waistHipRatio'],['基础代谢 kcal','basalMetabolicRateKcal']];
      const rows=rowDefs.map(([label,key])=>({label,values:report.measurements.map(item=>item[key])}));
      this.setData({loading:false,report,cards,charts,latest,leanPercent:Number((100-latest.bodyFatPercent).toFixed(1)),rows});
    }catch(error){this.setData({loading:false});wx.showToast({title:'报告读取失败',icon:'none'});}
  },
  back(){wx.navigateBack();},
  downloadPdf(){
    if(!config.REPORT_BASE_URL)return wx.showModal({title:'PDF 出口已预留',content:'当前演示版还没有配置 HTTPS 报告服务。接入正式后端后，这里会直接下载并打开 PDF。',showCancel:false});
    wx.showLoading({title:'正在生成'});wx.downloadFile({url:`${config.REPORT_BASE_URL}/api/users/USR-DEMO-001/inbody-report.pdf`,success:res=>wx.openDocument({filePath:res.tempFilePath,fileType:'pdf'}),complete:()=>wx.hideLoading()});
  }
});
