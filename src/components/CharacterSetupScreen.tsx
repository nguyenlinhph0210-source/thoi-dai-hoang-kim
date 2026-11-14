'use client';
import { useRef, useState, useTransition } from 'react';
import { ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Coins, Crown, Feather, Flower2, Heart, Landmark, Loader2, LockKeyhole, RefreshCw, ScrollText, Shield, Sparkles, Sword, UserRound } from 'lucide-react';
import { setupAction } from '@/app/actions';
import { BRANCHES, type Branch, type PublicSetupState } from '@/types/game';
import { BRANCH_INFO, INITIAL_RANKS, ORIGIN_INFO, RANKS, statLabel } from '@/lib/gameConfig';
import type { SetupCommand } from '@/lib/characterGenerator';
import PalaceIllustration from './PalaceIllustration';

const branchIcons = { CIVIL: Feather, MILITARY: Sword, INNER_COURT: Flower2, HAREM: Crown };
const visibleStats = [
  { key: 'int', icon: BookOpen, max: 120 }, { key: 'rep', icon: Shield, max: 100 },
  { key: 'fav', icon: Heart, max: 100 }, { key: 'cha', icon: Flower2, max: 120 },
  { key: 'hp', icon: UserRound, max: 100 }, { key: 'characterSilver', icon: Coins, max: 150 },
] as const;
export default function CharacterSetupScreen({ initialState }: { initialState: PublicSetupState | null }) {
  const [state, setState] = useState(initialState);
  const [branch, setBranch] = useState<Branch>(initialState?.character?.branch ?? 'CIVIL');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const character = state?.character;
  const active = character?.status === 'ACTIVE';
  const account = state?.account;
  const free = account?.hasCreatedCharacter ? 0 : account?.freeRerollsLeft ?? 3;
  const destiny = account?.destinyPoints ?? 0;
  const cannotReroll = free === 0 && destiny < 1;
  const rank = character ? RANKS[character.rankId] : INITIAL_RANKS[branch];
  const BranchIcon = branchIcons[branch];

  function execute(command: SetupCommand) {
    if (busy.current) return;
    busy.current = true;
    setError('');
    startTransition(async () => {
      try {
        const result = await setupAction(command, state?.revision ?? 0, crypto.randomUUID());
        if (result.ok) { setState(result.state); setConfirming(false); dialogRef.current?.close(); }
        else setError(result.error);
      } catch { setError('Mất kết nối. Hãy tải lại trang để kiểm tra kết quả đã lưu.'); }
      finally { busy.current = false; }
    });
  }
  function openConfirmation() { setConfirming(true); dialogRef.current?.showModal(); }

  return <div className="site-shell">
    <header className="topbar">
      <a href="/" className="brand" aria-label="Đại Nội Ký — Trang chủ"><span className="brand-mark"><Landmark size={25} strokeWidth={1.3} /></span><span>ĐẠI NỘI KÝ<small>MỘT KIẾP NGƯỜI · VẠN LỐI ĐI</small></span></a>
      <div className="reign"><span className="live-dot" />ĐẠI KHÁNH<span className="reign-divider" />Thiên Nguyên nguyên niên</div>
      <div className="chapter-label"><ScrollText size={15} /> KHỞI SỰ</div>
    </header>

    <main className="main-layout">
      <section className="intro">
        <div className="eyebrow"><span /> PHỤNG THIÊN PHỦ · CỬA NGỌ MÔN <span /></div>
        <h1>{active ? 'Một cuộc đời đã mở' : 'Khởi một kiếp người'}</h1>
        <p>{active ? 'Thân phận đã định. Từ đây, mỗi lựa chọn đều để lại dấu ấn.' : 'Giữa chốn cung đình, không ai biết trước vận mệnh. Bạn sẽ viết nên câu chuyện nào?'}</p>
        <div className="steps" aria-label="Tiến trình tạo nhân vật">
          {['Chọn con đường', 'Định thân phận', 'Nhập kinh thành'].map((label, index) => <div key={label} className={`step ${index <= (active ? 2 : character ? 1 : 0) ? 'current' : ''}`}><span>{index < (active ? 2 : character ? 1 : 0) ? <Check size={12} /> : `0${index + 1}`}</span>{label}{index !== 2 && <i />}</div>)}
        </div>
      </section>

      <div className="setup-grid">
        <aside className="paths-panel">
          <div className="section-caption"><span>01</span><h2>Chọn con đường</h2></div>
          <p className="section-note">Bốn ngả vào triều, bốn lối lập thân.</p>
          <div className="branch-list" role="group" aria-label="Nhánh phát triển">
            {BRANCHES.map(value => {
              const Icon = branchIcons[value];
              return <button key={value} type="button" className={`branch-card ${branch === value ? 'selected' : ''}`} aria-pressed={branch === value} disabled={!!character || pending} onClick={() => setBranch(value)}>
                <span className="path-icon"><Icon size={25} strokeWidth={1.4} /></span>
                <span className="path-copy"><strong>{BRANCH_INFO[value].name}</strong><small>{BRANCH_INFO[value].subtitle}</small></span>
                {branch === value ? <span className="selected-dot"><Check size={11} /></span> : <ChevronRight size={14} className="path-chevron" />}
              </button>;
            })}
          </div>
          <div className="path-description"><span className="tiny-diamond">◆</span><p>{BRANCH_INFO[branch].description}</p></div>
          {character && <p className="locked-branch"><LockKeyhole size={12} /> Nhánh được giữ nguyên trong kiếp này.</p>}
        </aside>

        <section className="identity-panel" aria-labelledby="identity-title" aria-busy={pending}>
          <div className="paper-corner top-left" /><div className="paper-corner top-right" /><div className="paper-corner bottom-left" /><div className="paper-corner bottom-right" />
          <div className="identity-heading"><span className="eyebrow">SỔ ĐỊNH THÂN</span><span className="document-number">{active ? 'ĐÃ GHI DANH' : 'THIÊN NGUYÊN · QUYỂN I'}</span></div>
          <PalaceIllustration />
          <div className="identity-title"><div className="identity-emblem"><BranchIcon size={28} strokeWidth={1.2} /></div><h2 id="identity-title">{character ? ORIGIN_INFO[character.origin].name : 'Vận mệnh chờ khai mở'}</h2><p>{character ? ORIGIN_INFO[character.origin].description : 'Chọn con đường của bạn. Một thân phận sẽ được trời định.'}</p></div>
          <div className="identity-meta"><span><small>CON ĐƯỜNG</small><strong>{BRANCH_INFO[branch].name}</strong></span><span><small>NIÊN TUẾ</small><strong>{character ? `${character.age} tuổi` : '16 – 21 tuổi'}</strong></span><span><small>PHẨM CẤP KHỞI ĐẦU</small><strong>{rank.name}</strong></span></div>
          <div className="stats-heading"><h3>Căn cốt & tư chất</h3><span>{character ? 'THUỘC TÍNH BẨM SINH' : 'CHỜ ĐỊNH THÂN'}</span></div>
          <div className="stats-grid">
            {visibleStats.map(({ key, icon: Icon, max }) => <div className="stat" key={key}><div className="stat-label"><Icon size={15} strokeWidth={1.4} /><span>{statLabel(key, branch)}</span><strong data-testid={`stat-${key}`}>{character ? character[key] : '—'}{key === 'characterSilver' && character && <small> lượng</small>}</strong></div><div className="stat-track"><span style={{ width: character ? `${Math.max(0, Math.min(100, character[key] / max * 100))}%` : '0%' }} /></div></div>)}
          </div>
          <p className="hidden-stat"><LockKeyhole size={11} /> Nghi Kỵ là chỉ số ẩn, chỉ được tiết lộ qua cơ chế dò xét.</p>
          {active && <div className="success-banner" role="status"><CheckCircle2 size={19} /><div><strong>Đã ghi danh vào kinh thành</strong><p>Thân phận được khóa. Ngân lượng chờ nhận đã chuyển vào kiếp này.</p></div></div>}
          {!active && <div className="mobile-resources"><span>Lượt miễn phí <strong>{free}/3</strong></span><span><Sparkles size={12} /> Thiên Mệnh <strong>{destiny}</strong></span></div>}
          {!active && <div className="identity-actions" aria-label="Thao tác định thân phận">
            {!character ? <button type="button" className="primary-button" onClick={() => execute({ type: 'BEGIN', branch })} disabled={pending}>{pending ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />} Khai mở thân phận <ArrowRight size={16} /></button> : <>
              <button type="button" className="reroll-button" onClick={() => execute({ type: 'REROLL' })} disabled={pending || cannotReroll}><RefreshCw size={16} className={pending ? 'spin' : ''} /> Đổi thân phận <small>{free > 0 ? `Miễn phí · còn ${free}` : '1 Thiên Mệnh'}</small></button>
              <button type="button" className="primary-button" onClick={openConfirmation} disabled={pending}>Chấp nhận thân phận <ArrowRight size={16} /></button>
            </>}
          </div>}
          {!active && <p className="action-note">{!character ? 'Lần khai mở đầu tiên của mỗi kiếp luôn miễn phí.' : cannotReroll ? 'Đã hết lượt miễn phí. Bạn cần 1 Điểm Thiên Mệnh để đổi tiếp.' : 'Đổi lại xuất thân và tư chất, giữ nguyên con đường đã chọn.'}</p>}
          {error && <p role="alert" className="error-message">{error}</p>}
        </section>

        <aside className="fate-panel">
          <div className="fate-card"><div className="fate-symbol"><Sparkles size={27} strokeWidth={1.1} /></div><span className="eyebrow">HÀNH TRANG TIỀN KIẾP</span><h2>Điểm Thiên Mệnh</h2><div className="destiny-number" data-testid="destiny-points">{destiny.toLocaleString('vi-VN')}</div><p>Một chút phúc duyên,<br />theo bạn qua muôn kiếp.</p><div className="fate-divider" /><div className="fate-detail"><span>Lượt đổi miễn phí</span><strong data-testid="free-rerolls">{free}<small> / 3</small></strong></div><div className="fate-detail"><span>Ngân lượng chờ nhận</span><strong>{account?.pendingRewardSilver ?? 0}<small> lượng</small></strong></div><p className="fate-footnote">3 lượt miễn phí chỉ dành cho cuộc đời đầu tiên của tài khoản.</p></div>
          <div className="guide-card"><h3><CircleHelp size={16} /> Lời nhắn trước cửa cung</h3><ol><li>Xuất thân do trời định, con đường do bạn chọn.</li><li>Lượt đổi và kết quả được lưu khi tải lại trang.</li><li>Khi xác nhận, lượt miễn phí chưa dùng sẽ hết hiệu lực.</li></ol></div>
          {active && character.promotionRequirements && <div className="promotion-card"><h3><ScrollText size={16} /> Bước đường phía trước</h3><p>{RANKS[character.promotionRequirements.targetRankId]?.name}</p>{character.promotionRequirements.conditions.map(c => <div key={c.stat}><span>{statLabel(c.stat, branch)}</span><strong>{c.operator} {c.value}</strong></div>)}<small>Ba điều kiện đã được ấn định cho kiếp này.</small></div>}
        </aside>
      </div>
      <footer className="page-footer"><span className="footer-ornament">◆</span><p>“Cửa son đã mở, một trang đời chờ người viết tiếp.”</p><span>HOÀNG TRIỀU ĐẠI KHÁNH · THẾ GIỚI HƯ CẤU</span><small>Bản trải nghiệm Chặng 1 · Tiến trình lưu trên máy chủ này</small></footer>
    </main>
    <dialog ref={dialogRef} className="confirm-dialog" onCancel={() => setConfirming(false)} aria-labelledby="confirm-title">
      {confirming && <><div className="dialog-seal"><Landmark size={30} /></div><h2 id="confirm-title">Một lời định thân phận</h2><p>Bạn sẽ bước vào kinh thành theo nhánh <strong>{BRANCH_INFO[branch].name}</strong>. Thân phận được khóa và {free} lượt đổi miễn phí còn lại sẽ hết hiệu lực.</p><p>{account?.pendingRewardSilver ?? 0} lượng chờ nhận sẽ được cộng vào ngân lượng của kiếp này.</p><div><button type="button" className="reroll-button" disabled={pending} onClick={() => { dialogRef.current?.close(); setConfirming(false); }}>Xem lại</button><button type="button" className="primary-button" disabled={pending} onClick={() => execute({ type: 'CONFIRM' })}>{pending ? <Loader2 size={17} className="spin" /> : <Check size={17} />} Xác nhận nhập kinh</button></div>{error && <p role="alert" className="error-message">{error}</p>}</>}
    </dialog>
  </div>;
}
