import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Download,
  Droplets,
  Dumbbell,
  FileCheck2,
  Gauge,
  Info,
  Scale,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { InBodyTrendReport } from "../../shared/types";
import { api } from "../api";
import { appUrl } from "../appUrl";
import { InBodyTrendChart } from "../components/InBodyTrendChart";

function signed(value: number, unit: string): string {
  const rounded = value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded} ${unit}`;
}

function dayLabel(date: string): string {
  return date.replaceAll("-", ".");
}

export function InBodyReportPage() {
  const [report, setReport] = useState<InBodyTrendReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.inBody("USR-DEMO-001").then(setReport).catch((requestError) => setError(requestError.message));
  }, []);

  const metrics = useMemo(() => {
    if (!report) return [];
    const first = report.measurements[0];
    const latest = report.measurements.at(-1)!;
    return [
      { label: "体重", value: `${latest.weightKg.toFixed(1)} kg`, change: signed(latest.weightKg - first.weightKg, "kg"), icon: Scale, tone: "green" },
      { label: "体脂肪", value: `${latest.bodyFatMassKg.toFixed(1)} kg`, change: signed(latest.bodyFatMassKg - first.bodyFatMassKg, "kg"), icon: Target, tone: "amber" },
      { label: "骨骼肌", value: `${latest.skeletalMuscleKg.toFixed(1)} kg`, change: signed(latest.skeletalMuscleKg - first.skeletalMuscleKg, "kg"), icon: Dumbbell, tone: "blue" },
      { label: "身体总水分", value: `${latest.totalBodyWater.toFixed(1)} L`, change: signed(latest.totalBodyWater - first.totalBodyWater, "L"), icon: Droplets, tone: "purple" },
    ] as const;
  }, [report]);

  if (error) {
    return (
      <main className="inbody-report-shell">
        <section className="inbody-state-card">
          <strong>报告暂时无法打开</strong>
          <p>{error}</p>
          <a href={appUrl("")}>返回小程序</a>
        </section>
      </main>
    );
  }

  if (!report) {
    return <main className="inbody-report-shell"><div className="inbody-loading">正在整理三次身体成分报告…</div></main>;
  }

  const first = report.measurements[0];
  const latest = report.measurements.at(-1)!;
  const leanPercent = 100 - latest.bodyFatPercent;

  return (
    <main className="inbody-report-shell">
      <article className="inbody-report-page">
        <header className="inbody-report-header">
          <a className="inbody-back" href={appUrl("")} aria-label="返回小程序"><ArrowLeft aria-hidden="true" /></a>
          <div>
            <p className="inbody-eyebrow">身体成分 · 阶段报告</p>
            <h1>示例学员 · InBody 趋势报告</h1>
            <span>{dayLabel(report.dateRange.start)}—{dayLabel(report.dateRange.end)} · 3 次测量</span>
          </div>
          <a className="inbody-download" href={appUrl("api/users/USR-DEMO-001/inbody-report.pdf")} download>
            <Download aria-hidden="true" />下载 PDF
          </a>
        </header>

        <section className="inbody-hero">
          <div className="inbody-hero__icon"><ShieldCheck aria-hidden="true" /></div>
          <div>
            <p>阶段结论</p>
            <h2>{report.headline}</h2>
            <span>{report.summary}</span>
          </div>
        </section>

        <section className="inbody-metric-cards" aria-label="关键指标">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article className={`inbody-metric-card is-${metric.tone}`} key={metric.label}>
                <div><Icon aria-hidden="true" /><span>{metric.label}</span></div>
                <strong>{metric.value}</strong>
                <small>较首次 <b>{metric.change}</b></small>
              </article>
            );
          })}
        </section>

        <section className="inbody-section inbody-trends">
          <div className="inbody-section-heading">
            <div>
              <p>01 · 变化轨迹</p>
              <h2>四个关键指标，看清减重质量</h2>
            </div>
            <span className="inbody-section-tag"><Activity aria-hidden="true" />同图对照</span>
          </div>
          <InBodyTrendChart measurements={report.measurements} />
          <div className="inbody-device-note">
            <Info aria-hidden="true" />
            <p><strong>读图边界：</strong>{report.limitation}</p>
          </div>
        </section>

        <section className="inbody-two-column">
          <div className="inbody-section inbody-composition">
            <div className="inbody-section-heading">
              <div><p>02 · 末次快照</p><h2>体重构成与重要参数</h2></div>
            </div>
            <div className="composition-visual" role="img" aria-label={`末次报告体脂率${latest.bodyFatPercent}%，其余体重占比${leanPercent.toFixed(1)}%`}>
              <div className="composition-ring" style={{ "--fat-angle": `${latest.bodyFatPercent * 3.6}deg` } as React.CSSProperties}>
                <div><strong>{latest.bodyFatPercent}%</strong><span>体脂率</span></div>
              </div>
              <div className="composition-key">
                <span><i className="is-fat" />体脂肪 <b>{latest.bodyFatMassKg} kg</b></span>
                <span><i className="is-lean" />去脂体重 <b>{latest.fatFreeMassKg} kg</b></span>
                <small>水分属于去脂组织的一部分，不与肌肉、脂肪相加。</small>
              </div>
            </div>
            <div className="latest-detail-grid">
              <span><b>{report.latestDetails.inBodyScore}</b>InBody 评分</span>
              <span><b>{report.latestDetails.visceralFatLevel}</b>内脏脂肪等级</span>
              <span><b>{report.latestDetails.smiKgM2}</b>SMI kg/m²</span>
              <span><b>{latest.bmi}</b>BMI kg/m²</span>
            </div>
          </div>

          <div className="inbody-section inbody-findings">
            <div className="inbody-section-heading">
              <div><p>03 · 怎么理解</p><h2>把数字变成判断</h2></div>
            </div>
            <div className="finding-list">
              {report.findings.map((finding, index) => (
                <article className={`finding-item is-${finding.tone}`} key={finding.title}>
                  <span>{index + 1}</span>
                  <div><h3>{finding.title}</h3><p>{finding.detail}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="inbody-section inbody-actions">
          <div className="inbody-section-heading">
            <div><p>04 · 下一阶段</p><h2>减脂继续，肌肉要守住</h2></div>
            <Gauge aria-hidden="true" />
          </div>
          <div className="action-grid">
            {report.nextActions.map((action, index) => (
              <article key={action}><CheckCircle2 aria-hidden="true" /><div><strong>{["训练", "饮食", "复测"][index]}</strong><p>{action}</p></div></article>
            ))}
          </div>
          <div className="adjustment-card">
            <Target aria-hidden="true" />
            <div><strong>什么时候需要重新调整</strong><p>{report.adjustmentSignal}</p></div>
          </div>
        </section>

        <section className="inbody-section inbody-table-section">
          <div className="inbody-section-heading">
            <div><p>05 · 原始读数</p><h2>三次报告对照表</h2></div>
            <FileCheck2 aria-hidden="true" />
          </div>
          <div className="inbody-table-wrap">
            <table>
              <thead><tr><th>指标</th>{report.measurements.map((item) => <th key={item.date}>{item.date.slice(5)}</th>)}</tr></thead>
              <tbody>
                {[
                  ["体重 kg", "weightKg"], ["去脂体重 kg", "fatFreeMassKg"], ["体脂肪量 kg", "bodyFatMassKg"],
                  ["骨骼肌量 kg", "skeletalMuscleKg"], ["身体总水分 kg/L", "totalBodyWater"], ["体脂率 %", "bodyFatPercent"],
                  ["BMI", "bmi"], ["腰臀比", "waistHipRatio"], ["基础代谢 kcal", "basalMetabolicRateKcal"],
                ].map(([label, key]) => (
                  <tr key={key}><th>{label}</th>{report.measurements.map((item) => <td key={item.date}>{item[key as keyof typeof item]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="inbody-sources">
            <summary>查看数据来源</summary>
            <p>原始来源：{report.sourceIds.join("、")}；复盘方法卡：{report.knowledgeSourceIds.join("、")}。</p>
            <p>本页是身体成分趋势复盘，不替代医疗诊断；设备给出的目标体重与评分未直接作为教练目标。</p>
          </details>
        </section>

        <footer className="inbody-report-footer">
          <span>数据截止 {report.dataCutoff}</span>
          <span>版本 1.0 · 仅供示例学员与教练复盘</span>
        </footer>
      </article>
    </main>
  );
}
