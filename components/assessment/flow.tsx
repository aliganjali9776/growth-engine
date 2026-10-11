import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  FileCheck2,
  LockKeyhole,
  Network,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  dimensionMeta,
  dimensions,
  responseLabels,
} from "@/lib/assessment/questions";
import { profileOptions } from "@/lib/assessment/persistence";
import type {
  AssessmentAnswer,
  AssessmentDimension,
  AssessmentQuestion as Question,
  CompanyProfile,
  Screen,
} from "@/lib/assessment/types";
import { fa } from "@/lib/mock-data";
const dimensionIcons = { system: Network, strategy: Target, scale: TrendingUp };
export function AssessmentIntro({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="assessment-hero">
        <div className="assessment-hero-copy">
          <div className="eyebrow">CLARITY BEFORE GROWTH</div>
          <span className="assessment-kicker">
            از شناخت امروز، تا تصمیم بهتر فردا
          </span>
          <h1>
            ارزیابی سلامت کسب‌وکار
            <br />
            با مدل <span dir="ltr">3S</span>
          </h1>
          <p>
            در این ارزیابی، وضعیت کسب‌وکار شما در سه محور سیستم، استراتژی و
            اسکیل بررسی می‌شود تا مشخص شود اصلی‌ترین مانع رشد کسب‌وکار شما چیست.
          </p>
          <button className="assessment-primary" onClick={onStart}>
            شروع ارزیابی
            <ArrowLeft size={17} />
          </button>
          <div className="assessment-facts">
            <span>
              <FileCheck2 size={15} />
              ۳۰ پرسش
            </span>
            <span>
              <Clock3 size={15} />
              حدود ۷ تا ۱۰ دقیقه
            </span>
            <span>
              <LockKeyhole size={15} />
              ذخیره در فضای کسب‌وکار شما
            </span>
          </div>
        </div>
        <div className="diagnostic-model">
          <span className="eyebrow">THE 3S DIAGNOSTIC MODEL</span>
          {dimensions.map((d, i) => {
            const Icon = dimensionIcons[d];
            return (
              <div key={d}>
                <span className="model-number">0{i + 1}</span>
                <Icon size={23} />
                <div>
                  <strong>{dimensionMeta[d].label}</strong>
                  <small>{dimensionMeta[d].intro}</small>
                </div>
              </div>
            );
          })}
          <p>سه رکن به‌هم‌پیوسته؛ یک تصویر روشن از سلامت کسب‌وکار.</p>
        </div>
      </section>
      <div className="assessment-outcomes">
        {[
          {
            title: "ضعف اصلی را بشناسید",
            text: "امتیاز هر رکن و مانعی که رشد پایدار را محدود می‌کند.",
          },
          {
            title: "مسائل مهم را تفکیک کنید",
            text: "یافته‌های هر سه محور بر اساس پاسخ‌های واقعی شما.",
          },
          {
            title: "تمرکز بعدی را انتخاب کنید",
            text: "پیشنهاد مشخص و قاعده‌محور برای قدم بعدی مدیریت.",
          },
        ].map((x, i) => (
          <div key={x.title}>
            <span>{fa(i + 1).padStart(2, "۰")}</span>
            <h2>{x.title}</h2>
            <p>{x.text}</p>
          </div>
        ))}
      </div>
      <p className="assessment-footnote">
        بر اساس وضعیت فعلی پاسخ دهید، نه برنامه‌های آینده. این گزارش یک
        خودارزیابی مدیریتی است؛ نتایج آن به دقت پاسخ‌های شما وابسته است.
      </p>
    </>
  );
}
export function AssessmentProgress({
  screen,
  index,
  answered,
}: {
  screen: Screen;
  index: number;
  answered: number;
}) {
  const current =
    screen === "intro"
      ? 0
      : screen === "profile"
        ? 1
        : ["results", "roadmap"].includes(screen)
          ? 5
          : 2 + Math.floor(index / 10);
  return (
    <div className="assessment-progress">
      <ol aria-label="مراحل ارزیابی">
        {[
          "معرفی",
          "مشخصات شرکت",
          "سیستم",
          "استراتژی",
          "اسکیل",
          "گزارش تشخیصی",
        ].map((name, i) => (
          <li
            key={name}
            className={i === current ? "current" : i < current ? "passed" : ""}
            aria-current={i === current ? "step" : undefined}
          >
            <span>{i < current ? <Check size={12} /> : fa(i + 1)}</span>
            {name}
          </li>
        ))}
      </ol>
      <div className="assessment-completion">
        <span>{fa(answered)} از ۳۰ پاسخ ثبت شده</span>
        <strong>{fa(Math.round((answered / 30) * 100))}٪</strong>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="پاسخ‌های ثبت شده"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={30}
      >
        <span style={{ width: `${(answered / 30) * 100}%` }} />
      </div>
    </div>
  );
}
export function CompanyProfileForm({
  profile,
  onChange,
  onNext,
  onBack,
}: {
  profile: CompanyProfile;
  onChange: (p: CompanyProfile) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const update = (key: keyof CompanyProfile, value: string) =>
    onChange({ ...profile, [key]: value });
  return (
    <section className="assessment-panel">
      <div className="eyebrow">COMPANY CONTEXT</div>
      <h1>ابتدا، کمی درباره کسب‌وکار شما</h1>
      <p className="assessment-description">
        این اطلاعات، زمینه گزارش شماست. در این نسخه، امتیازها فقط از پاسخ‌های
        ارزیابی محاسبه می‌شوند.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <div className="profile-grid">
          <label>
            نام کسب‌وکار
            <input
              required
              maxLength={150}
              name="businessName"
              value={profile.name}
              placeholder="برای مثال: شرکت آریا"
              onChange={(e) => update("name", e.target.value)}
            />
          </label>
          <label>
            صنعت / حوزه فعالیت
            <input
              required
              maxLength={150}
              name="industry"
              value={profile.industry}
              placeholder="برای مثال: خدمات فناوری اطلاعات"
              onChange={(e) => update("industry", e.target.value)}
            />
          </label>
          {(Object.keys(profileOptions) as (keyof typeof profileOptions)[]).map(
            (key) => (
              <label key={key}>
                {
                  {
                    model: "مدل کسب‌وکار",
                    teamSize: "تعداد اعضای تیم",
                    revenue: "بازه تقریبی درآمد ماهانه",
                    stage: "مرحله فعلی کسب‌وکار",
                  }[key]
                }
                <select
                  required
                  value={profile[key]}
                  onChange={(e) => update(key, e.target.value)}
                >
                  <option value="">انتخاب کنید</option>
                  {profileOptions[key].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ),
          )}
        </div>
        <div className="assessment-privacy">
          <LockKeyhole size={15} />
          اطلاعات به سرور ارسال نمی‌شود و تنها در همین مرورگر باقی می‌ماند.
        </div>
        <AssessmentNavigation
          onBack={onBack}
          submit
          nextLabel="ادامه به ارزیابی سیستم"
        />
      </form>
    </section>
  );
}
export function AssessmentSectionIntro({
  dimension,
  onNext,
  onBack,
}: {
  dimension: AssessmentDimension;
  onNext: () => void;
  onBack: () => void;
}) {
  const meta = dimensionMeta[dimension];
  const Icon = dimensionIcons[dimension];
  return (
    <section className="assessment-panel dimension-intro">
      <span className="dimension-intro-icon">
        <Icon size={30} />
      </span>
      <div className="eyebrow">{meta.english} / 10 QUESTIONS</div>
      <h1>
        {meta.label}؛ {meta.intro}
      </h1>
      <p className="assessment-description">{meta.description}</p>
      <div className="assessment-guidance">
        <h2>یک معیار برای پاسخ دقیق‌تر</h2>
        <p>
          عملکرد معمول کسب‌وکار در سه ماه اخیر را در نظر بگیرید. امتیاز بالاتر
          یعنی این قابلیت در عمل پایدار است، نه اینکه فقط برای آن برنامه دارید.
        </p>
        <div className="scale-legend">
          <span>
            <b>۱</b> اصلاً وجود ندارد / بسیار ضعیف
          </span>
          <ArrowLeft size={17} />
          <span>
            <b>۵</b> کاملاً سیستماتیک و پایدار
          </span>
        </div>
      </div>
      <AssessmentNavigation
        onBack={onBack}
        onNext={onNext}
        nextLabel={`شروع پرسش‌های ${meta.label}`}
      />
    </section>
  );
}
export function ScoreSelector({
  question,
  answer,
  onAnswer,
}: {
  question: Question;
  answer?: AssessmentAnswer;
  onAnswer: (a: AssessmentAnswer) => void;
}) {
  return (
    <fieldset className="score-selector">
      <legend className="sr-only">پاسخ به پرسش: {question.text}</legend>
      {responseLabels.map((label, i) => (
        <label key={i} className={answer === i + 1 ? "selected" : ""}>
          <input
            type="radio"
            name={question.id}
            value={i + 1}
            checked={answer === i + 1}
            onChange={() => onAnswer((i + 1) as AssessmentAnswer)}
          />
          <strong>{fa(i + 1)}</strong>
          <span>{label}</span>
          <Check size={15} className="selected-check" />
        </label>
      ))}
    </fieldset>
  );
}
export function AssessmentQuestion({
  question,
  index,
  answer,
  onAnswer,
  onBack,
  onNext,
}: {
  question: Question;
  index: number;
  answer?: AssessmentAnswer;
  onAnswer: (a: AssessmentAnswer) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="assessment-panel question-panel">
      <div className="question-heading">
        <span className="question-dimension">
          {dimensionMeta[question.dimension].label}
        </span>
        <span>
          پرسش {fa((index % 10) + 1)} از ۱۰ <i /> {fa(index + 1)} از ۳۰
        </span>
      </div>
      <h1>{question.text}</h1>
      <p className="assessment-description">
        کدام گزینه به وضعیت فعلی کسب‌وکار شما نزدیک‌تر است؟
      </p>
      <ScoreSelector question={question} answer={answer} onAnswer={onAnswer} />
      <p className="answer-feedback" aria-live="polite">
        {answer
          ? `پاسخ انتخاب‌شده: ${fa(answer)} — ${responseLabels[answer - 1]}`
          : "برای ادامه، یک گزینه را انتخاب کنید."}
      </p>
      <AssessmentNavigation
        onBack={onBack}
        onNext={onNext}
        disabled={!answer}
        nextLabel={
          index === 29
            ? "مشاهده گزارش تشخیصی"
            : index % 10 === 9
              ? "ادامه به محور بعدی"
              : "پرسش بعدی"
        }
      />
    </section>
  );
}
export function AssessmentNavigation({
  onBack,
  onNext,
  nextLabel,
  disabled = false,
  submit = false,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel: string;
  disabled?: boolean;
  submit?: boolean;
}) {
  return (
    <div className="assessment-navigation">
      <button type="button" className="assessment-secondary" onClick={onBack}>
        <ArrowRight size={16} />
        مرحله قبل
      </button>
      <button
        type={submit ? "submit" : "button"}
        className="assessment-primary"
        onClick={onNext}
        disabled={disabled}
      >
        {nextLabel}
        <ArrowLeft size={16} />
      </button>
    </div>
  );
}
