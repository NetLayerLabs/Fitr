import type { NsMessages } from "../types";

const common: Partial<NsMessages<"common">> = {
  back: "戻る",
  close: "閉じる",
  loading: "読み込み中…",
  notFoundMetaTitle: "ページが見つかりません",
  notFoundTitle: "このページは脚の日をサボったようです",
  notFoundText: "お探しのページが見つかりませんでした。",
  notFoundCta: "「今日」に戻る",
  offlineMetaTitle: "オフライン",
  offlineTitle: "オフラインです",
  offlineBody: "この画面はまだ端末に保存されていません。再接続してから、もう一度お試しください。",
  offlineNote: "一度開いた画面はオフラインでも表示できます。姿勢トラッキングは常にスマホ上で動作します。",
  tryAgain: "もう一度試す",
  home: "ホーム",
};

export default common;
